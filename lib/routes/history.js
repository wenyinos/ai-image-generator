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

// 上报生成内容：落库并异步备份（存储启用时），不阻塞响应
router.post('/history', async (req, res) => {
  const { type, url, provider, model } = req.body || {};
  if (!url || (type !== 'image' && type !== 'video')) {
    return res.status(400).json({ error: 'type（image/video）与 url 为必填' });
  }
  const cfg = await loadStorageConfig();
  const backupEnabled = !!(cfg && cfg.enabled);
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

// 异步备份：成功/失败均回写记录状态，失败不阻塞主流程
async function runBackup(recordId, cfg, sourceUrl, type) {
  try {
    const ext = sourceUrl.startsWith('data:')
      ? (sourceUrl.match(/^data:image\/(\w+)/i)?.[1] || (type === 'video' ? 'mp4' : 'png'))
      : guessExt(sourceUrl, type);
    const key = buildBackupKey(type, ext);
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
  const limit = Number.parseInt(req.query.limit || '100', 10);
  const offset = Number.parseInt(req.query.offset || '0', 10);
  const type = req.query.type === 'image' || req.query.type === 'video' ? req.query.type : undefined;
  res.json({ records: listHistoryRecords({ type, limit, offset }) });
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
