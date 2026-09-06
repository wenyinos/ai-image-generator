/**
 * S3 兼容对象存储客户端（Cloudflare R2 / AWS S3 / 阿里云 OSS / 腾讯云 COS / MinIO / 自定义）
 * 手写 AWS SigV4 签名，避免引入 SDK 依赖；配置（含密钥）持久化在 SQLite storage_config 表
 */

const crypto = require('crypto');
const { fetchWithTimeout } = require('./utils');
const { readStorageConfigRow, writeStorageConfigRow } = require('./database');

// 服务商预设：均为 S3 兼容协议，仅 endpoint 构造与路径风格不同
const STORAGE_PRESETS = {
  r2: { label: 'Cloudflare R2（推荐）', endpointPlaceholder: 'https://{accountId}.r2.cloudflarestorage.com', region: 'auto', regionFixed: true, pathStyle: true },
  s3: { label: 'AWS S3', endpointPlaceholder: 'https://s3.us-east-1.amazonaws.com', region: 'us-east-1', pathStyle: false },
  oss: { label: '阿里云 OSS（S3 兼容）', endpointPlaceholder: 'https://oss-cn-hangzhou.aliyuncs.com', region: 'oss-cn-hangzhou', pathStyle: true },
  cos: { label: '腾讯云 COS（S3 兼容）', endpointPlaceholder: 'https://cos.ap-guangzhou.myqcloud.com', region: 'ap-guangzhou', pathStyle: true },
  minio: { label: 'MinIO（自建）', endpointPlaceholder: 'https://minio.example.com:9000', region: 'us-east-1', pathStyle: true },
  custom: { label: '自定义（S3 兼容）', endpointPlaceholder: 'https://s3.example.com', region: 'us-east-1', pathStyle: true },
};

// RFC3986 编码（S3 签名要求，比 encodeURIComponent 多编码 !'()*）
function s3Encode(str) {
  return encodeURIComponent(String(str)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

// 桶内对象 URL：path-style 为 endpoint/bucket/key；virtual-hosted 为 bucket.host/key
function buildBucketUrl(cfg, key, query) {
  const endpoint = String(cfg.endpoint || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(endpoint)) throw new Error('存储 endpoint 必须以 http(s):// 开头');
  const objectPath = String(key || '').split('/').filter(Boolean).map(s3Encode).join('/');
  const url = cfg.pathStyle
    ? new URL(`${endpoint}/${encodeURIComponent(cfg.bucket)}${objectPath ? `/${objectPath}` : ''}`)
    : (() => {
      const u = new URL(endpoint);
      const basePath = u.pathname.replace(/\/+$/, '');
      return new URL(`${u.protocol}//${encodeURIComponent(cfg.bucket)}.${u.host}${basePath}${objectPath ? `/${objectPath}` : ''}`);
    })();
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return url;
}

// 生成 SigV4 签名头；payload 统一 UNSIGNED-PAYLOAD（HTTPS 传输，S3/R2 均支持）
function signRequest(cfg, method, url) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = cfg.region || 'us-east-1';

  const amzHeaders = {
    host: url.host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': amzDate,
  };
  const sortedKeys = Object.keys(amzHeaders).sort();
  const signedHeaders = sortedKeys.join(';');
  const canonicalHeaders = sortedKeys.map((h) => `${h}:${amzHeaders[h]}\n`).join('');

  const canonicalQuery = [...url.searchParams.entries()]
    .map(([k, v]) => [s3Encode(k), s3Encode(v)])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, dateStamp), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  };
}

// ---------- 配置读写（SQLite storage_config 表） ----------

async function loadStorageConfig() {
  const cfg = readStorageConfigRow();
  return cfg && cfg.bucket ? cfg : null;
}

// 保存前先验证连通性，验证通过才允许启用
async function saveStorageConfig(input) {
  const preset = STORAGE_PRESETS[input.preset] ? input.preset : 'custom';
  const presetDef = STORAGE_PRESETS[preset];
  const cfg = {
    preset,
    endpoint: String(input.endpoint || '').trim(),
    region: String(input.region || presetDef.region || 'us-east-1').trim() || 'us-east-1',
    bucket: String(input.bucket || '').trim(),
    accessKeyId: String(input.accessKeyId || '').trim(),
    secretAccessKey: String(input.secretAccessKey || '').trim(),
    pathStyle: input.pathStyle !== undefined ? !!input.pathStyle : presetDef.pathStyle,
    enabled: true,
    testedAt: Date.now(),
  };
  await testStorage(cfg);
  writeStorageConfigRow(cfg);
  return cfg;
}

async function disableStorage() {
  const cfg = await loadStorageConfig();
  if (!cfg) return null;
  cfg.enabled = false;
  writeStorageConfigRow(cfg);
  return cfg;
}

// 脱敏视图（密钥不回传前端）
function maskStorageConfig(cfg) {
  if (!cfg) return { configured: false, enabled: false };
  return {
    configured: true,
    enabled: !!cfg.enabled,
    preset: cfg.preset,
    presetLabel: (STORAGE_PRESETS[cfg.preset] || {}).label || cfg.preset,
    endpoint: cfg.endpoint,
    region: cfg.region,
    bucket: cfg.bucket,
    pathStyle: !!cfg.pathStyle,
    accessKeyIdMasked: cfg.accessKeyId ? `${cfg.accessKeyId.slice(0, 4)}****` : '',
    testedAt: cfg.testedAt || null,
  };
}

// ---------- 对象操作 ----------

// 完整权限验证：读（List）+ 写（PUT 测试对象）+ 删（DELETE 测试对象），
// 删除功能依赖 DELETE 权限，保存配置前必须全部通过
async function testStorage(cfg) {
  const testKey = `.perm-check/${Date.now()}-${crypto.randomBytes(3).toString('hex')}.txt`;

  // 1. 读权限：ListObjectsV2
  const listUrl = buildBucketUrl(cfg, '', { 'list-type': '2', 'max-keys': '1' });
  const listAuth = signRequest(cfg, 'GET', listUrl);
  let listRes;
  try {
    listRes = await fetchWithTimeout(listUrl, { method: 'GET', headers: listAuth }, 15000);
  } catch (e) {
    throw new Error(`无法连接存储服务：${e.message}`);
  }
  if (!listRes.ok) {
    const text = (await listRes.text().catch(() => '')).slice(0, 300);
    if (listRes.status === 403) throw new Error('读取权限校验失败（403）：请检查 Access Key，并确认允许 ListObjects 操作');
    if (listRes.status === 404) throw new Error(`存储桶不存在（404）：${cfg.bucket}`);
    throw new Error(`存储服务返回 ${listRes.status}：${text || '无详细信息'}`);
  }

  // 2. 写权限：PUT 测试对象
  const putUrl = buildBucketUrl(cfg, testKey);
  const putAuth = signRequest(cfg, 'PUT', putUrl);
  let putRes;
  try {
    putRes = await fetchWithTimeout(putUrl, {
      method: 'PUT',
      headers: { ...putAuth, 'Content-Type': 'text/plain', 'Content-Length': 2 },
      body: 'ok',
    }, 15000);
  } catch (e) {
    throw new Error(`写入权限验证请求失败：${e.message}`);
  }
  if (!putRes.ok) {
    const text = (await putRes.text().catch(() => '')).slice(0, 300);
    if (putRes.status === 403) throw new Error('写入权限校验失败（403）：请确认存储桶允许 PutObject 操作（R2 需勾选对象写入授权）');
    throw new Error(`写入验证失败（${putRes.status}）：${text || '无详细信息'}`);
  }

  // 3. 删除权限：DELETE 测试对象
  const delAuth = signRequest(cfg, 'DELETE', putUrl);
  let delRes;
  try {
    delRes = await fetchWithTimeout(putUrl, { method: 'DELETE', headers: delAuth }, 15000);
  } catch (e) {
    throw new Error(`删除权限验证请求失败：${e.message}`);
  }
  if (!delRes.ok && delRes.status !== 204) {
    const text = (await delRes.text().catch(() => '')).slice(0, 300);
    if (delRes.status === 403) throw new Error('删除权限校验失败（403）：请确认存储桶允许 DeleteObject 操作，否则无法使用删除功能');
    throw new Error(`删除验证失败（${delRes.status}）：${text || '无详细信息'}`);
  }
  return true;
}

// 备份：下载 sourceUrl 内容并按 backups/年/月/ 分类上传；返回对象键
async function backupToStorage(cfg, sourceUrl, { type, key }) {
  const res = await fetchWithTimeout(sourceUrl, {}, 300000);
  if (!res.ok) throw new Error(`下载生成内容失败：HTTP ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || (type === 'video' ? 'video/mp4' : 'image/png');
  const objectUrl = buildBucketUrl(cfg, key);
  const auth = signRequest(cfg, 'PUT', objectUrl);
  const putRes = await fetchWithTimeout(objectUrl, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': contentType, 'Content-Length': body.length },
    body,
  }, 300000);
  if (!putRes.ok) {
    const text = (await putRes.text().catch(() => '')).slice(0, 300);
    throw new Error(`上传到存储桶失败：HTTP ${putRes.status} ${text}`);
  }
  return { key, contentType, size: body.length };
}

// 读取对象（供下载代理流式转发）
async function getStorageObject(cfg, key) {
  const objectUrl = buildBucketUrl(cfg, key);
  const auth = signRequest(cfg, 'GET', objectUrl);
  return fetchWithTimeout(objectUrl, { method: 'GET', headers: auth }, 300000);
}

// 删除对象
async function deleteStorageObject(cfg, key) {
  const objectUrl = buildBucketUrl(cfg, key);
  const auth = signRequest(cfg, 'DELETE', objectUrl);
  const res = await fetchWithTimeout(objectUrl, { method: 'DELETE', headers: auth }, 60000);
  // 204 成功；404 视为已删除（幂等）
  if (!res.ok && res.status !== 204 && res.status !== 404) {
    const text = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`删除存储对象失败：HTTP ${res.status} ${text}`);
  }
  return true;
}

// 备份对象键：backups/2026/09/image-20260906-143025-a1b2c3.png
function buildBackupKey(type, ext, now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const stamp = `${yyyy}${mm}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const rand = crypto.randomBytes(3).toString('hex');
  const safeExt = (ext || (type === 'video' ? 'mp4' : 'png')).replace(/[^a-z0-9]/gi, '') || (type === 'video' ? 'mp4' : 'png');
  return `backups/${yyyy}/${mm}/${type}-${stamp}-${rand}.${safeExt}`;
}

// 从生成内容 URL 推断扩展名（data: URL 由调用方决定）
function guessExt(url, type) {
  try {
    const m = String(url).split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
    return m ? m[1].toLowerCase() : (type === 'video' ? 'mp4' : 'png');
  } catch {
    return type === 'video' ? 'mp4' : 'png';
  }
}

module.exports = {
  STORAGE_PRESETS,
  loadStorageConfig,
  saveStorageConfig,
  disableStorage,
  maskStorageConfig,
  testStorage,
  backupToStorage,
  getStorageObject,
  deleteStorageObject,
  buildBackupKey,
  guessExt,
};
