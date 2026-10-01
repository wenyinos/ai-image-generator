/**
 * 历史记录与 S3 兼容存储备份路由
 * - /api/storage-config：存储配置（保存前先验证连通性，验证通过才启用）
 * - /api/history：生成内容历史（生成成功后前端上报，启用备份时异步转存到存储桶）
 */

const express = require('express');
const { Readable } = require('stream');
const router = express.Router();
const {
  saveHistoryRecord,
  updateHistoryBackup,
  listHistoryRecords,
  getHistoryRecord,
  deleteHistoryRecord,
  clearMediaDataFromDatabase,
  vacuumDatabase,
  getDatabaseFileSize,
} = require('../database');
const {
  STORAGE_PRESETS,
  loadStorageConfig,
  saveStorageConfig,
  disableStorage,
  maskStorageConfig,
  backupToStorage,
  getStorageObject,
  deleteStorageObject,
  buildBackupKey,
  guessExt,
} = require('../storage');

// 存储配置：返回脱敏视图（密钥不回传）
router.get('/storage-config', (req, res) => {
  res.json({ presets: STORAGE_PRESETS, config: maskStorageConfig(null) });
});

router.get('/storage-config/view', async (req, res) => {
  const cfg = await loadStorageConfig();
  res.json({ presets: STORAGE_PRESETS, config: maskStorageConfig(cfg) });
});

// 保存配置：先验证连通性，失败则不保存
router.post('/storage-config', async (req, res) => {
  const body = req.body || {};
  if (!body.bucket || !body.accessKeyId || !body.secretAccessKey || !body.endpoint) {
    return res.status(400).json({ error: 'endpoint、Bucket、Access Key ID、Secret Access Key 均为必填' });
  }
  try {
    const cfg = await saveStorageConfig(body);
    res.json({ ok: true, config: maskStorageConfig(cfg) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/storage-config/disable', async (req, res) => {
  const cfg = await disableStorage();
  res.json({ ok: true, config: maskStorageConfig(cfg) });
});

// data: URL 的扩展名（图片/视频字节不入库，仅用于生成存储对象键）
function dataUrlExt(url, type) {
  const mime = /^data:([^;,]*)/.exec(url)?.[1] || '';
  const ext = (mime.split('/')[1] || '').replace(/[^a-z0-9]/gi, '');
  return ext || (type === 'video' ? 'mp4' : 'png');
}

// 上报生成内容：
// - data: URL（生成内容的原始载荷）绝不写入 SQLite：存储启用时先同步转存到存储桶，记录只保存元数据
// - http(s) 链接：链接入库并异步转存（链接可随时重新拉取，无需入库载荷）
router.post('/history', async (req, res) => {
  const { type, url, provider, model } = req.body || {};
  if (!url || (type !== 'image' && type !== 'video')) {
    return res.status(400).json({ error: 'type（image/video）与 url 为必填' });
  }
  const cfg = await loadStorageConfig();
  const backupEnabled = !!(cfg && cfg.enabled);

  if (url.startsWith('data:')) {
    if (!backupEnabled) {
      const id = saveHistoryRecord({ type, provider, model, sourceUrl: '', backupStatus: 'disabled' });
      return res.json({ ok: true, record: getHistoryRecord(id) });
    }
    try {
      const key = buildBackupKey(type, dataUrlExt(url, type));
      const result = await backupToStorage(cfg, url, { type, key });
      const id = saveHistoryRecord({
        type,
        provider,
        model,
        sourceUrl: '',
        storageKey: result.key,
        backupStatus: 'success',
        contentType: result.contentType,
        sizeBytes: result.size,
      });
      res.json({ ok: true, record: getHistoryRecord(id) });
    } catch (e) {
      const id = saveHistoryRecord({ type, provider, model, sourceUrl: '', backupStatus: 'failed', backupError: e.message });
      res.json({ ok: true, record: getHistoryRecord(id) });
    }
    return;
  }

  const id = saveHistoryRecord({
    type,
    provider,
    model,
    sourceUrl: url,
    backupStatus: backupEnabled ? 'pending' : 'disabled',
  });
  if (backupEnabled) {
    runBackup(id, cfg, url, type);
  }
  res.json({ ok: true, record: getHistoryRecord(id) });
});

// 异步备份（仅 http(s) 链接）：成功/失败均回写记录状态，不阻塞主流程
async function runBackup(recordId, cfg, sourceUrl, type) {
  try {
    const key = buildBackupKey(type, guessExt(sourceUrl, type));
    const result = await backupToStorage(cfg, sourceUrl, { type, key });
    updateHistoryBackup(recordId, {
      storageKey: result.key,
      status: 'success',
      contentType: result.contentType,
      sizeBytes: result.size,
    });
  } catch (e) {
    updateHistoryBackup(recordId, { status: 'failed', error: e.message });
  }
}

// 数据库优化：清理库内残留的媒体数据（历史遗留的 data: URL）并压缩数据库文件
router.post('/history/optimize', (req, res) => {
  try {
    const fileSizeBefore = getDatabaseFileSize();
    const result = clearMediaDataFromDatabase();
    vacuumDatabase();
    res.json({ ok: true, ...result, fileSizeBefore, fileSizeAfter: getDatabaseFileSize() });
  } catch (e) {
    res.status(500).json({ error: `数据库优化失败：${e.message}` });
  }
});

// 删除历史记录：已备份的同步删除存储桶文件，两者都成功才算删除完成
router.delete('/history/:id', async (req, res) => {
  const record = getHistoryRecord(req.params.id);
  if (!record) return res.status(404).json({ error: '记录不存在' });
  if (record.storageKey && record.backupStatus === 'success') {
    const cfg = await loadStorageConfig();
    if (!cfg || !cfg.enabled) {
      return res.status(400).json({ error: '存储备份未启用，无法删除存储桶中的备份文件；请先在设置页配置存储后再删除' });
    }
    try {
      await deleteStorageObject(cfg, record.storageKey);
    } catch (e) {
      return res.status(502).json({ error: `存储桶文件删除失败，已保留记录：${e.message}` });
    }
  }
  deleteHistoryRecord(record.id);
  res.json({ ok: true });
});

router.get('/history', (req, res) => {
  const limit = Number.parseInt(req.query.limit || '20', 10);
  const offset = Number.parseInt(req.query.offset || '0', 10);
  const type = req.query.type === 'image' || req.query.type === 'video' ? req.query.type : undefined;
  const { records, total } = listHistoryRecords({
    type,
    limit,
    offset,
    from: req.query.from,
    to: req.query.to,
  });
  res.json({ records, total });
});

// 下载代理：从存储桶读取对象流式返回
router.get('/history/:id/download', async (req, res) => {
  const record = getHistoryRecord(req.params.id);
  if (!record || !record.storageKey) {
    return res.status(404).json({ error: '记录不存在或尚未备份成功' });
  }
  const cfg = await loadStorageConfig();
  if (!cfg || !cfg.enabled) {
    return res.status(400).json({ error: '存储备份未启用，无法下载' });
  }
  const upstream = await getStorageObject(cfg, record.storageKey).catch((e) => {
    res.status(502).json({ error: `读取存储桶失败：${e.message}` });
    return null;
  });
  if (!upstream) return;
  if (!upstream.ok) {
    return res.status(502).json({ error: `存储桶返回 ${upstream.status}` });
  }
  const ext = (record.storageKey.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '');
  const date = new Date(record.createdAt);
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  res.setHeader('Content-Type', record.contentType || upstream.headers.get('content-type') || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${record.type}-${stamp}-${record.id.slice(0, 8)}.${ext}"`);
  Readable.fromWeb(upstream.body).pipe(res);
});

module.exports = router;
