/**
 * SQLite 数据库初始化和 CRUD 操作
 */

const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { VIDEO_TASK_DB_PATH } = require('./config');

// 抑制 SQLite 实验性警告
const originalEmitWarning = process.emitWarning;
process.emitWarning = function emitWarningExceptNodeSqlite(warning, ...args) {
  const message = typeof warning === 'string' ? warning : warning?.message;
  const type = typeof warning === 'string' ? args[0] : warning?.name;
  if (type === 'ExperimentalWarning' && message?.includes('SQLite is an experimental feature')) return;
  return originalEmitWarning.call(this, warning, ...args);
};
let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} finally {
  process.emitWarning = originalEmitWarning;
}

fsSync.mkdirSync(path.dirname(VIDEO_TASK_DB_PATH), { recursive: true });
const videoTaskDb = new DatabaseSync(VIDEO_TASK_DB_PATH);

videoTaskDb.exec(`
  CREATE TABLE IF NOT EXISTS video_tasks (
    task_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    prompt TEXT,
    duration INTEGER,
    resolution TEXT,
    ratio TEXT,
    video_url TEXT,
    usage_json TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);
videoTaskDb.exec(`
  CREATE TABLE IF NOT EXISTS image_tasks (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    mode TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    prompt TEXT,
    image_urls_json TEXT,
    usage_json TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);
videoTaskDb.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    source_url TEXT,
    storage_key TEXT,
    backup_status TEXT NOT NULL DEFAULT 'pending',
    backup_error TEXT,
    content_type TEXT,
    size_bytes INTEGER,
    created_at INTEGER NOT NULL
  )
`);

const historyUpdateBackupStmt = videoTaskDb.prepare(`
  UPDATE history SET storage_key = ?, backup_status = ?, backup_error = ?, content_type = ?, size_bytes = ? WHERE id = ?
`);

// 存储备份配置（单行 JSON，含存储服务商密钥）
videoTaskDb.exec(`
  CREATE TABLE IF NOT EXISTS storage_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

const storageConfigUpsertStmt = videoTaskDb.prepare(`
  INSERT INTO storage_config (key, value, updated_at) VALUES ('main', ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

function readStorageConfigRow() {
  const row = videoTaskDb.prepare(`SELECT value FROM storage_config WHERE key = 'main'`).get();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

function writeStorageConfigRow(cfg) {
  storageConfigUpsertStmt.run(JSON.stringify(cfg), Date.now());
}

function saveHistoryRecord(record) {
  const id = crypto.randomUUID();
  videoTaskDb.prepare(`
    INSERT INTO history (id, type, provider, model, source_url, storage_key, backup_status, backup_error, content_type, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    record.type === 'video' ? 'video' : 'image',
    record.provider || '',
    record.model || '',
    record.sourceUrl || '',
    record.storageKey || null,
    record.backupStatus || 'pending',
    record.backupError || null,
    record.contentType || null,
    record.sizeBytes || null,
    record.createdAt || Date.now()
  );
  return id;
}

function updateHistoryBackup(id, { storageKey, status, error, contentType, sizeBytes }) {
  historyUpdateBackupStmt.run(storageKey || null, status, error || null, contentType || null, sizeBytes || null, id);
}

function mapHistoryRecord(row) {
  return {
    id: row.id,
    type: row.type,
    provider: row.provider,
    model: row.model,
    sourceUrl: row.source_url,
    storageKey: row.storage_key || '',
    backupStatus: row.backup_status,
    backupError: row.backup_error || '',
    contentType: row.content_type || '',
    sizeBytes: row.size_bytes || null,
    createdAt: row.created_at,
  };
}

// 日期格式校验（YYYY-MM-DD）
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function listHistoryRecords({ type, limit = 100, offset = 0, from, to } = {}) {
  const safeLimit = Math.max(1, Math.min(500, limit));
  const safeOffset = Math.max(0, offset);
  const conds = [];
  const params = [];
  if (type === 'image' || type === 'video') {
    conds.push('type = ?');
    params.push(type);
  }
  if (from && DATE_RE.test(from)) {
    conds.push(`date(created_at / 1000, 'unixepoch', 'localtime') >= ?`);
    params.push(from);
  }
  if (to && DATE_RE.test(to)) {
    conds.push(`date(created_at / 1000, 'unixepoch', 'localtime') <= ?`);
    params.push(to);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const total = videoTaskDb.prepare(`SELECT COUNT(*) AS c FROM history ${where}`).get(...params).c;
  const rows = videoTaskDb
    .prepare(`SELECT * FROM history ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, safeLimit, safeOffset);
  return { records: rows.map(mapHistoryRecord), total };
}

function getHistoryRecord(id) {
  const row = videoTaskDb.prepare('SELECT * FROM history WHERE id = ?').get(id);
  return row ? mapHistoryRecord(row) : null;
}

function deleteHistoryRecord(id) {
  const result = videoTaskDb.prepare('DELETE FROM history WHERE id = ?').run(id);
  return result.changes > 0;
}

// COALESCE(NULLIF(excluded.X, ''), X) 语义：空字符串/NULL 视为"本次不更新"，
// 显式传 '-' 哨兵值可清除字段（避免任务重试成功后旧 error_message 永久残留）
const videoTaskUpsertStmt = videoTaskDb.prepare(`
  INSERT INTO video_tasks (
    task_id, provider, model, mode, status, prompt, duration, resolution, ratio,
    video_url, usage_json, error_message, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(task_id) DO UPDATE SET
    provider = COALESCE(NULLIF(excluded.provider, ''), video_tasks.provider),
    model = COALESCE(NULLIF(excluded.model, ''), video_tasks.model),
    mode = COALESCE(NULLIF(excluded.mode, ''), video_tasks.mode),
    status = COALESCE(excluded.status, video_tasks.status),
    prompt = CASE WHEN excluded.prompt = '-' THEN NULL ELSE COALESCE(excluded.prompt, video_tasks.prompt) END,
    duration = COALESCE(excluded.duration, video_tasks.duration),
    resolution = COALESCE(NULLIF(excluded.resolution, '-'), video_tasks.resolution),
    ratio = COALESCE(NULLIF(excluded.ratio, '-'), video_tasks.ratio),
    video_url = CASE WHEN excluded.video_url = '-' THEN NULL ELSE COALESCE(excluded.video_url, video_tasks.video_url) END,
    usage_json = CASE WHEN excluded.usage_json = '-' THEN NULL ELSE COALESCE(excluded.usage_json, video_tasks.usage_json) END,
    error_message = CASE WHEN excluded.error_message = '-' THEN NULL ELSE COALESCE(excluded.error_message, video_tasks.error_message) END,
    updated_at = excluded.updated_at
`);

const imageTaskUpsertStmt = videoTaskDb.prepare(`
  INSERT INTO image_tasks (
    id, task_id, mode, provider, model, status, prompt,
    image_urls_json, usage_json, error_message, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    task_id = COALESCE(excluded.task_id, image_tasks.task_id),
    mode = COALESCE(NULLIF(excluded.mode, ''), image_tasks.mode),
    provider = COALESCE(NULLIF(excluded.provider, ''), image_tasks.provider),
    model = COALESCE(NULLIF(excluded.model, ''), image_tasks.model),
    status = COALESCE(excluded.status, image_tasks.status),
    prompt = CASE WHEN excluded.prompt = '-' THEN NULL ELSE COALESCE(excluded.prompt, image_tasks.prompt) END,
    image_urls_json = CASE WHEN excluded.image_urls_json = '-' THEN NULL ELSE COALESCE(excluded.image_urls_json, image_tasks.image_urls_json) END,
    usage_json = CASE WHEN excluded.usage_json = '-' THEN NULL ELSE COALESCE(excluded.usage_json, image_tasks.usage_json) END,
    error_message = CASE WHEN excluded.error_message = '-' THEN NULL ELSE COALESCE(excluded.error_message, image_tasks.error_message) END,
    updated_at = excluded.updated_at
`);

function saveVideoTaskRecord(record) {
  if (!record?.taskId) return;
  const now = Date.now();
  videoTaskUpsertStmt.run(
    record.taskId,
    record.provider || 'dashscope',
    record.model || '',
    record.mode || '',
    record.status || record.taskStatus || 'PENDING',
    record.prompt || null,
    Number.isInteger(record.duration) ? record.duration : null,
    record.resolution || null,
    record.ratio || null,
    record.videoUrl || null,
    record.usage ? JSON.stringify(record.usage) : null,
    record.errorMessage || record.message || null,
    record.createdAt || now,
    now
  );
}

function mapVideoTaskRecord(row) {
  let usage = null;
  try {
    usage = row.usage_json ? JSON.parse(row.usage_json) : null;
  } catch (e) {
    usage = null;
  }
  return {
    taskId: row.task_id,
    provider: row.provider,
    model: row.model,
    mode: row.mode,
    status: row.status,
    prompt: row.prompt || '',
    duration: row.duration,
    resolution: row.resolution || '',
    ratio: row.ratio || '',
    videoUrl: row.video_url || '',
    usage,
    error: row.error_message || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function saveImageTaskRecord(record) {
  const id = record?.id || record?.taskId || crypto.randomUUID();
  const now = Date.now();
  imageTaskUpsertStmt.run(
    id,
    record.taskId || null,
    record.mode || 'text2image',
    record.provider || 'dashscope',
    record.model || '',
    record.status || record.taskStatus || 'SUCCEEDED',
    record.prompt || null,
    Array.isArray(record.imageUrls) ? JSON.stringify(record.imageUrls) : null,
    record.usage ? JSON.stringify(record.usage) : null,
    record.errorMessage || record.message || null,
    record.createdAt || now,
    now
  );
  return id;
}

function mapImageTaskRecord(row) {
  let imageUrls = [];
  let usage = null;
  try {
    imageUrls = row.image_urls_json ? JSON.parse(row.image_urls_json) : [];
  } catch (e) {
    imageUrls = [];
  }
  try {
    usage = row.usage_json ? JSON.parse(row.usage_json) : null;
  } catch (e) {
    usage = null;
  }
  return {
    id: row.id,
    taskId: row.task_id || '',
    mode: row.mode,
    provider: row.provider,
    model: row.model,
    status: row.status,
    prompt: row.prompt || '',
    imageUrls,
    usage,
    error: row.error_message || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  videoTaskDb,
  saveVideoTaskRecord,
  mapVideoTaskRecord,
  saveImageTaskRecord,
  mapImageTaskRecord,
  saveHistoryRecord,
  updateHistoryBackup,
  listHistoryRecords,
  getHistoryRecord,
  readStorageConfigRow,
  writeStorageConfigRow,
  deleteHistoryRecord,
};
