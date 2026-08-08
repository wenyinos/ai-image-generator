/**
 * 通用工具函数
 */

const crypto = require('crypto');
const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const http = require('http');
const https = require('https');
const tls = require('tls');
const dotenv = require('dotenv');
const {
  DOTENV_PATH,
  DOTENV_PARSED,
  DEBUG,
  PUBLIC_DIR,
  UPLOADS_RELATIVE_DIR,
  UPLOADS_DIR,
  UPLOAD_FILE_CLEANUP_DELAY_MS,
  FREE_TIER_QUOTA_ERROR_CODE,
  FREE_TIER_QUOTA_ERROR_MESSAGE,
  PLACEHOLDER_CREDENTIALS,
  BASE_URL,
  GEMINI_BASE_URL,
  GEMINI_DEFAULT_MODEL,
  GEMINI_MODEL_ALIASES,
  XAI_BASE_URL,
  XAI_API_KEY,
  XAI_DEFAULT_MODEL,
  XAI_MODEL_ALIASES,
  HTTP_PROXY,
  VOLCENGINE_HOST,
  VOLCENGINE_REGION,
  VOLCENGINE_SERVICE,
  VOLCENGINE_VERSION,
  VOLCENGINE_MODEL_ALIASES,
  SYNC_MODELS,
  SYNC_ENDPOINT,
  ASYNC_ENDPOINT,
  VIDEO_ENDPOINT,
  TASK_ENDPOINT,
  VIDEO_MODELS,
  MODEL_CONFIG,
  ALLOWED_SIZES_BY_MODEL,
  GENERATION_MAX_POLL_ATTEMPTS,
  GENERATION_POLL_INTERVAL_MS,
  GENERATION_REQUEST_TIMEOUT_MS,
  DASHSCOPE_MAX_POLL_ATTEMPTS,
  DASHSCOPE_POLL_INTERVAL_MS,
} = require('./config');
const { saveVideoTaskRecord, saveImageTaskRecord } = require('./database');

// ---- 上游错误格式化 ----

function formatUpstreamError(error, fallback = '生成失败') {
  const codes = [];
  const messages = [];
  const collectCode = (value) => {
    if (typeof value === 'string' && value.trim()) codes.push(value.trim());
  };
  const collectMessage = (value) => {
    if (typeof value === 'string' && value.trim()) messages.push(value.trim());
  };
  if (typeof error === 'string') {
    collectMessage(error);
  } else if (error && typeof error === 'object') {
    collectCode(error.code);
    collectCode(error.Code);
    collectCode(error.output?.code);
    collectCode(error.error?.code);
    collectCode(error.ResponseMetadata?.Error?.Code);
    collectMessage(error.message);
    collectMessage(error.Message);
    collectMessage(error.output?.message);
    collectMessage(error.error?.message);
    collectMessage(error.ResponseMetadata?.Error?.Message);
  }
  const values = [...codes, ...messages];
  if (values.some(value => value.includes(FREE_TIER_QUOTA_ERROR_CODE))) {
    return FREE_TIER_QUOTA_ERROR_MESSAGE;
  }
  const stripPrefix = value => String(value || '').replace(/^(?:生成失败[:：]\s*)+/, '').trim();
  const code = stripPrefix(codes.find(Boolean) || '');
  const message = stripPrefix(messages.find(value => stripPrefix(value) !== code) || fallback);
  if (code && message && message !== code) return `生成失败：${code} - ${message}`;
  if (code) return `生成失败：${code}`;
  return message && message !== '生成失败' ? `生成失败：${message}` : '生成失败';
}

// ---- fetch 带超时 ----

// 序列化 FormData 为 multipart Buffer
function serializeFormData(formData) {
  const boundary = `----FormBoundary${Math.random().toString(16).slice(2)}`;
  const chunks = [];
  for (const [key, value] of formData.entries()) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"`));
    if (typeof value === 'object' && value instanceof Blob) {
      chunks.push(Buffer.from(`; filename="file"\r\nContent-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`));
      chunks.push(Buffer.from(value));
      chunks.push(Buffer.from('\r\n'));
    } else {
      chunks.push(Buffer.from('\r\n\r\n'));
      chunks.push(Buffer.from(String(value)));
      chunks.push(Buffer.from('\r\n'));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), boundary };
}

// 通过 HTTP 代理发送请求（CONNECT 隧道）
function fetchThroughProxy(url, options = {}, proxyUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsedTarget = new URL(url);
    const parsedProxy = new URL(proxyUrl);
    const isHttps = parsedTarget.protocol === 'https:';
    const targetPort = parsedTarget.port || (isHttps ? 443 : 80);
    const method = (options.method || 'GET').toUpperCase();

    // 序列化 body
    let bodyBuffer = null;
    let boundary = null;
    if (options.body instanceof FormData) {
      const serialized = serializeFormData(options.body);
      bodyBuffer = serialized.body;
      boundary = serialized.boundary;
    } else if (options.body) {
      bodyBuffer = Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body));
    }

    const buildHeaders = () => {
      const headers = { ...(options.headers || {}) };
      if (bodyBuffer) headers['Content-Length'] = bodyBuffer.length;
      if (boundary) headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      return headers;
    };

    const done = (response) => {
      const chunks = [];
      response.on('data', (c) => chunks.push(c));
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: response.statusCode,
          ok: response.statusCode >= 200 && response.statusCode < 300,
          statusText: response.statusMessage,
          url,
          headers: response.headers,
          body,
          async json() { return JSON.parse(body.toString('utf8')); },
          async text() { return body.toString('utf8'); },
          async blob() { return new Blob([body]); },
          async arrayBuffer() { return body; },
        });
      });
    };

    const sendRequest = (req) => {
      req.on('error', reject);
      if (bodyBuffer) req.write(bodyBuffer);
      req.end();
    };

    const connectReq = http.request({
      host: parsedProxy.hostname,
      port: parsedProxy.port || 7890,
      method: 'CONNECT',
      path: `${parsedTarget.hostname}:${targetPort}`,
    });

    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        return reject(new Error(`代理 CONNECT 失败: ${res.statusCode}`));
      }
      if (isHttps) {
        const tlsSocket = tls.connect({ socket, servername: parsedTarget.hostname });
        tlsSocket.on('secureConnect', () => {
          const req = https.request({
            createConnection: () => tlsSocket,
            host: parsedTarget.hostname,
            port: targetPort,
            method,
            path: parsedTarget.pathname + parsedTarget.search,
            headers: buildHeaders(),
          }, done);
          sendRequest(req);
        });
        tlsSocket.on('error', reject);
      } else {
        const req = http.request({
          createConnection: () => socket,
          host: parsedTarget.hostname,
          port: targetPort,
          method,
          path: parsedTarget.pathname + parsedTarget.search,
          headers: buildHeaders(),
        }, done);
        sendRequest(req);
      }
    });
    connectReq.on('error', reject);
    connectReq.end();

    if (timeoutMs && timeoutMs > 0) {
      setTimeout(() => reject(new Error('请求超时')), timeoutMs);
    }
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 120000) {
  if (HTTP_PROXY && (url.startsWith('https://') || url.startsWith('http://'))) {
    return fetchThroughProxy(url, options, HTTP_PROXY, timeoutMs);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---- 火山引擎签名 ----

function sha256Hex(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function hmacSha256(key, content, encoding) {
  const hmac = crypto.createHmac('sha256', key).update(content);
  return encoding ? hmac.digest(encoding) : hmac.digest();
}

function volcengineCanonicalQuery(params) {
  return Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
}

function volcengineSign({ accessKey, secretKey, sessionToken, bodyText, queryParams, method = 'POST', pathname = '/', host, service, region }) {
  const xDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const shortXDate = xDate.slice(0, 8);
  const bodyHash = sha256Hex(bodyText || '');
  const headers = {
    'x-content-sha256': bodyHash,
    'x-date': xDate,
  };
  if (sessionToken) headers['x-security-token'] = sessionToken;
  const signedHeaders = sessionToken
    ? 'x-content-sha256;x-date;x-security-token'
    : 'x-content-sha256;x-date';
  const canonicalHeadersStr = Object.keys(headers).sort()
    .map(k => `${k}:${headers[k]}`)
    .join('\n');
  const canonicalRequest = [
    method,
    pathname,
    volcengineCanonicalQuery(queryParams),
    canonicalHeadersStr + '\n',
    signedHeaders,
    bodyHash,
  ].join('\n');
  const hashedCanonical = sha256Hex(canonicalRequest);
  const credentialScope = `${shortXDate}/${region}/${service}/request`;
  const stringToSign = ['HMAC-SHA256', xDate, credentialScope, hashedCanonical].join('\n');
  const kDate = hmacSha256(secretKey, shortXDate);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'request');
  const signature = hmacSha256(kSigning, stringToSign, 'hex');
  const authHeader = `HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const requestHeaders = {
    'Host': host,
    'Content-Type': 'application/json',
    'X-Content-Sha256': bodyHash,
    'X-Date': xDate,
    'Authorization': authHeader,
  };
  if (sessionToken) requestHeaders['X-Security-Token'] = sessionToken;
  return { headers: requestHeaders };
}

// ---- 凭证相关 ----

function isPlaceholderCredential(value) {
  return PLACEHOLDER_CREDENTIALS.has(String(value || '').trim());
}

function getDotenvCredential(name) {
  let validValue = '';
  try {
    if (fsSync.existsSync(DOTENV_PATH)) {
      const lines = fsSync.readFileSync(DOTENV_PATH, 'utf8').split(/\r?\n/);
      lines.forEach((line) => {
        const value = dotenv.parse(line)[name];
        if (typeof value === 'string' && value.trim() && !isPlaceholderCredential(value)) {
          validValue = value.trim();
        }
      });
    }
  } catch (err) {
    if (DEBUG) console.warn(`读取 .env 中的 ${name} 失败: ${err.message}`);
  }
  if (validValue) return validValue;
  const parsedValue = typeof DOTENV_PARSED[name] === 'string' ? DOTENV_PARSED[name].trim() : '';
  return parsedValue && !isPlaceholderCredential(parsedValue) ? parsedValue : '';
}

function getCredentialEnv(name) {
  const envValue = typeof process.env[name] === 'string' ? process.env[name].trim() : '';
  if (envValue && !isPlaceholderCredential(envValue)) return envValue;
  return getDotenvCredential(name);
}

function getApiKey(provider, providedApiKey) {
  const trimmed = typeof providedApiKey === 'string' ? providedApiKey.trim() : '';
  if (trimmed && !isPlaceholderCredential(trimmed)) return trimmed;
  if (provider === 'gemini') {
    const geminiEnv = getCredentialEnv('GEMINI_API_KEY');
    if (geminiEnv) return geminiEnv;
    return getCredentialEnv('GOOGLE_API_KEY');
  }
  if (provider === 'agnes') {
    return getCredentialEnv('AGNES_API_KEY');
  }
  if (provider === 'openai') {
    return getCredentialEnv('OPENAI_API_KEY');
  }
  if (provider === 'xai' || provider === 'grok') {
    return getCredentialEnv('XAI_API_KEY');
  }
  return getCredentialEnv('DASHSCOPE_API_KEY');
}

function parseVolcengineCredentials(providedValue) {
  const raw = typeof providedValue === 'string' ? providedValue.trim() : '';
  if (raw) {
    const splitByColon = raw.split(':');
    if ((splitByColon.length === 2 || splitByColon.length === 3) && splitByColon[0].trim() && splitByColon[1].trim()) {
      return {
        accessKey: splitByColon[0].trim(),
        secretKey: splitByColon[1].trim(),
        sessionToken: splitByColon[2] ? splitByColon[2].trim() : '',
      };
    }
    const splitByLine = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (splitByLine.length >= 2) {
      return {
        accessKey: splitByLine[0],
        secretKey: splitByLine[1],
        sessionToken: splitByLine[2] || '',
      };
    }
  }
  const accessKey = getCredentialEnv('VOLCENGINE_ACCESS_KEY');
  const secretKey = getCredentialEnv('VOLCENGINE_SECRET_KEY');
  const sessionToken = getCredentialEnv('VOLCENGINE_SESSION_TOKEN');
  if (accessKey && secretKey) return { accessKey, secretKey, sessionToken };
  return null;
}

// ---- Provider/Model 归一化 ----

// 快照模型：形如 qwen-image-2.0-pro-2026-06-22
function isSnapshotModel(model) {
  return typeof model === 'string' && /-\d{4}-\d{2}-\d{2}$/.test(model);
}

function normalizeProvider(provider) {
  if (provider === 'gemini') return 'gemini';
  if (provider === 'volcengine') return 'volcengine';
  if (provider === 'agnes') return 'agnes';
  if (provider === 'openai' || provider === 'gpt' || provider === 'oai') return 'openai';
  if (provider === 'xai' || provider === 'grok') return 'xai';
  return 'dashscope';
}

function normalizeGeminiModel(model) {
  if (!model || typeof model !== 'string') return GEMINI_DEFAULT_MODEL;
  return GEMINI_MODEL_ALIASES[model] || model;
}

function normalizeVolcengineModel(model) {
  if (typeof model === 'string' && model.trim()) {
    const mapped = VOLCENGINE_MODEL_ALIASES[model.trim()];
    if (mapped) return mapped;
    return model.trim();
  }
  return VOLCENGINE_MODEL_ALIASES['jimeng-4.0'];
}

// ---- 模型工具 ----

function isSyncModel(model) {
  // 快照模型形如 qwen-image-2.0-pro-2026-06-22，需剥离日期后缀再判断
  const base = isSnapshotModel(model) ? model.replace(/-\d{4}-\d{2}-\d{2}$/, '') : model;
  return SYNC_MODELS.has(base);
}

function getModelConfig(model) {
  return MODEL_CONFIG[model] || { size: '1024*1024', type: 'wan' };
}

function extractImageUrls(data, model) {
  if (isSyncModel(model)) {
    const choices = data.output?.choices?.[0]?.message?.content || [];
    return choices.filter(c => c.image).map(c => c.image);
  }
  const results = data.output?.results || [];
  return results.filter(r => r.url).map(r => r.url);
}

function extractVideoUrl(data) {
  const output = data?.output || {};
  if (typeof output.video_url === 'string' && output.video_url.trim()) return output.video_url.trim();
  const resultUrl = output.results?.find?.(item => typeof item?.url === 'string')?.url;
  return resultUrl ? resultUrl.trim() : '';
}

function mergeVideoModels(mode, ids) {
  const seen = new Set();
  const merged = [];
  [...VIDEO_MODELS[mode], ...ids.map(id => ({ value: id, label: id }))].forEach((item) => {
    if (!item.value || seen.has(item.value)) return;
    seen.add(item.value);
    merged.push(item);
  });
  return merged;
}

async function getDashscopeVideoModels(apiKey) {
  const authKey = getApiKey('dashscope', apiKey);
  const fallback = { text2video: VIDEO_MODELS.text2video, image2video: VIDEO_MODELS.image2video };
  if (!authKey) return { source: 'fallback', models: fallback };
  try {
    const modelsRes = await fetchWithTimeout(
      `${BASE_URL.replace('/api/v1', '/compatible-mode/v1')}/models`,
      { headers: { Authorization: `Bearer ${authKey}` } },
      8000
    );
    const modelsData = await modelsRes.json();
    const ids = (modelsData.data || []).map(item => item.id).filter(Boolean);
    return {
      source: modelsRes.ok ? 'dashscope' : 'fallback',
      models: {
        text2video: mergeVideoModels('text2video', ids.filter(id => /(t2v|text2video)/i.test(id))),
        image2video: mergeVideoModels('image2video', ids.filter(id => /(i2v|image2video)/i.test(id))),
      },
    };
  } catch (err) {
    return { source: 'fallback', models: fallback };
  }
}

// ---- Gemini ----

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function extractGeminiImageDataUrls(data) {
  const urls = [];
  const candidates = data?.candidates || [];
  candidates.forEach((candidate) => {
    const parts = candidate?.content?.parts || [];
    parts.forEach((part) => {
      const inlineData = part?.inlineData || part?.inline_data;
      if (inlineData?.data) {
        const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
        urls.push(`data:${mimeType};base64,${inlineData.data}`);
      }
    });
  });
  return urls;
}

async function generateWithGemini({ apiKey, model, prompt, n, imageDataUrl }) {
  // 通过 OpenAI 兼容网关访问 Gemini（base url 从 .env 的 GEMINI_BASE_URL 配置）
  const baseUrl = GEMINI_BASE_URL.replace(/\/$/, '');
  const selectedModel = normalizeGeminiModel(model);
  const requestCount = Number.isInteger(n) ? n : 1;
  const parsedImage = imageDataUrl ? parseDataUrl(imageDataUrl) : null;
  const geminiTimeoutMs = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);
  const imageUrls = [];

  for (let i = 0; i < requestCount; i += 1) {
    let res;
    if (parsedImage) {
      // 图生图：multipart edits
      const boundary = `----FormBoundary${i}${Date.now()}`;
      const mimeType = parsedImage.mimeType || 'image/png';
      const ext = MIME_EXTENSION_MAP[mimeType] || '.png';
      const header = Buffer.from([
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="model"\r\n\r\n${selectedModel}\r\n`,
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="prompt"\r\n\r\n${(prompt && prompt.trim()) ? prompt.trim() : 'Edit the image'}\r\n`,
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="image"; filename="image${ext}"\r\n`,
        `Content-Type: ${mimeType}\r\n\r\n`,
      ].join(''));
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const multipartBody = Buffer.concat([header, Buffer.from(parsedImage.data, 'base64'), footer]);
      res = await fetchWithTimeout(
        `${baseUrl}/images/edits`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: multipartBody,
        },
        geminiTimeoutMs
      );
    } else {
      // 文生图：JSON generations
      res = await fetchWithTimeout(
        `${baseUrl}/images/generations`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            prompt: (prompt && prompt.trim()) ? prompt.trim() : 'Generate an image',
            n: 1,
            response_format: 'b64_json',
          }),
        },
        geminiTimeoutMs
      );
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Gemini API error (${res.status})`);
    const item = data?.data?.[0];
    const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
    if (!url) throw new Error('Gemini 响应中未包含图片数据');
    imageUrls.push(url);
  }
  return imageUrls;
}

// ---- OpenAI (GPT 图片) ----

async function generateWithOpenAI({ apiKey, model, prompt, n = 1, size, imageDataUrl }) {
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const selectedModel = model || 'gpt-image-2';
  const timeoutMs = Number.parseInt(process.env.OPENAI_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);
  const requestCount = Number.isInteger(n) ? n : 1;
  const imageUrls = [];

  for (let i = 0; i < requestCount; i += 1) {
    // 图生图：使用 edits 端点（multipart form）
    if (imageDataUrl) {
      const parsedImage = parseDataUrl(imageDataUrl);
      if (!parsedImage) throw new Error('OpenAI 图生图需提供有效的 base64 图片');
      const boundary = `----FormBoundary${i}${Date.now()}`;
      const mimeType = parsedImage.mimeType || 'image/png';
      const ext = MIME_EXTENSION_MAP[mimeType] || '.png';
      const header = Buffer.from([
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="model"\r\n\r\n${selectedModel}\r\n`,
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="prompt"\r\n\r\n${(prompt && prompt.trim()) ? prompt.trim() : 'Edit the image'}\r\n`,
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="n"\r\n\r\n1\r\n`,
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="image"; filename="image${ext}"\r\n`,
        `Content-Type: ${mimeType}\r\n\r\n`,
      ].join(''));
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const imageBuffer = Buffer.from(parsedImage.data, 'base64');
      const multipartBody = Buffer.concat([header, imageBuffer, footer]);
      const res = await fetchWithTimeout(
        `${baseUrl}/images/edits`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: multipartBody,
        },
        timeoutMs
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `OpenAI edits failed (${res.status})`);
      const url = data?.data?.[0]?.url || (data?.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : '');
      if (!url) throw new Error('OpenAI 响应中未包含图片');
      imageUrls.push(url);
    } else {
      // 文生图：使用 generations 端点（JSON）
      const body = {
        model: selectedModel,
        prompt: (prompt && prompt.trim()) ? prompt.trim() : 'Generate an image',
        n: 1,
        response_format: 'b64_json',
      };
      if (size) body.size = size;
      const res = await fetchWithTimeout(
        `${baseUrl}/images/generations`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        timeoutMs
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `OpenAI generations failed (${res.status})`);
      const item = data?.data?.[0];
      const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
      if (!url) throw new Error('OpenAI 响应中未包含图片');
      imageUrls.push(url);
    }
  }
  return imageUrls;
}

// ---- xAI (Grok 视频) ----

async function submitGrokVideo({ apiKey, model, prompt, imageUrls, aspectRatio, duration, resolution }) {
  const baseUrl = (process.env.XAI_BASE_URL || XAI_BASE_URL).replace(/\/$/, '');
  const selectedModel = model || XAI_DEFAULT_MODEL;
  const timeoutMs = Number.parseInt(process.env.XAI_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);
  const body = {
    model: selectedModel,
    prompt: (prompt && prompt.trim()) ? prompt.trim() : 'Generate a video',
  };
  if (Array.isArray(imageUrls) && imageUrls.length > 0) body.image_urls = imageUrls;
  if (aspectRatio) body.aspect_ratio = aspectRatio;
  if (duration !== undefined) body.seconds = String(duration);
  if (resolution) body.resolution = resolution;

  const res = await fetchWithTimeout(
    `${baseUrl}/videos/generations`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
  const data = await res.json();
  if (!res.ok) throw new Error((typeof data?.error === 'object' && data.error?.message) || data?.error || data?.message || `xAI video submit failed (${res.status})`);
  return data;
}

async function fetchGrokVideoResult({ apiKey, taskId }) {
  const baseUrl = (process.env.XAI_BASE_URL || XAI_BASE_URL).replace(/\/$/, '');
  const timeoutMs = Number.parseInt(process.env.XAI_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);
  const res = await fetchWithTimeout(
    `${baseUrl}/videos/${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    timeoutMs
  );
  const data = await res.json();
  if (!res.ok) throw new Error((typeof data?.error === 'object' && data.error?.message) || data?.error || data?.message || `xAI video query failed (${res.status})`);
  return data;
}

// ---- Agnes AI ----

async function generateWithAgnes({ apiKey, model, prompt, n = 1, size, imageUrls }) {
  const baseUrl = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';
  const timeoutMs = Number.parseInt(process.env.AGNES_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);
  const body = {
    model,
    prompt: prompt || 'Generate an image',
    n,
    size: size || '1024x768',
    extra_body: { response_format: 'url' },
  };
  if (Array.isArray(imageUrls) && imageUrls.length > 0) {
    body.extra_body.image = imageUrls;
  }
  const res = await fetchWithTimeout(
    `${baseUrl}/v1/images/generations`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `Agnes API error (${res.status})`);
  }
  const urls = [];
  if (Array.isArray(data?.data)) {
    data.data.forEach((item) => {
      if (item?.url) urls.push(item.url);
      else if (item?.b64_json) urls.push(`data:image/png;base64,${item.b64_json}`);
    });
  }
  if (urls.length === 0) throw new Error('Agnes API 未返回图片');
  return urls;
}

async function fetchAgnesVideoResult({ apiKey, taskId }) {
  const baseUrl = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';
  const timeoutMs = Number.parseInt(process.env.AGNES_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);
  const res = await fetchWithTimeout(
    `${baseUrl}/v1/videos/${taskId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    timeoutMs
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `Agnes video query error (${res.status})`);
  }
  return data;
}

// ---- Volcengine ----

function extractVolcengineImageUrls(data) {
  const urls = [];
  const imageUrls = Array.isArray(data?.data?.image_urls) ? data.data.image_urls : [];
  imageUrls.forEach((url) => {
    if (typeof url === 'string' && url.trim()) urls.push(url.trim());
  });
  const base64Images = Array.isArray(data?.data?.binary_data_base64) ? data.data.binary_data_base64 : [];
  base64Images.forEach((b64) => {
    if (typeof b64 === 'string' && b64.trim()) urls.push(`data:image/png;base64,${b64.trim()}`);
  });
  if (!urls.length && typeof data?.url === 'string') urls.push(data.url);
  return urls;
}

function extractVolcengineVideoUrl(data) {
  if (typeof data?.data?.video_url === 'string' && data.data.video_url.trim()) return data.data.video_url.trim();
  if (typeof data?.video_url === 'string' && data.video_url.trim()) return data.video_url.trim();
  return '';
}

function normalizeVolcengineTaskStatus(status) {
  if (status === 'done') return 'SUCCEEDED';
  if (status === 'failed') return 'FAILED';
  if (status === 'running' || status === 'processing') return 'RUNNING';
  return 'PENDING';
}

async function fetchVolcengineTaskResult({ credentials, model, taskId, queryAction = 'CVSync2AsyncGetResult' }) {
  if (!credentials?.accessKey || !credentials?.secretKey) {
    throw new Error('Volcengine 凭证缺失，请使用 AK:SK 格式或配置 VOLCENGINE_ACCESS_KEY/VOLCENGINE_SECRET_KEY');
  }
  if (!taskId || typeof taskId !== 'string') throw new Error('缺少 taskId');
  const reqKey = normalizeVolcengineModel(model);
  const body = {
    req_key: reqKey,
    task_id: taskId,
    req_json: JSON.stringify({ return_url: true }),
  };
  const bodyText = JSON.stringify(body);
  const query = { Action: queryAction, Version: VOLCENGINE_VERSION };
  const auth = volcengineSign({
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken || '',
    bodyText,
    queryParams: query,
    host: VOLCENGINE_HOST,
    service: VOLCENGINE_SERVICE,
    region: VOLCENGINE_REGION,
  });
  const queryString = volcengineCanonicalQuery(query);
  const timeoutMs = Number.parseInt(process.env.VOLCENGINE_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);
  const resultRes = await fetchWithTimeout(
    `https://${VOLCENGINE_HOST}/?${queryString}`,
    { method: 'POST', headers: auth.headers, body: bodyText },
    timeoutMs
  );
  const resultData = await resultRes.json();
  if (!resultRes.ok || resultData?.code !== 10000) {
    throw new Error(resultData?.message || resultData?.ResponseMetadata?.Error?.Message || `Volcengine get result failed (${resultRes.status})`);
  }
  return { reqKey, resultData };
}

async function submitVolcengineTask({ credentials, body, submitAction = 'CVSync2AsyncSubmitTask' }) {
  if (!credentials?.accessKey || !credentials?.secretKey) {
    throw new Error('Volcengine 凭证缺失，请使用 AK:SK 格式或配置 VOLCENGINE_ACCESS_KEY/VOLCENGINE_SECRET_KEY');
  }
  const volcengineTimeoutMs = Number.parseInt(process.env.VOLCENGINE_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);
  const bodyText = JSON.stringify(body);
  const query = { Action: submitAction, Version: VOLCENGINE_VERSION };
  const auth = volcengineSign({
    accessKey: credentials.accessKey, secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken || '', bodyText,
    queryParams: query, host: VOLCENGINE_HOST, service: VOLCENGINE_SERVICE, region: VOLCENGINE_REGION,
  });
  const queryString = volcengineCanonicalQuery(query);
  const res = await fetchWithTimeout(
    `https://${VOLCENGINE_HOST}/?${queryString}`,
    { method: 'POST', headers: auth.headers, body: bodyText },
    volcengineTimeoutMs
  );
  const text = await res.text().catch(() => '');
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
  if (data?.code !== 10000) {
    if (res.status === 401 || data?.ResponseMetadata?.Error?.Code === 'SignatureDoesNotMatch') {
      const err = data?.ResponseMetadata?.Error || {};
      const requestId = data?.request_id || data?.ResponseMetadata?.RequestId || '';
      throw new Error(
        `Volcengine 鉴权失败(401): ${err.Message || 'Sign error'}${requestId ? `, request_id=${requestId}` : ''}。请确认使用的是火山引擎 AccessKey/SecretKey。`
      );
    }
    throw new Error(data?.message || data?.ResponseMetadata?.Error?.Message || `Volcengine submit failed (${res.status})`);
  }
  const taskId = data?.data?.task_id;
  if (!taskId) throw new Error('Volcengine 提交成功但未返回 task_id');
  return { taskId };
}

async function callVolcengineSync({ credentials, body, action = 'CVProcess', version }) {
  if (!credentials?.accessKey || !credentials?.secretKey) {
    throw new Error('Volcengine 凭证缺失，请使用 AK:SK 格式或配置 VOLCENGINE_ACCESS_KEY/VOLCENGINE_SECRET_KEY');
  }
  const volcengineTimeoutMs = Number.parseInt(process.env.VOLCENGINE_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);
  const bodyText = JSON.stringify(body);
  const query = { Action: action, Version: version || VOLCENGINE_VERSION };
  const auth = volcengineSign({
    accessKey: credentials.accessKey, secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken || '', bodyText,
    queryParams: query, host: VOLCENGINE_HOST, service: VOLCENGINE_SERVICE, region: VOLCENGINE_REGION,
  });
  const queryString = volcengineCanonicalQuery(query);
  const res = await fetchWithTimeout(
    `https://${VOLCENGINE_HOST}/?${queryString}`,
    { method: 'POST', headers: auth.headers, body: bodyText },
    volcengineTimeoutMs
  );
  const text = await res.text().catch(() => '');
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
  if (data?.code !== 10000) {
    throw new Error(data?.message || data?.ResponseMetadata?.Error?.Message || `Volcengine API error (${res.status})`);
  }
  return data;
}

async function generateWithVolcengine({
  credentials, model, prompt, n, size, width, height,
  watermark, imageUrls, scale, usePreLlm, seed,
  resolution, imageEditPrompt, loraWeight, returnTask,
}) {
  if (!credentials?.accessKey || !credentials?.secretKey) {
    throw new Error('Volcengine 凭证缺失，请使用 AK:SK 格式或配置 VOLCENGINE_ACCESS_KEY/VOLCENGINE_SECRET_KEY');
  }
  const reqKey = normalizeVolcengineModel(model);
  const isJimengT2IV3 = reqKey === 'jimeng_t2i_v30' || reqKey === 'jimeng_t2i_v31';
  const isJimengI2IV30 = reqKey === 'jimeng_i2i_v30';
  const isJimengUpscale = reqKey === 'jimeng_i2i_seed3_tilesr_cvtob';
  const isJimengInpainting = reqKey === 'jimeng_image2image_dream_inpaint';
  const isJimengMaterialPod = reqKey === 'i2i_material_extraction';
  const isJimengMaterialProduct = reqKey === 'jimeng_i2i_extract_tiled_images';
  const promptText = (prompt && prompt.trim()) ? prompt.trim() : 'Generate an image';
  const maxAttempts = Number.parseInt(process.env.VOLCENGINE_MAX_POLL_ATTEMPTS || String(GENERATION_MAX_POLL_ATTEMPTS), 10);
  const pollIntervalMs = Number.parseInt(process.env.VOLCENGINE_POLL_INTERVAL_MS || String(GENERATION_POLL_INTERVAL_MS), 10);
  const volcengineTimeoutMs = Number.parseInt(process.env.VOLCENGINE_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);

  const submitBody = { req_key: reqKey, prompt: promptText };
  if (isJimengI2IV30) {
    if (!Array.isArray(imageUrls) || imageUrls.length !== 1) throw new Error('jimeng_i2i_v30 requires exactly 1 image URL');
    submitBody.image_urls = [imageUrls[0]];
  } else if (isJimengUpscale) {
    if (!Array.isArray(imageUrls) || imageUrls.length !== 1) throw new Error('jimeng_i2i_seed3_tilesr_cvtob requires exactly 1 image URL');
    submitBody.image_urls = [imageUrls[0]];
  } else if (isJimengInpainting) {
    if (!Array.isArray(imageUrls) || imageUrls.length !== 2) throw new Error('jimeng_image2image_dream_inpaint requires exactly 2 image URLs (origin + mask)');
    submitBody.image_urls = [imageUrls[0], imageUrls[1]];
  } else if (isJimengMaterialPod || isJimengMaterialProduct) {
    if (!Array.isArray(imageUrls) || imageUrls.length !== 1) throw new Error(`${reqKey} requires exactly 1 image URL`);
    submitBody.image_urls = [imageUrls[0]];
  } else if (Array.isArray(imageUrls) && imageUrls.length) {
    submitBody.image_urls = imageUrls;
  }
  if (Number.isInteger(seed)) submitBody.seed = seed;
  if (isJimengT2IV3 && typeof usePreLlm === 'boolean') submitBody.use_pre_llm = usePreLlm;
  if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0) {
    submitBody.width = width;
    submitBody.height = height;
  } else if (!isJimengT2IV3 && typeof size === 'number' && Number.isFinite(size)) {
    submitBody.size = size;
  }
  if (typeof scale === 'number' && Number.isFinite(scale)) submitBody.scale = scale;
  if (typeof resolution === 'string' && (resolution === '4k' || resolution === '8k')) submitBody.resolution = resolution;
  if (isJimengMaterialPod || isJimengMaterialProduct) {
    const normalizedEditPrompt = typeof imageEditPrompt === 'string' ? imageEditPrompt.trim() : '';
    if (!normalizedEditPrompt) throw new Error(`${reqKey} requires image_edit_prompt`);
    submitBody.image_edit_prompt = normalizedEditPrompt;
    if (isJimengMaterialProduct) submitBody.edit_prompt = normalizedEditPrompt;
    if (typeof loraWeight === 'number' && Number.isFinite(loraWeight)) submitBody.lora_weight = loraWeight;
  }
  if (watermark === true) {
    submitBody.logo_info = JSON.stringify({ add_logo: true, position: 0, language: 0, opacity: 1 });
  }

  const baseUrl = `https://${VOLCENGINE_HOST}`;
  const submitQuery = { Action: 'CVSync2AsyncSubmitTask', Version: VOLCENGINE_VERSION };
  const submitBodyText = JSON.stringify(submitBody);
  const submitAuth = volcengineSign({
    accessKey: credentials.accessKey, secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken || '', bodyText: submitBodyText,
    queryParams: submitQuery, host: VOLCENGINE_HOST, service: VOLCENGINE_SERVICE, region: VOLCENGINE_REGION,
  });
  const submitQueryString = volcengineCanonicalQuery(submitQuery);
  const submitRes = await fetchWithTimeout(
    `${baseUrl}/?${submitQueryString}`,
    { method: 'POST', headers: submitAuth.headers, body: submitBodyText },
    volcengineTimeoutMs
  );
  const submitText = await submitRes.text().catch(() => '');
  let submitData;
  try { submitData = submitText ? JSON.parse(submitText) : {}; } catch (e) { submitData = {}; }

  if (submitData?.code !== 10000) {
    if (submitRes.status === 401 || submitData?.ResponseMetadata?.Error?.Code === 'SignatureDoesNotMatch') {
      const err = submitData?.ResponseMetadata?.Error || {};
      const requestId = submitData?.request_id || submitData?.ResponseMetadata?.RequestId || '';
      throw new Error(
        `Volcengine 鉴权失败(401): ${err.Message || 'Sign error'}${requestId ? `, request_id=${requestId}` : ''}。请确认使用的是火山引擎 AccessKey/SecretKey（不是 Ark API Key）；若为临时凭证还需携带 SessionToken。并检查账号权限、VOLCENGINE_REGION/VOLCENGINE_SERVICE 及服务器时间。`
      );
    }
    throw new Error(submitData?.message || submitData?.ResponseMetadata?.Error?.Message || `Volcengine submit failed (${submitRes.status})`);
  }
  const taskId = submitData?.data?.task_id;
  if (!taskId) throw new Error('Volcengine 提交成功但未返回 task_id');
  if (returnTask) return { taskId, taskStatus: 'PENDING', model: reqKey };

  const getResultQuery = { Action: 'CVSync2AsyncGetResult', Version: VOLCENGINE_VERSION };
  const getResultBody = { req_key: reqKey, task_id: taskId, req_json: JSON.stringify({ return_url: true }) };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    const getResultBodyText = JSON.stringify(getResultBody);
    const getResultAuth = volcengineSign({
      accessKey: credentials.accessKey, secretKey: credentials.secretKey,
      sessionToken: credentials.sessionToken || '', bodyText: getResultBodyText,
      queryParams: getResultQuery, host: VOLCENGINE_HOST, service: VOLCENGINE_SERVICE, region: VOLCENGINE_REGION,
    });
    const getResultQueryString = volcengineCanonicalQuery(getResultQuery);
    const resultRes = await fetchWithTimeout(
      `${baseUrl}/?${getResultQueryString}`,
      { method: 'POST', headers: getResultAuth.headers, body: getResultBodyText },
      volcengineTimeoutMs
    );
    const resultData = await resultRes.json();
    if (!resultRes.ok || resultData?.code !== 10000) {
      throw new Error(resultData?.message || resultData?.ResponseMetadata?.Error?.Message || `Volcengine get result failed (${resultRes.status})`);
    }
    const status = resultData?.data?.status;
    if (status === 'done') {
      const urls = extractVolcengineImageUrls(resultData);
      if (!urls.length) throw new Error('Volcengine 任务完成但未返回 image_urls');
      return urls;
    }
    if (status === 'failed') {
      throw new Error(resultData?.data?.msg || resultData?.message || 'Volcengine task failed');
    }
  }
  throw new Error('Volcengine 任务轮询超时');
}

// ---- 验证 ----

function validateIntegerInRange(name, value, min, max) {
  if (!Number.isInteger(value)) return `${name} 必须是整数`;
  if (value < min || value > max) return `${name} 必须在 ${min} 到 ${max} 之间`;
  return null;
}

function validateStringMaxLen(name, value, maxLen) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return `${name} 必须是字符串`;
  if (value.length > maxLen) return `${name} 过长（最大 ${maxLen} 个字符）`;
  return null;
}

function validateSize(model, size) {
  const allowed = ALLOWED_SIZES_BY_MODEL[model];
  if (!allowed) return null;
  if (!allowed.includes(size)) {
    return `模型 ${model} 不支持尺寸 ${size}，允许的尺寸：${allowed.join(', ')}`;
  }
  return null;
}

function parseSizeToArea(size) {
  if (size === undefined || size === null) return undefined;
  if (typeof size === 'number' && Number.isInteger(size) && size > 0) return size;
  if (typeof size !== 'string') return undefined;
  const normalized = size.trim().toUpperCase();
  const preset = { '1K': 1024 * 1024, '2K': 2048 * 2048, '4K': 4096 * 4096 };
  if (preset[normalized]) return preset[normalized];
  const matched = normalized.match(/^(\d+)\*(\d+)$/);
  if (!matched) return undefined;
  const width = Number.parseInt(matched[1], 10);
  const height = Number.parseInt(matched[2], 10);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  return width * height;
}

function parseImageUrlsInput(rawValue) {
  const isAllowedImageRef = (value) => /^https?:\/\//i.test(value);
  if (Array.isArray(rawValue)) {
    return rawValue.map(v => (typeof v === 'string' ? v.trim() : '')).filter(v => isAllowedImageRef(v));
  }
  if (typeof rawValue !== 'string') return [];
  return rawValue.split(/[\n,\s]+/).map(v => v.trim()).filter(v => isAllowedImageRef(v));
}

// ---- 文件操作 ----

function buildBaseUrl(req) {
  const configuredBaseUrl = typeof process.env.PUBLIC_BASE_URL === 'string' ? process.env.PUBLIC_BASE_URL.trim() : '';
  if (configuredBaseUrl) {
    const normalizedBaseUrl = configuredBaseUrl.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(normalizedBaseUrl)) throw new Error('PUBLIC_BASE_URL 必须以 http:// 或 https:// 开头');
    return normalizedBaseUrl;
  }
  const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'].split(',')[0].trim() : '';
  const protocol = forwardedProto || req.protocol || 'http';
  const forwardedHostHeader = typeof req.headers['x-forwarded-host'] === 'string' ? req.headers['x-forwarded-host'].split(',')[0].trim() : '';
  const forwardedHeader = typeof req.headers.forwarded === 'string' ? req.headers.forwarded : '';
  const forwardedHostMatch = forwardedHeader.match(/host=([^;,\s]+)/i);
  const forwardedHost = forwardedHostMatch ? forwardedHostMatch[1].replace(/^"|"$/g, '') : '';
  const host = forwardedHostHeader || forwardedHost || req.get('host');
  if (!host) throw new Error('无法确定请求主机以构建公网图片 URL');
  const hostName = host.split(':')[0].toLowerCase();
  const isPrivateHost = (
    hostName === 'localhost' || hostName === '127.0.0.1' || hostName === '::1' ||
    hostName.endsWith('.local') || /^10\./.test(hostName) ||
    /^192\.168\./.test(hostName) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostName)
  );
  if (isPrivateHost) throw new Error('当前服务地址是本地/内网地址，上游生成服务无法访问上传图片。请配置 PUBLIC_BASE_URL 为公网可访问地址。');
  return `${protocol}://${host}`;
}

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
  'image/webp': '.webp', 'image/gif': '.gif', 'image/bmp': '.bmp',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
};

async function saveUploadedImageAsPublicUrl(req, imageFile) {
  if (!imageFile?.buffer || !Buffer.isBuffer(imageFile.buffer)) return { publicUrl: '', filePath: '' };
  const publicBaseUrl = buildBaseUrl(req);
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const fileExt = MIME_EXTENSION_MAP[imageFile.mimetype] || '.png';
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${fileExt}`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  await fs.writeFile(filePath, imageFile.buffer);
  return { publicUrl: `${publicBaseUrl}/${UPLOADS_RELATIVE_DIR}/${fileName}`, filePath };
}

function scheduleUploadedFileCleanup(filePath, delayMs = UPLOAD_FILE_CLEANUP_DELAY_MS) {
  if (!filePath || typeof filePath !== 'string') return;
  const resolvedPath = path.resolve(filePath);
  const uploadsRoot = path.resolve(UPLOADS_DIR) + path.sep;
  if (!resolvedPath.startsWith(uploadsRoot)) return;
  const timer = setTimeout(async () => {
    try {
      await fs.unlink(resolvedPath);
      if (DEBUG) console.log(`🧹 已清理上传文件: ${resolvedPath}`);
    } catch (error) {
      if (error?.code !== 'ENOENT') console.error(`清理上传文件失败: ${resolvedPath}`, error);
    }
  }, delayMs);
  if (typeof timer.unref === 'function') timer.unref();
}

// ---- 网络工具 ----

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) return forwardedFor.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

module.exports = {
  formatUpstreamError,
  fetchWithTimeout,
  fetchThroughProxy,
  sha256Hex,
  hmacSha256,
  volcengineCanonicalQuery,
  volcengineSign,
  isPlaceholderCredential,
  getDotenvCredential,
  getCredentialEnv,
  getApiKey,
  parseVolcengineCredentials,
  normalizeProvider,
  isSnapshotModel,
  normalizeGeminiModel,
  normalizeVolcengineModel,
  isSyncModel,
  getModelConfig,
  extractImageUrls,
  extractVideoUrl,
  mergeVideoModels,
  getDashscopeVideoModels,
  parseDataUrl,
  extractGeminiImageDataUrls,
  generateWithGemini,
  generateWithOpenAI,
  generateWithAgnes,
  submitGrokVideo,
  fetchGrokVideoResult,
  fetchAgnesVideoResult,
  extractVolcengineImageUrls,
  extractVolcengineVideoUrl,
  normalizeVolcengineTaskStatus,
  fetchVolcengineTaskResult,
  submitVolcengineTask,
  callVolcengineSync,
  generateWithVolcengine,
  validateIntegerInRange,
  validateStringMaxLen,
  validateSize,
  parseSizeToArea,
  parseImageUrlsInput,
  buildBaseUrl,
  MIME_EXTENSION_MAP,
  saveUploadedImageAsPublicUrl,
  scheduleUploadedFileCleanup,
  getClientIp,
  saveVideoTaskRecord,
  saveImageTaskRecord,
};
