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
    prompt = COALESCE(excluded.prompt, video_tasks.prompt),
    duration = COALESCE(excluded.duration, video_tasks.duration),
    resolution = COALESCE(excluded.resolution, video_tasks.resolution),
    ratio = COALESCE(excluded.ratio, video_tasks.ratio),
    video_url = COALESCE(excluded.video_url, video_tasks.video_url),
    usage_json = COALESCE(excluded.usage_json, video_tasks.usage_json),
    error_message = COALESCE(excluded.error_message, video_tasks.error_message),
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
    prompt = COALESCE(excluded.prompt, image_tasks.prompt),
    image_urls_json = COALESCE(excluded.image_urls_json, image_tasks.image_urls_json),
    usage_json = COALESCE(excluded.usage_json, image_tasks.usage_json),
    error_message = COALESCE(excluded.error_message, image_tasks.error_message),
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
};
