/**
 * AI 文生图 - Express 后端服务
 * 代理阿里云百炼 (DashScope) 文生图 API
 *
 * @copyright 2026 wenyinos. All rights reserved.
 * @license MIT
 * @see https://github.com/wenyinos/ai-image-generator
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const fsSync = require('fs');
const fs = require('fs/promises');
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

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_RELATIVE_DIR = 'uploads';
const UPLOADS_DIR = path.join(PUBLIC_DIR, UPLOADS_RELATIVE_DIR);
const VIDEO_TASK_DB_PATH = process.env.VIDEO_TASK_DB_PATH || path.join(DATA_DIR, 'video-tasks.sqlite');
const ACCESS_COOKIE_SECRET_PATH = process.env.ACCESS_COOKIE_SECRET_PATH || path.join(path.dirname(VIDEO_TASK_DB_PATH), 'access-cookie-secret');
const UPLOAD_FILE_CLEANUP_DELAY_MS = 5 * 60 * 1000;
const UPLOAD_FILE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const GENERATION_MAX_POLL_ATTEMPTS = Number.parseInt(process.env.GENERATION_MAX_POLL_ATTEMPTS || '90', 10);
const GENERATION_POLL_INTERVAL_MS = Number.parseInt(process.env.GENERATION_POLL_INTERVAL_MS || '5000', 10);
const GENERATION_REQUEST_TIMEOUT_MS = Number.parseInt(process.env.GENERATION_REQUEST_TIMEOUT_MS || '450000', 10);
const VIDEO_GENERATION_MAX_POLL_ATTEMPTS = Number.parseInt(process.env.VIDEO_GENERATION_MAX_POLL_ATTEMPTS || '288', 10);
const VIDEO_GENERATION_REQUEST_TIMEOUT_MS = Number.parseInt(process.env.VIDEO_GENERATION_REQUEST_TIMEOUT_MS || '1800000', 10);
const DASHSCOPE_MAX_POLL_ATTEMPTS = GENERATION_MAX_POLL_ATTEMPTS;
const DASHSCOPE_POLL_INTERVAL_MS = GENERATION_POLL_INTERVAL_MS;
const DASHSCOPE_VIDEO_MAX_POLL_ATTEMPTS = VIDEO_GENERATION_MAX_POLL_ATTEMPTS;
const DASHSCOPE_VIDEO_POLL_INTERVAL_MS = GENERATION_POLL_INTERVAL_MS;
const I2I_REQUEST_TIMEOUT_MS = GENERATION_REQUEST_TIMEOUT_MS;
const FREE_TIER_QUOTA_ERROR_CODE = 'AllocationQuota.FreeTierOnly';
const FREE_TIER_QUOTA_ERROR_MESSAGE = '此模型额度已用尽，请更换其他模型';
const FRONTEND_ACCESS_CONTROL_ENABLED = process.env.FRONTEND_ACCESS_CONTROL_ENABLED === '1' || process.env.FRONTEND_ACCESS_CONTROL_ENABLED === 'true';
const FRONTEND_ACCESS_KEY = typeof process.env.FRONTEND_ACCESS_KEY === 'string' ? process.env.FRONTEND_ACCESS_KEY.trim() : '';
const ACCESS_COOKIE_NAME = 'access_auth';
const ACCESS_AUTH_WINDOW_MS = Number.parseInt(process.env.ACCESS_AUTH_WINDOW_MS || '300000', 10);
const ACCESS_AUTH_MAX_ATTEMPTS = Number.parseInt(process.env.ACCESS_AUTH_MAX_ATTEMPTS || '8', 10);
const ACCESS_AUTH_LOCK_MS = Number.parseInt(process.env.ACCESS_AUTH_LOCK_MS || '900000', 10);
const ACCESS_COOKIE_SECRET = (() => {
  const envSecret = typeof process.env.ACCESS_COOKIE_SECRET === 'string' ? process.env.ACCESS_COOKIE_SECRET.trim() : '';
  if (envSecret) return envSecret;

  try {
    fsSync.mkdirSync(path.dirname(ACCESS_COOKIE_SECRET_PATH), { recursive: true });
    if (fsSync.existsSync(ACCESS_COOKIE_SECRET_PATH)) {
      const savedSecret = fsSync.readFileSync(ACCESS_COOKIE_SECRET_PATH, 'utf8').trim();
      if (savedSecret) return savedSecret;
    }
    const generatedSecret = crypto.randomBytes(32).toString('hex');
    fsSync.writeFileSync(ACCESS_COOKIE_SECRET_PATH, `${generatedSecret}\n`, { mode: 0o600 });
    return generatedSecret;
  } catch (err) {
    console.error(`⚠️ 无法保存 ACCESS_COOKIE_SECRET 到 ${ACCESS_COOKIE_SECRET_PATH}: ${err.message}`);
    process.exit(1);
  }
})();
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
const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
};

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_FILE_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'), false);
    }
  },
});

// 错误处理中间件 - 处理 multer 文件过大等错误
const handleMulterError = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '图片文件过大，最大支持 10MB' });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `文件上传错误: ${err.message}` });
  }
  next(err);
};

// DashScope API 基础地址
const BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash-image';
const GEMINI_MODEL_ALIASES = {
  'gemini-2.5-flash-preview-image': 'gemini-2.5-flash-image',
};
const VOLCENGINE_HOST = process.env.VOLCENGINE_HOST || 'visual.volcengineapi.com';
const VOLCENGINE_REGION = process.env.VOLCENGINE_REGION || 'cn-north-1';
const VOLCENGINE_SERVICE = process.env.VOLCENGINE_SERVICE || 'cv';
const VOLCENGINE_VERSION = '2022-08-31';
const VOLCENGINE_MODEL_ALIASES = {
  'jimeng-3.0': process.env.VOLCENGINE_JIMENG_30_REQ_KEY || 'jimeng_t2i_v30',
  'jimeng-3.1': process.env.VOLCENGINE_JIMENG_31_REQ_KEY || 'jimeng_t2i_v31',
  'jimeng-3.0-i2i': process.env.VOLCENGINE_JIMENG_I2I_30_REQ_KEY || 'jimeng_i2i_v30',
  'jimeng-material-pod': process.env.VOLCENGINE_JIMENG_MATERIAL_POD_REQ_KEY || 'i2i_material_extraction',
  'jimeng-material-product': process.env.VOLCENGINE_JIMENG_MATERIAL_PRODUCT_REQ_KEY || 'jimeng_i2i_extract_tiled_images',
  'jimeng-upscale': process.env.VOLCENGINE_JIMENG_UPSCALE_REQ_KEY || 'jimeng_i2i_seed3_tilesr_cvtob',
  'jimeng-inpainting': process.env.VOLCENGINE_JIMENG_INPAINT_REQ_KEY || 'jimeng_image2image_dream_inpaint',
  'jimeng-4.0': process.env.VOLCENGINE_JIMENG_40_REQ_KEY || 'jimeng_t2i_v40',
  'jimeng-4.6': process.env.VOLCENGINE_JIMENG_46_REQ_KEY || 'jimeng_seedream46_cvtob',
};

// 使用同步调用协议的模型列表
const SYNC_MODELS = new Set([
  'wan2.7-image-pro',
  'wan2.7-image',
  'wan2.6-image',
  'qwen-image-2.0-pro',
  'qwen-image-2.0',
]);

// API 端点路径
const SYNC_ENDPOINT = '/services/aigc/multimodal-generation/generation';
const ASYNC_ENDPOINT = '/services/aigc/text2image/image-synthesis';
const VIDEO_ENDPOINT = '/services/aigc/video-generation/video-synthesis';
const TASK_ENDPOINT = '/tasks/';

const VIDEO_MODELS = {
  text2video: [
    { value: 'happyhorse-1.0-t2v', label: 'happyhorse-1.0-t2v（推荐）' },
    { value: 'wan2.7-t2v', label: 'wan2.7-t2v（文生视频2.7）' },
    { value: 'wan2.7-t2v-2026-04-25', label: 'wan2.7-t2v-2026-04-25（文生视频2.7）' },
    { value: 'wan2.6-t2v', label: 'wan2.6-t2v（文生视频2.6）' },
    { value: 'wan2.5-t2v-preview', label: 'wan2.5-t2v-preview' },
    { value: 'wan2.2-t2v-plus', label: 'wan2.2-t2v-plus' },
    { value: 'wan2.2-t2v-flash', label: 'wan2.2-t2v-flash' },
    { value: 'wanx2.1-t2v-turbo', label: 'wanx2.1-t2v-turbo' },
  ],
  image2video: [
    { value: 'happyhorse-1.0-i2v', label: 'happyhorse-1.0-i2v（推荐）' },
    { value: 'wan2.7-i2v', label: 'wan2.7-i2v（图生视频2.7）' },
    { value: 'wan2.7-i2v-2026-04-25', label: 'wan2.7-i2v-2026-04-25（图生视频2.7）' },
    { value: 'wan2.6-i2v-flash', label: 'wan2.6-i2v-flash' },
    { value: 'wan2.5-i2v-preview', label: 'wan2.5-i2v-preview' },
    { value: 'wan2.2-i2v-plus', label: 'wan2.2-i2v-plus' },
    { value: 'wanx2.1-i2v-turbo', label: 'wanx2.1-i2v-turbo' },
  ],
};

// 模型默认配置 (尺寸和类型)
const MODEL_CONFIG = {
  // 万相 2.7 系列
  'wan2.7-image-pro': { size: '2K', type: 'wan' },
  'wan2.7-image': { size: '2K', type: 'wan' },
  // 万相 2.6 系列
  'wan2.6-image': { size: '1024*1024', type: 'wan' },
  'wan2.6-t2i': { size: '1280*1280', type: 'wan' },
  'wan2.5-t2i-preview': { size: '1280*1280', type: 'wan' },
  'wan2.2-t2i-flash': { size: '1024*1024', type: 'wan' },
  'wan2.2-t2i-plus': { size: '1024*1024', type: 'wan' },
  // 万相 2.1/2.0
  'wanx2.1-t2i-turbo': { size: '1024*1024', type: 'wan' },
  'wanx2.1-t2i-plus': { size: '1024*1024', type: 'wan' },
  'wanx2.0-t2i-turbo': { size: '1024*1024', type: 'wan' },
  // 千问 Qwen-Image
  'qwen-image-2.0-pro': { size: '2048*2048', type: 'qwen' },
  'qwen-image-2.0': { size: '2048*2048', type: 'qwen' },
  'qwen-image-max': { size: '1664*928', type: 'qwen' },
  'qwen-image-plus': { size: '1664*928', type: 'qwen' },
  'qwen-image': { size: '1664*928', type: 'qwen' },
  // Z-Image
  'z-image-turbo': { size: '1024*1024', type: 'wan' },
};

// 各模型允许的 size 白名单（用于服务端校验）
const ALLOWED_SIZES_BY_MODEL = {
  // 万相 2.7
  'wan2.7-image-pro': ['1K', '2K', '4K'],
  'wan2.7-image': ['1K', '2K'],
  // 万相 2.6
  'wan2.6-image': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.6-t2i': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  // 万相 2.5/2.2
  'wan2.5-t2i-preview': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.2-t2i-flash': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.2-t2i-plus': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  // 万相 2.1/2.0
  'wanx2.1-t2i-turbo': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wanx2.1-t2i-plus': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wanx2.0-t2i-turbo': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  // 千问 Qwen-Image
  'qwen-image-2.0-pro': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-2.0': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-max': ['1664*928', '928*1664', '1328*1328', '1472*1104', '1104*1472', '1024*1024'],
  'qwen-image-plus': ['1664*928', '928*1664', '1328*1328', '1472*1104', '1104*1472', '1024*1024'],
  'qwen-image': ['1664*928', '928*1664', '1328*1328', '1472*1104', '1104*1472', '1024*1024'],
  // Z-Image
  'z-image-turbo': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
};

/**
 * 判断模型是否使用同步调用协议
 * @param {string} model - 模型名称
 * @returns {boolean}
 */
function isSyncModel(model) {
  return SYNC_MODELS.has(model);
}

/**
 * 获取模型默认配置
 * @param {string} model - 模型名称
 * @returns {{size: string, type: string}}
 */
function getModelConfig(model) {
  return MODEL_CONFIG[model] || { size: '1024*1024', type: 'wan' };
}

/**
 * 从 API 响应中提取图片 URL 数组
 * @param {object} data - API 响应数据
 * @param {string} model - 模型名称
 * @returns {string[]}
 */
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
  const fallback = {
    text2video: VIDEO_MODELS.text2video,
    image2video: VIDEO_MODELS.image2video,
  };
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

function normalizeProvider(provider) {
  if (provider === 'gemini') return 'gemini';
  if (provider === 'volcengine') return 'volcengine';
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

  const accessKey = typeof process.env.VOLCENGINE_ACCESS_KEY === 'string' ? process.env.VOLCENGINE_ACCESS_KEY.trim() : '';
  const secretKey = typeof process.env.VOLCENGINE_SECRET_KEY === 'string' ? process.env.VOLCENGINE_SECRET_KEY.trim() : '';
  const sessionToken = typeof process.env.VOLCENGINE_SESSION_TOKEN === 'string' ? process.env.VOLCENGINE_SESSION_TOKEN.trim() : '';
  if (accessKey && secretKey) {
    return { accessKey, secretKey, sessionToken };
  }
  return null;
}

function getApiKey(provider, providedApiKey) {
  const trimmed = typeof providedApiKey === 'string' ? providedApiKey.trim() : '';
  if (trimmed) return trimmed;

  if (provider === 'gemini') {
    const geminiEnv = typeof process.env.GEMINI_API_KEY === 'string' ? process.env.GEMINI_API_KEY.trim() : '';
    if (geminiEnv) return geminiEnv;
    const googleEnv = typeof process.env.GOOGLE_API_KEY === 'string' ? process.env.GOOGLE_API_KEY.trim() : '';
    return googleEnv || '';
  }

  const dashscopeEnv = typeof process.env.DASHSCOPE_API_KEY === 'string' ? process.env.DASHSCOPE_API_KEY.trim() : '';
  return dashscopeEnv || '';
}

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

async function generateWithGemini({
  apiKey,
  model,
  prompt,
  n,
  imageDataUrl,
}) {
  const imageUrls = [];
  const selectedModel = normalizeGeminiModel(model);
  const requestCount = Number.isInteger(n) ? n : 1;
  const parsedImage = imageDataUrl ? parseDataUrl(imageDataUrl) : null;
  const geminiTimeoutMs = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);

  for (let i = 0; i < requestCount; i += 1) {
    const parts = [];

    if (parsedImage) {
      parts.push({
        inlineData: {
          mimeType: parsedImage.mimeType,
          data: parsedImage.data,
        },
      });
    }

    parts.push({
      text: (prompt && prompt.trim()) ? prompt.trim() : 'Generate an image',
    });

    const geminiRes = await fetchWithTimeout(
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
      geminiTimeoutMs
    );

    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      throw new Error(geminiData?.error?.message || geminiData?.message || `Gemini request failed (${geminiRes.status})`);
    }

    const generatedUrls = extractGeminiImageDataUrls(geminiData);
    if (!generatedUrls.length) {
      throw new Error('Gemini 响应中未包含图片数据');
    }
    imageUrls.push(generatedUrls[0]);
  }

  return imageUrls;
}

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

  // SDK 只签 x-content-sha256 和 x-date，不签 host 和 content-type
  const headers = {
    'x-content-sha256': bodyHash,
    'x-date': xDate,
  };
  if (sessionToken) {
    headers['x-security-token'] = sessionToken;
  }

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

  // kDate 无 VOLC 前缀（与官方 SDK 一致）
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
  if (sessionToken) {
    requestHeaders['X-Security-Token'] = sessionToken;
  }

  return { headers: requestHeaders };
}

async function generateWithVolcengine({
  credentials,
  model,
  prompt,
  n,
  size,
  width,
  height,
  watermark,
  imageUrls,
  scale,
  usePreLlm,
  seed,
  resolution,
  imageEditPrompt,
  loraWeight,
  returnTask,
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

  const submitBody = {
    req_key: reqKey,
    prompt: promptText,
  };
  if (isJimengI2IV30) {
    if (!Array.isArray(imageUrls) || imageUrls.length !== 1) {
      throw new Error('jimeng_i2i_v30 requires exactly 1 image URL');
    }
    submitBody.image_urls = [imageUrls[0]];
  } else if (isJimengUpscale) {
    if (!Array.isArray(imageUrls) || imageUrls.length !== 1) {
      throw new Error('jimeng_i2i_seed3_tilesr_cvtob requires exactly 1 image URL');
    }
    submitBody.image_urls = [imageUrls[0]];
  } else if (isJimengInpainting) {
    if (!Array.isArray(imageUrls) || imageUrls.length !== 2) {
      throw new Error('jimeng_image2image_dream_inpaint requires exactly 2 image URLs (origin + mask)');
    }
    submitBody.image_urls = [imageUrls[0], imageUrls[1]];
  } else if (isJimengMaterialPod || isJimengMaterialProduct) {
    if (!Array.isArray(imageUrls) || imageUrls.length !== 1) {
      throw new Error(`${reqKey} requires exactly 1 image URL`);
    }
    submitBody.image_urls = [imageUrls[0]];
  } else if (Array.isArray(imageUrls) && imageUrls.length) {
    submitBody.image_urls = imageUrls;
  }

  if (Number.isInteger(seed)) {
    submitBody.seed = seed;
  }
  if (isJimengT2IV3 && typeof usePreLlm === 'boolean') {
    submitBody.use_pre_llm = usePreLlm;
  }

  if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0) {
    submitBody.width = width;
    submitBody.height = height;
  } else if (!isJimengT2IV3 && typeof size === 'number' && Number.isFinite(size)) {
    submitBody.size = size;
  }
  if (typeof scale === 'number' && Number.isFinite(scale)) submitBody.scale = scale;
  if (typeof resolution === 'string' && (resolution === '4k' || resolution === '8k')) {
    submitBody.resolution = resolution;
  }
  if (isJimengMaterialPod || isJimengMaterialProduct) {
    const normalizedEditPrompt = typeof imageEditPrompt === 'string' ? imageEditPrompt.trim() : '';
    if (!normalizedEditPrompt) {
      throw new Error(`${reqKey} requires image_edit_prompt`);
    }
    submitBody.image_edit_prompt = normalizedEditPrompt;
    if (isJimengMaterialProduct) {
      // 文档与示例字段名存在差异，双写保证兼容
      submitBody.edit_prompt = normalizedEditPrompt;
    }
    if (typeof loraWeight === 'number' && Number.isFinite(loraWeight)) {
      submitBody.lora_weight = loraWeight;
    }
  }
  if (watermark === true) {
    submitBody.logo_info = JSON.stringify({ add_logo: true, position: 0, language: 0, opacity: 1 });
  }

  const baseUrl = `https://${VOLCENGINE_HOST}`;
  const submitQuery = { Action: 'CVSync2AsyncSubmitTask', Version: VOLCENGINE_VERSION };
  const submitBodyText = JSON.stringify(submitBody);

  const submitAuth = volcengineSign({
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken || '',
    bodyText: submitBodyText,
    queryParams: submitQuery,
    host: VOLCENGINE_HOST,
    service: VOLCENGINE_SERVICE,
    region: VOLCENGINE_REGION,
  });

  const submitQueryString = volcengineCanonicalQuery(submitQuery);
  const submitRes = await fetchWithTimeout(
    `${baseUrl}/?${submitQueryString}`,
    { method: 'POST', headers: submitAuth.headers, body: submitBodyText },
    volcengineTimeoutMs
  );
  const submitText = await submitRes.text().catch(() => '');
  let submitData;
  try {
    submitData = submitText ? JSON.parse(submitText) : {};
  } catch (e) {
    submitData = {};
  }

  if (submitData?.code !== 10000) {
    if (submitRes.status === 401 || submitData?.ResponseMetadata?.Error?.Code === 'SignatureDoesNotMatch') {
      const err = submitData?.ResponseMetadata?.Error || {};
      const requestId = submitData?.request_id || submitData?.ResponseMetadata?.RequestId || '';
      throw new Error(
        `Volcengine 鉴权失败(401): ${err.Message || 'Sign error'}` +
        `${requestId ? `, request_id=${requestId}` : ''}` +
        '。请确认使用的是火山引擎 AccessKey/SecretKey（不是 Ark API Key）；若为临时凭证还需携带 SessionToken。并检查账号权限、VOLCENGINE_REGION/VOLCENGINE_SERVICE 及服务器时间。'
      );
    }
    throw new Error(submitData?.message || submitData?.ResponseMetadata?.Error?.Message || `Volcengine submit failed (${submitRes.status})`);
  }
  const taskId = submitData?.data?.task_id;
  if (!taskId) throw new Error('Volcengine 提交成功但未返回 task_id');
  if (returnTask) return { taskId, taskStatus: 'PENDING', model: reqKey };

  const getResultQuery = { Action: 'CVSync2AsyncGetResult', Version: VOLCENGINE_VERSION };
  const getResultBody = {
    req_key: reqKey,
    task_id: taskId,
    req_json: JSON.stringify({ return_url: true }),
  };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

    const getResultBodyText = JSON.stringify(getResultBody);
    const getResultAuth = volcengineSign({
      accessKey: credentials.accessKey,
      secretKey: credentials.secretKey,
      sessionToken: credentials.sessionToken || '',
      bodyText: getResultBodyText,
      queryParams: getResultQuery,
      host: VOLCENGINE_HOST,
      service: VOLCENGINE_SERVICE,
      region: VOLCENGINE_REGION,
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

function normalizeVolcengineTaskStatus(status) {
  if (status === 'done') return 'SUCCEEDED';
  if (status === 'failed') return 'FAILED';
  if (status === 'running' || status === 'processing') return 'RUNNING';
  return 'PENDING';
}

async function fetchVolcengineTaskResult({ credentials, model, taskId }) {
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
  const query = { Action: 'CVSync2AsyncGetResult', Version: VOLCENGINE_VERSION };
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
  const preset = {
    '1K': 1024 * 1024,
    '2K': 2048 * 2048,
    '4K': 4096 * 4096,
  };
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
    return rawValue
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(v => isAllowedImageRef(v));
  }
  if (typeof rawValue !== 'string') return [];
  return rawValue
    .split(/[\n,\s]+/)
    .map(v => v.trim())
    .filter(v => isAllowedImageRef(v));
}

function buildBaseUrl(req) {
  const configuredBaseUrl = typeof process.env.PUBLIC_BASE_URL === 'string'
    ? process.env.PUBLIC_BASE_URL.trim()
    : '';
  if (configuredBaseUrl) {
    const normalizedBaseUrl = configuredBaseUrl.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(normalizedBaseUrl)) {
      throw new Error('PUBLIC_BASE_URL 必须以 http:// 或 https:// 开头');
    }
    return normalizedBaseUrl;
  }

  const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto'].split(',')[0].trim()
    : '';
  const protocol = forwardedProto || req.protocol || 'http';

  const forwardedHostHeader = typeof req.headers['x-forwarded-host'] === 'string'
    ? req.headers['x-forwarded-host'].split(',')[0].trim()
    : '';
  const forwardedHeader = typeof req.headers.forwarded === 'string'
    ? req.headers.forwarded
    : '';
  const forwardedHostMatch = forwardedHeader.match(/host=([^;,\s]+)/i);
  const forwardedHost = forwardedHostMatch ? forwardedHostMatch[1].replace(/^"|"$/g, '') : '';
  const host = forwardedHostHeader || forwardedHost || req.get('host');
  if (!host) {
    throw new Error('无法确定请求主机以构建公网图片 URL');
  }
  const hostName = host.split(':')[0].toLowerCase();
  const isPrivateHost = (
    hostName === 'localhost' ||
    hostName === '127.0.0.1' ||
    hostName === '::1' ||
    hostName.endsWith('.local') ||
    /^10\./.test(hostName) ||
    /^192\.168\./.test(hostName) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostName)
  );
  if (isPrivateHost) {
    throw new Error('当前服务地址是本地/内网地址，上游生成服务无法访问上传图片。请配置 PUBLIC_BASE_URL 为公网可访问地址。');
  }
  return `${protocol}://${host}`;
}

async function saveUploadedImageAsPublicUrl(req, imageFile) {
  if (!imageFile?.buffer || !Buffer.isBuffer(imageFile.buffer)) {
    return { publicUrl: '', filePath: '' };
  }
  const publicBaseUrl = buildBaseUrl(req);
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const fileExt = MIME_EXTENSION_MAP[imageFile.mimetype] || '.png';
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${fileExt}`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  await fs.writeFile(filePath, imageFile.buffer);
  return {
    publicUrl: `${publicBaseUrl}/${UPLOADS_RELATIVE_DIR}/${fileName}`,
    filePath,
  };
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
      if (error?.code !== 'ENOENT') {
        console.error(`清理上传文件失败: ${resolvedPath}`, error);
      }
    }
  }, delayMs);
  if (typeof timer.unref === 'function') timer.unref();
}

function createRateLimiter({ windowMs, max, keyGenerator }) {
  const hits = new Map();
  const getKey = typeof keyGenerator === 'function' ? keyGenerator : (req) => getClientIp(req);

  // 定期清理过期条目，防止内存泄漏
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs * 2);
  if (typeof cleanupInterval.unref === 'function') cleanupInterval.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = getKey(req);
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }

    return next();
  };
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader || typeof cookieHeader !== 'string') return {};
  return cookieHeader.split(';').reduce((acc, item) => {
    const [rawKey, ...rest] = item.split('=');
    const key = rawKey ? rawKey.trim() : '';
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=').trim());
    return acc;
  }, {});
}

function buildAccessCookieValue() {
  return crypto
    .createHmac('sha256', ACCESS_COOKIE_SECRET)
    .update(`frontend-access:${FRONTEND_ACCESS_KEY}`)
    .digest('hex');
}

function isAccessAuthorized(req) {
  if (!FRONTEND_ACCESS_CONTROL_ENABLED) return true;
  if (!FRONTEND_ACCESS_KEY) return true;
  const cookies = parseCookies(req);
  return cookies[ACCESS_COOKIE_NAME] === buildAccessCookieValue();
}

function setAccessCookie(res) {
  const maxAge = 7 * 24 * 60 * 60;
  const secureAttr = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${ACCESS_COOKIE_NAME}=${buildAccessCookieValue()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureAttr}`);
}

function clearAccessCookie(res) {
  const secureAttr = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${ACCESS_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureAttr}`);
}

const accessAuthHits = new Map();

// 定期清理过期的访问控制记录
const accessAuthCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of accessAuthHits) {
    if (entry.lockUntil <= now && entry.resetAt <= now) accessAuthHits.delete(key);
  }
}, ACCESS_AUTH_WINDOW_MS * 2);
if (typeof accessAuthCleanupInterval.unref === 'function') accessAuthCleanupInterval.unref();

function checkAccessAuthThrottle(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const current = accessAuthHits.get(ip);
  if (!current) {
    const initial = { count: 0, resetAt: now + ACCESS_AUTH_WINDOW_MS, lockUntil: 0 };
    accessAuthHits.set(ip, initial);
    return { blocked: false, state: initial };
  }
  if (current.lockUntil && current.lockUntil > now) {
    return { blocked: true, retryAfterSec: Math.ceil((current.lockUntil - now) / 1000), state: current };
  }
  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + ACCESS_AUTH_WINDOW_MS;
    current.lockUntil = 0;
  }
  return { blocked: false, state: current };
}

function markAccessAuthFailure(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const current = accessAuthHits.get(ip) || { count: 0, resetAt: now + ACCESS_AUTH_WINDOW_MS, lockUntil: 0 };
  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + ACCESS_AUTH_WINDOW_MS;
    current.lockUntil = 0;
  }
  current.count += 1;
  if (current.count >= ACCESS_AUTH_MAX_ATTEMPTS) {
    current.lockUntil = now + ACCESS_AUTH_LOCK_MS;
    current.count = 0;
    current.resetAt = now + ACCESS_AUTH_WINDOW_MS;
  }
  accessAuthHits.set(ip, current);
  return current;
}

function clearAccessAuthFailure(req) {
  const ip = getClientIp(req);
  accessAuthHits.delete(ip);
}

// 中间件
const corsOriginsEnv = process.env.CORS_ORIGIN;
const corsOrigins = corsOriginsEnv
  ? corsOriginsEnv.split(',').map(s => s.trim()).filter(Boolean)
  : null;

app.use(cors({
  origin: (origin, callback) => {
    if (!corsOrigins || corsOrigins.length === 0) return callback(null, true);
    if (!origin) return callback(null, true);
    if (corsOrigins.includes('*')) return callback(null, true);
    return callback(null, corsOrigins.includes(origin));
  },
}));

// 安全头中间件
app.use((req, res, next) => {
  // 防止 MIME 类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  // XSS 防护
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // 控制 referrer 信息
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 生产环境启用 HSTS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // 内容安全策略 - 限制资源加载来源
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' https://cdn.jsdelivr.net",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '));
  next();
});

const apiRateLimitWindowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const apiRateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX || '30', 10);
if (Number.isFinite(apiRateLimitWindowMs) && Number.isFinite(apiRateLimitMax) && apiRateLimitWindowMs > 0 && apiRateLimitMax > 0) {
  app.use('/api/', createRateLimiter({ windowMs: apiRateLimitWindowMs, max: apiRateLimitMax }));
}

app.use(express.json({ limit: '50mb' })); // 增加 body 限制,因为 base64 图片 会很大
app.use(express.urlencoded({ extended: false }));

app.get('/unlock', (req, res) => {
  if (!FRONTEND_ACCESS_CONTROL_ENABLED || !FRONTEND_ACCESS_KEY || isAccessAuthorized(req)) {
    return res.redirect('/');
  }
  return res.status(200).send(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>访问验证 - AI 图片生成器</title>
<link rel="icon" href="favicon/favicon.ico" type="image/x-icon">
<link rel="apple-touch-icon" href="favicon/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="favicon/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon/favicon-16x16.png">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
<style>
body{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh}
.main-card{border:none;border-radius:1rem;box-shadow:0 .5rem 1rem rgba(0,0,0,.15)}
</style>
</head>
<body>
<div class="container py-5">
<div class="row justify-content-center align-items-center" style="min-height:80vh">
<div class="col-sm-10 col-md-8 col-lg-6 col-xl-5">
<div class="card main-card">
<div class="card-body p-4 p-md-5">
<form id="unlockForm" autocomplete="on">
<h3 class="fw-bold mb-2"><i class="bi bi-shield-lock"></i> 访问验证</h3>
<p class="text-muted mb-4">请输入前端访问密钥以继续使用</p>
<div class="mb-3">
<label for="accessKeyInput" class="form-label">访问密钥</label>
<div class="input-group">
<input type="password" class="form-control form-control-lg" id="accessKeyInput" name="accessKey" autocomplete="current-password" placeholder="请输入访问密钥" required />
<button class="btn btn-outline-secondary" type="button" id="toggleKeyBtn"><i class="bi bi-eye"></i></button>
</div>
</div>
<div class="alert alert-danger d-none py-2 mb-3" id="errMsg" role="alert"></div>
<div class="d-grid">
<button class="btn btn-primary btn-lg" type="submit" id="submitBtn"><i class="bi bi-box-arrow-in-right"></i> 验证并进入</button>
</div>
</form>
</div>
</div>
</div>
</div>
<footer class="text-center text-white py-4">
<small>&copy; 2026 <a href="https://github.com/wenyinos" target="_blank" class="text-white text-decoration-none">wenyinos</a>. All rights reserved.</small>
</footer>
</div>
<script>
(function(){
const form=document.getElementById('unlockForm');
const input=document.getElementById('accessKeyInput');
const errMsg=document.getElementById('errMsg');
const submitBtn=document.getElementById('submitBtn');
const toggleBtn=document.getElementById('toggleKeyBtn');
var LS_KEY='access_auth_key';
var TTL_MS=72*60*60*1000;
function showError(msg){errMsg.textContent=msg;errMsg.classList.remove('d-none');}
function hideError(){errMsg.textContent='';errMsg.classList.add('d-none');}
function setLoading(loading){submitBtn.disabled=loading;submitBtn.innerHTML=loading?'<span class="spinner-border spinner-border-sm me-2"></span>验证中...':'<i class="bi bi-box-arrow-in-right"></i> 验证并进入';}
function loadSavedKey(){try{var raw=localStorage.getItem(LS_KEY);if(!raw)return'';var obj=JSON.parse(raw);if(!obj||!obj.key||!obj.ts)return'';if(Date.now()-obj.ts>TTL_MS){localStorage.removeItem(LS_KEY);return'';}return obj.key;}catch(e){return'';}}
function saveKey(key){try{localStorage.setItem(LS_KEY,JSON.stringify({key:key,ts:Date.now()}));}catch(e){}}
toggleBtn.addEventListener('click',function(){var isPassword=input.type==='password';input.type=isPassword?'text':'password';this.querySelector('i').className=isPassword?'bi bi-eye-slash':'bi bi-eye';});
var saved=loadSavedKey();
if(saved){input.value=saved;}
form.addEventListener('submit',async function(e){
e.preventDefault();hideError();
var key=(input.value||'').trim();
if(!key){showError('请输入访问密钥');return;}
setLoading(true);
try{
var body=new URLSearchParams();body.set('accessKey',key);
var res=await fetch('/api/access-auth',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
var data=await res.json().catch(function(){return{error:'验证失败'};});
if(!res.ok){showError(data.error||'验证失败');setLoading(false);return;}
saveKey(key);
window.location.href='/';
}catch(err){showError('网络错误，请重试');setLoading(false);}
});
})();
</script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`);
});

app.post('/api/access-auth', (req, res) => {
  if (!FRONTEND_ACCESS_CONTROL_ENABLED || !FRONTEND_ACCESS_KEY) {
    return res.json({ ok: true, enabled: false });
  }
  const throttle = checkAccessAuthThrottle(req);
  if (throttle.blocked) {
    res.setHeader('Retry-After', String(throttle.retryAfterSec));
    return res.status(429).json({ error: `尝试次数过多，请 ${throttle.retryAfterSec} 秒后再试` });
  }
  const input = typeof req.body?.accessKey === 'string' ? req.body.accessKey.trim() : '';
  if (!input || input !== FRONTEND_ACCESS_KEY) {
    const state = markAccessAuthFailure(req);
    const now = Date.now();
    if (state.lockUntil && state.lockUntil > now) {
      const retryAfterSec = Math.ceil((state.lockUntil - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: `尝试次数过多，请 ${retryAfterSec} 秒后再试` });
    }
    return res.status(401).json({ error: '访问密钥错误' });
  }
  clearAccessAuthFailure(req);
  setAccessCookie(res);
  return res.json({ ok: true });
});

app.post('/api/access-logout', (req, res) => {
  clearAccessCookie(res);
  return res.json({ ok: true });
});

app.use((req, res, next) => {
  if (!FRONTEND_ACCESS_CONTROL_ENABLED || !FRONTEND_ACCESS_KEY) return next();
  if (req.path === '/unlock' || req.path === '/api/access-auth' || req.path === '/api/access-logout') return next();
  if (req.path.startsWith(`/${UPLOADS_RELATIVE_DIR}/`)) return next();
  if (isAccessAuthorized(req)) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: '未授权：需要访问密钥' });
  }
  return res.redirect('/unlock');
});

app.use(express.static(PUBLIC_DIR));

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// 允许的 provider 和 model 白名单
const ALLOWED_PROVIDERS = ['dashscope', 'gemini', 'volcengine'];
const ALLOWED_MODELS = Object.keys(MODEL_CONFIG);

app.post('/api/video-models', async (req, res) => {
  const models = await getDashscopeVideoModels(req.body?.apiKey);
  res.json(models);
});

app.get('/api/video-task-records', (req, res) => {
  const limit = Math.max(1, Math.min(200, Number.parseInt(req.query.limit || '100', 10) || 100));
  const rows = videoTaskDb
    .prepare('SELECT * FROM video_tasks ORDER BY created_at DESC LIMIT ?')
    .all(limit);
  res.json({ records: rows.map(mapVideoTaskRecord) });
});

app.delete('/api/video-task-records', (req, res) => {
  videoTaskDb.prepare('DELETE FROM video_tasks').run();
  res.json({ ok: true });
});

app.post('/api/video-task-records/import', (req, res) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  let imported = 0;
  records.slice(0, 200).forEach((record) => {
    if (!record?.taskId || typeof record.taskId !== 'string') return;
    saveVideoTaskRecord({
      taskId: record.taskId,
      provider: record.provider || 'dashscope',
      model: record.model || '',
      mode: record.mode || '',
      status: record.status || 'PENDING',
      prompt: record.prompt || '',
      duration: Number.isInteger(record.duration) ? record.duration : null,
      resolution: record.resolution || '',
      ratio: record.ratio || '',
      videoUrl: record.videoUrl || '',
      usage: record.usage || null,
      errorMessage: record.error || '',
      createdAt: Number.isInteger(record.createdAt) ? record.createdAt : Date.now(),
    });
    imported += 1;
  });
  res.json({ imported });
});

app.get('/api/image-task-records', (req, res) => {
  const limit = Math.max(1, Math.min(200, Number.parseInt(req.query.limit || '100', 10) || 100));
  const mode = req.query.mode === 'image2image' ? 'image2image' : 'text2image';
  const rows = videoTaskDb
    .prepare('SELECT * FROM image_tasks WHERE mode = ? ORDER BY created_at DESC LIMIT ?')
    .all(mode, limit);
  res.json({ records: rows.map(mapImageTaskRecord) });
});

app.post('/api/dashscope-task-status', async (req, res) => {
  const { apiKey, taskId, model, resultType } = req.body || {};
  const resolvedApiKey = getApiKey('dashscope', apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: '请提供 DashScope API Key' });
  if (!taskId || typeof taskId !== 'string') return res.status(400).json({ error: '缺少 taskId' });

  try {
    const pollRes = await fetchWithTimeout(`${BASE_URL}${TASK_ENDPOINT}${taskId}`, {
      headers: { Authorization: `Bearer ${resolvedApiKey}` },
    }, GENERATION_REQUEST_TIMEOUT_MS);
    const pollData = await pollRes.json();
    if (!pollRes.ok) return res.status(pollRes.status).json({ error: formatUpstreamError(pollData, '查询任务失败') });

    const output = pollData.output || {};
    const status = output.task_status || 'UNKNOWN';
    const isTaskFailure = status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN';
    const message = isTaskFailure
      ? formatUpstreamError(pollData, output.message || `任务状态异常：${status}`)
      : (output.message || '');
    const payload = {
      provider: 'dashscope',
      taskId,
      taskStatus: status,
      requestId: pollData.request_id || '',
      submitTime: output.submit_time || '',
      scheduledTime: output.scheduled_time || '',
      endTime: output.end_time || '',
      message,
      usage: pollData.usage || null,
    };
    if (status === 'SUCCEEDED') {
      if (resultType === 'video') {
        payload.videoUrl = extractVideoUrl(pollData);
      } else {
        payload.imageUrls = extractImageUrls(pollData, model);
      }
    }
    if (resultType === 'video') {
      saveVideoTaskRecord({
        taskId,
        provider: 'dashscope',
        model,
        status,
        videoUrl: payload.videoUrl,
        usage: payload.usage,
        message,
      });
    } else {
      saveImageTaskRecord({
        id: taskId,
        taskId,
        mode: req.body?.mode || 'text2image',
        provider: 'dashscope',
        model,
        status,
        imageUrls: payload.imageUrls,
        usage: payload.usage,
        message,
      });
    }
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: formatUpstreamError(err.message) });
  }
});

app.post('/api/volcengine-task-status', async (req, res) => {
  const { apiKey, taskId, model } = req.body || {};
  const credentials = parseVolcengineCredentials(apiKey);
  if (apiKey && !credentials) return res.status(400).json({ error: 'Volcengine 凭证格式无效，请使用 AK:SK 格式' });
  if (!credentials) return res.status(400).json({ error: '请提供 Volcengine AK/SK' });

  try {
    const { resultData } = await fetchVolcengineTaskResult({ credentials, model, taskId });
    const rawStatus = resultData?.data?.status || '';
    const taskStatus = normalizeVolcengineTaskStatus(rawStatus);
    const payload = {
      provider: 'volcengine',
      taskId,
      taskStatus,
      rawStatus,
      requestId: resultData?.request_id || resultData?.ResponseMetadata?.RequestId || '',
      message: resultData?.data?.msg || resultData?.message || '',
    };
    if (taskStatus === 'SUCCEEDED') payload.imageUrls = extractVolcengineImageUrls(resultData);
    saveImageTaskRecord({
      id: taskId,
      taskId,
      mode: req.body?.mode || 'text2image',
      provider: 'volcengine',
      model,
      status: taskStatus,
      imageUrls: payload.imageUrls,
      message: payload.message,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: formatUpstreamError(err.message) });
  }
});

app.post('/api/generate-video', (req, res, next) => {
  upload.fields([
    { name: 'firstFrame', maxCount: 1 },
    { name: 'lastFrame', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  const { apiKey, model, mode, prompt, parameters } = req.body;
  const progressMode = req.body.progressMode === true || req.body.progressMode === 'true';
  const selectedMode = mode === 'image2video' ? 'image2video' : 'text2video';
  const selectedModel = typeof model === 'string' && model.trim()
    ? model.trim()
    : VIDEO_MODELS[selectedMode][0].value;
  const resolvedApiKey = getApiKey('dashscope', apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: '请提供 DashScope API Key' });
  if (selectedMode === 'text2video' && (!prompt || !prompt.trim())) {
    return res.status(400).json({ error: '请输入视频描述' });
  }

  let params;
  try {
    params = parameters ? JSON.parse(parameters) : {};
  } catch (e) {
    params = {};
  }

  const promptErr = validateStringMaxLen('prompt', prompt, 5000);
  if (promptErr) return res.status(400).json({ error: promptErr });
  const negativeErr = validateStringMaxLen('negative_prompt', params.negative_prompt, 500);
  if (negativeErr) return res.status(400).json({ error: negativeErr });
  const duration = params.duration === undefined ? 5 : params.duration;
  const minDuration = selectedModel.startsWith('happyhorse-1.0-') ? 3 : 2;
  const durationErr = validateIntegerInRange('duration', duration, minDuration, 15);
  if (durationErr) return res.status(400).json({ error: durationErr });
  if (params.seed !== undefined) {
    const seedErr = validateIntegerInRange('seed', params.seed, 0, 2147483647);
    if (seedErr) return res.status(400).json({ error: seedErr });
  }

  const firstFrame = req.files?.firstFrame?.[0];
  const lastFrame = req.files?.lastFrame?.[0];
  const imageDataUrl = firstFrame ? `data:${firstFrame.mimetype};base64,${firstFrame.buffer.toString('base64')}` : '';
  const lastFrameDataUrl = lastFrame ? `data:${lastFrame.mimetype};base64,${lastFrame.buffer.toString('base64')}` : '';
  if (selectedMode === 'image2video' && !imageDataUrl) {
    return res.status(400).json({ error: '图生视频需要上传首帧图片' });
  }

  const input = {};
  if (prompt && prompt.trim()) input.prompt = prompt.trim();
  if (params.negative_prompt) input.negative_prompt = params.negative_prompt;
  let uploadedVideoFrameMeta = null;
  if (selectedMode === 'image2video' && selectedModel === 'happyhorse-1.0-i2v') {
    try {
      uploadedVideoFrameMeta = await saveUploadedImageAsPublicUrl(req, firstFrame);
      if (uploadedVideoFrameMeta.filePath) {
        scheduleUploadedFileCleanup(uploadedVideoFrameMeta.filePath, VIDEO_GENERATION_REQUEST_TIMEOUT_MS + UPLOAD_FILE_CLEANUP_DELAY_MS);
      }
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    input.media = [{ type: 'first_frame', url: uploadedVideoFrameMeta.publicUrl }];
  } else if (selectedMode === 'image2video' && selectedModel.startsWith('wan2.7-i2v')) {
    input.media = [{ type: 'first_frame', url: imageDataUrl }];
    if (lastFrameDataUrl) input.media.push({ type: 'last_frame', url: lastFrameDataUrl });
  } else if (selectedMode === 'image2video') {
    input.img_url = imageDataUrl;
  }

  const requestParams = {
    resolution: params.resolution || '720P',
    duration,
    prompt_extend: params.prompt_extend !== false,
    watermark: params.watermark === true,
  };
  if (selectedMode === 'text2video' && params.ratio) {
    if (selectedModel.startsWith('wan2.7-t2v') || selectedModel === 'happyhorse-1.0-t2v') {
      requestParams.ratio = params.ratio;
    } else {
      const sizes = {
        '720P': { '16:9': '1280*720', '9:16': '720*1280', '1:1': '960*960', '4:3': '1088*832', '3:4': '832*1088' },
        '1080P': { '16:9': '1920*1080', '9:16': '1080*1920', '1:1': '1440*1440', '4:3': '1632*1248', '3:4': '1248*1632' },
      };
      requestParams.size = sizes[requestParams.resolution]?.[params.ratio] || '1280*720';
      delete requestParams.resolution;
    }
  }
  if (params.seed !== undefined) requestParams.seed = params.seed;

  try {
    const submitRes = await fetchWithTimeout(
      `${BASE_URL}${VIDEO_ENDPOINT}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedApiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({ model: selectedModel, input, parameters: requestParams }),
      },
      VIDEO_GENERATION_REQUEST_TIMEOUT_MS
    );
    const submitData = await submitRes.json();
    if (!submitRes.ok) return res.status(submitRes.status).json({ error: formatUpstreamError(submitData) });
    const taskId = submitData.output?.task_id;
    if (!taskId) return res.status(500).json({ error: '未返回 task_id' });
    saveVideoTaskRecord({
      taskId,
      provider: 'dashscope',
      model: selectedModel,
      mode: selectedMode,
      status: submitData.output?.task_status || 'PENDING',
      prompt: prompt?.trim() || '',
      duration,
      resolution: requestParams.resolution || params.resolution || '',
      ratio: requestParams.ratio || params.ratio || '',
    });
    if (progressMode) {
      return res.json({
        provider: 'dashscope',
        resultType: 'video',
        taskId,
        taskStatus: submitData.output?.task_status || 'PENDING',
        model: selectedModel,
      });
    }

    for (let attempt = 0; attempt < DASHSCOPE_VIDEO_MAX_POLL_ATTEMPTS; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, DASHSCOPE_VIDEO_POLL_INTERVAL_MS));
      const pollRes = await fetchWithTimeout(`${BASE_URL}${TASK_ENDPOINT}${taskId}`, {
        headers: { Authorization: `Bearer ${resolvedApiKey}` },
      }, VIDEO_GENERATION_REQUEST_TIMEOUT_MS);
      const pollData = await pollRes.json();
      const status = pollData.output?.task_status;
      if (status === 'SUCCEEDED') {
        const videoUrl = extractVideoUrl(pollData);
        if (!videoUrl) return res.status(500).json({ error: '响应中未包含视频 URL' });
        saveVideoTaskRecord({ taskId, status, videoUrl, usage: pollData.usage || null });
        return res.json({ videoUrl, taskId, usage: pollData.usage || null });
      }
      if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
        const errorMessage = formatUpstreamError(pollData, `视频任务失败：${status}`);
        saveVideoTaskRecord({ taskId, status, message: errorMessage });
        return res.status(500).json({ error: errorMessage });
      }
    }
    return res.status(504).json({ error: '视频任务超时' });
  } catch (err) {
    if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
      return res.status(504).json({ error: '上游请求超时' });
    }
    return res.status(500).json({ error: formatUpstreamError(err.message) });
  }
});

/**
 * 图片生成接口 (文生图)
 * POST /api/generate-image
 * 请求体: { prompt, apiKey, model, parameters: { n, size, seed, negative_prompt, prompt_extend, watermark } }
 * 响应: { imageUrls: string[] }
 */
app.post('/api/generate-image', async (req, res) => {
  const { prompt, apiKey, model, parameters = {}, provider, progressMode } = req.body;
  const wantsProgress = progressMode === true || progressMode === 'true';
  
  // 安全改进: 验证 provider 白名单
  const selectedProvider = normalizeProvider(provider);
  if (!ALLOWED_PROVIDERS.includes(selectedProvider)) {
    return res.status(400).json({ error: '无效的 provider' });
  }
  
  const volcengineCredentials = selectedProvider === 'volcengine'
    ? parseVolcengineCredentials(apiKey)
    : null;
  if (selectedProvider === 'volcengine' && apiKey && !volcengineCredentials) {
    return res.status(400).json({ error: 'Volcengine 凭证格式无效，请使用 AK:SK 格式' });
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: '请输入图片描述' });
  }
  const resolvedApiKey = selectedProvider === 'volcengine'
    ? (volcengineCredentials ? `${volcengineCredentials.accessKey}:***` : '')
    : getApiKey(selectedProvider, apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: '请提供 API Key' });

  const selectedModel = selectedProvider === 'gemini'
    ? normalizeGeminiModel(model)
    : (selectedProvider === 'volcengine'
      ? normalizeVolcengineModel(model)
      : (model || 'wan2.6-t2i'));
  
  // 安全改进: 验证 model 白名单
  if (selectedProvider === 'dashscope' && !ALLOWED_MODELS.includes(selectedModel)) {
    return res.status(400).json({ error: '无效的模型' });
  }
  
  const config = getModelConfig(selectedModel);
  const authHeader = { 'Authorization': `Bearer ${resolvedApiKey}` };

  // 解析生成参数
  const size = parameters.size || config.size;
  const width = Number.isInteger(parameters.width) ? parameters.width : undefined;
  const height = Number.isInteger(parameters.height) ? parameters.height : undefined;
  const n = parameters.n === undefined ? 1 : parameters.n;
  const seed = parameters.seed;
  const negativePrompt = parameters.negative_prompt;
  const promptExtend = parameters.prompt_extend !== undefined ? parameters.prompt_extend : true;
  const watermark = parameters.watermark || false;

  const promptErr = validateStringMaxLen('prompt', prompt, 4000);
  if (promptErr) return res.status(400).json({ error: promptErr });
  const negativeErr = validateStringMaxLen('negative_prompt', negativePrompt, 4000);
  if (negativeErr) return res.status(400).json({ error: negativeErr });

  const nErr = validateIntegerInRange('n', n, 1, 4);
  if (nErr) return res.status(400).json({ error: nErr });

  if (seed !== undefined) {
    const seedMin = selectedProvider === 'volcengine' ? -1 : 0;
    const seedErr = validateIntegerInRange('seed', seed, seedMin, 2147483647);
    if (seedErr) return res.status(400).json({ error: seedErr });
  }

  if (selectedProvider === 'dashscope') {
    const sizeErr = validateSize(selectedModel, size);
    if (sizeErr) return res.status(400).json({ error: sizeErr });
  }

  const dashscopeTimeoutMs = Number.parseInt(process.env.DASHSCOPE_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);

  try {
    if (selectedProvider === 'gemini') {
      const imageUrls = await generateWithGemini({
        apiKey: resolvedApiKey,
        model: selectedModel,
        prompt,
        n,
      });
      saveImageTaskRecord({ mode: 'text2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls });
      return res.json({ imageUrls });
    }

    if (selectedProvider === 'volcengine') {
      const volcengineResult = await generateWithVolcengine({
        credentials: volcengineCredentials,
        model: selectedModel,
        prompt,
        n,
        size: parseSizeToArea(size),
        width,
        height,
        watermark,
        usePreLlm: promptExtend,
        seed,
        returnTask: wantsProgress,
      });
      if (wantsProgress) {
        saveImageTaskRecord({
          id: volcengineResult.taskId,
          taskId: volcengineResult.taskId,
          mode: 'text2image',
          provider: 'volcengine',
          model: selectedModel,
          status: volcengineResult.taskStatus,
          prompt,
        });
        return res.json({
          provider: 'volcengine',
          resultType: 'image',
          taskId: volcengineResult.taskId,
          taskStatus: volcengineResult.taskStatus,
          model: selectedModel,
        });
      }
      saveImageTaskRecord({ mode: 'text2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls: volcengineResult });
      return res.json({ imageUrls: volcengineResult });
    }

    // 同步模型调用
    if (isSyncModel(selectedModel)) {
      const syncParams = {
        size,
        n,
        prompt_extend: promptExtend,
        watermark,
      };
      if (seed !== undefined) syncParams.seed = seed;
      if (negativePrompt) syncParams.negative_prompt = negativePrompt;

      const syncRes = await fetchWithTimeout(
        `${BASE_URL}${SYNC_ENDPOINT}`,
        {
          method: 'POST',
          headers: {
            ...authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedModel,
            input: {
              messages: [{ role: 'user', content: [{ text: prompt.trim() }] }],
            },
            parameters: syncParams,
          }),
        },
        dashscopeTimeoutMs
      );

      const syncData = await syncRes.json();

      if (!syncRes.ok) {
        return res.status(syncRes.status).json({ error: formatUpstreamError(syncData) });
      }

      const imageUrls = extractImageUrls(syncData, selectedModel);
      if (!imageUrls.length) {
        return res.status(500).json({ error: '响应中未包含图片 URL' });
      }

      saveImageTaskRecord({ mode: 'text2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls });
      return res.json({ imageUrls });
    }

    // 异步模型调用
    const asyncParams = {
      size,
      n,
    };
    if (seed !== undefined) asyncParams.seed = seed;
    if (negativePrompt) asyncParams.negative_prompt = negativePrompt;
    if (promptExtend) asyncParams.prompt_extend = promptExtend;
    if (watermark) asyncParams.watermark = watermark;

    const submitRes = await fetchWithTimeout(
      `${BASE_URL}${ASYNC_ENDPOINT}`,
      {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: selectedModel,
          input: { prompt: prompt.trim() },
          parameters: asyncParams,
        }),
      },
      dashscopeTimeoutMs
    );

    const submitData = await submitRes.json();

    if (!submitRes.ok) {
      return res.status(submitRes.status).json({ error: formatUpstreamError(submitData) });
    }

    const taskId = submitData.output?.task_id;
    if (!taskId) {
      return res.status(500).json({ error: '未返回 task_id' });
    }
    if (wantsProgress) {
      saveImageTaskRecord({
        id: taskId,
        taskId,
        mode: 'text2image',
        provider: 'dashscope',
        model: selectedModel,
        status: submitData.output?.task_status || 'PENDING',
        prompt,
      });
      return res.json({
        provider: 'dashscope',
        resultType: 'image',
        taskId,
        taskStatus: submitData.output?.task_status || 'PENDING',
        model: selectedModel,
      });
    }

    // 轮询任务状态
    let imageUrls = null;
    let attempts = 0;

    while (attempts < DASHSCOPE_MAX_POLL_ATTEMPTS) {
      await new Promise(r => setTimeout(r, DASHSCOPE_POLL_INTERVAL_MS));

      const pollRes = await fetchWithTimeout(
        `${BASE_URL}${TASK_ENDPOINT}${taskId}`,
        { headers: authHeader },
        dashscopeTimeoutMs
      );

      const pollData = await pollRes.json();
      const status = pollData.output?.task_status;

      if (status === 'SUCCEEDED') {
        imageUrls = extractImageUrls(pollData, selectedModel);
        saveImageTaskRecord({ id: taskId, taskId, mode: 'text2image', provider: 'dashscope', model: selectedModel, status, prompt, imageUrls, usage: pollData.usage || null });
        break;
      } else if (status === 'FAILED') {
        const errorMessage = formatUpstreamError(pollData, 'Task failed');
        saveImageTaskRecord({ id: taskId, taskId, mode: 'text2image', provider: 'dashscope', model: selectedModel, status, prompt, message: errorMessage });
        return res.status(500).json({ error: errorMessage });
      }

      attempts++;
    }

    if (!imageUrls || !imageUrls.length) {
      return res.status(504).json({ error: '任务超时' });
    }

    res.json({ imageUrls });
  } catch (err) {
    if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
      return res.status(504).json({ error: '上游请求超时' });
    }
    res.status(500).json({ error: formatUpstreamError(err.message) });
  }
});

/**
 * 带超时的 fetch 请求
 * @param {string} url - 请求 URL
 * @param {object} options - fetch 选项
 * @param {number} timeoutMs - 超时时间 (毫秒),默认 120 秒
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 图生图接口
 * POST /api/image-to-image
 * 请求: multipart/form-data { image: File, prompt: string, apiKey: string, model: string, parameters: JSON }
 * 响应: { imageUrls: string[] }
 */
app.post('/api/image-to-image', (req, res, next) => {
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'imageMask', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, async (req, res) => {
  const { prompt, apiKey, model, parameters, provider, imageUrls } = req.body;
  const progressMode = req.body.progressMode === true || req.body.progressMode === 'true';
  
  // 安全改进: 验证 provider 白名单
  const selectedProvider = normalizeProvider(provider);
  if (!ALLOWED_PROVIDERS.includes(selectedProvider)) {
    return res.status(400).json({ error: '无效的 provider' });
  }
  
  const volcengineCredentials = selectedProvider === 'volcengine'
    ? parseVolcengineCredentials(apiKey)
    : null;
  if (selectedProvider === 'volcengine' && apiKey && !volcengineCredentials) {
    return res.status(400).json({ error: 'Volcengine 凭证格式无效，请使用 AK:SK 格式' });
  }
  const imageFile = req.files?.image?.[0];
  const imageMaskFile = req.files?.imageMask?.[0];

  if (selectedProvider !== 'volcengine' && !imageFile) {
    return res.status(400).json({ error: '参考图片是必需的' });
  }
  const resolvedApiKey = selectedProvider === 'volcengine'
    ? (volcengineCredentials ? `${volcengineCredentials.accessKey}:***` : '')
    : getApiKey(selectedProvider, apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: '请提供 API Key' });

  const selectedModel = selectedProvider === 'gemini'
    ? normalizeGeminiModel(model)
    : (selectedProvider === 'volcengine'
      ? normalizeVolcengineModel(model)
      : (model || 'wan2.6-image'));
  
  // 安全改进: 验证 model 白名单
  if (selectedProvider === 'dashscope' && !ALLOWED_MODELS.includes(selectedModel)) {
    return res.status(400).json({ error: '无效的模型' });
  }
  
  const authHeader = { 'Authorization': `Bearer ${resolvedApiKey}` };

  // 验证模型是否支持图生图
  const I2I_SUPPORTED_MODELS = [
    'wan2.7-image-pro',
    'wan2.7-image',
    'wan2.6-image',
  ];
  if (selectedProvider === 'dashscope' && !I2I_SUPPORTED_MODELS.includes(selectedModel)) {
    return res.status(400).json({
      error: `模型 ${selectedModel} 不支持图生图，请使用: ${I2I_SUPPORTED_MODELS.join(', ')}`,
    });
  }

  if (DEBUG) console.log('📷 图生图请求 - 使用模型:', selectedModel);

  // 将图片转换为 base64
  const imageBase64 = imageFile && selectedProvider !== 'volcengine'
    ? imageFile.buffer.toString('base64')
    : '';
  const mimeType = imageFile?.mimetype || 'image/png';
  const imageDataUrl = imageBase64 ? `data:${mimeType};base64,${imageBase64}` : '';

  // 解析生成参数
  let params;
  try {
    params = parameters ? JSON.parse(parameters) : {};
  } catch (e) {
    params = {};
  }

  const size = params.size;
  const width = Number.isInteger(params.width) ? params.width : undefined;
  const height = Number.isInteger(params.height) ? params.height : undefined;
  const n = params.n === undefined ? 1 : params.n;
  const seed = params.seed;
  const negativePrompt = params.negative_prompt;
  const promptExtend = params.prompt_extend !== undefined ? params.prompt_extend : true;
  const watermark = params.watermark || false;
  const hasImageStrength = params.image_strength !== undefined;
  const imageStrength = hasImageStrength ? params.image_strength : 0.5; // 参考图强度
  const upscaleResolution = typeof params.upscale_resolution === 'string' ? params.upscale_resolution : undefined;
  const upscaleScale = params.upscale_scale;
  const inpaintingSeed = params.inpainting_seed;
  const imageEditPrompt = typeof params.image_edit_prompt === 'string'
    ? params.image_edit_prompt
    : (typeof params.edit_prompt === 'string' ? params.edit_prompt : prompt);
  const loraWeight = typeof params.lora_weight === 'number' ? params.lora_weight : undefined;

  try {
    const negativeErr = validateStringMaxLen('negative_prompt', negativePrompt, 4000);
    if (negativeErr) return res.status(400).json({ error: negativeErr });
    const promptErr = validateStringMaxLen('prompt', prompt, 4000);
    if (promptErr) return res.status(400).json({ error: promptErr });

    const nErr = validateIntegerInRange('n', n, 1, 4);
    if (nErr) return res.status(400).json({ error: nErr });

    if (seed !== undefined) {
      const seedMin = selectedProvider === 'volcengine' ? -1 : 0;
      const seedErr = validateIntegerInRange('seed', seed, seedMin, 2147483647);
      if (seedErr) return res.status(400).json({ error: seedErr });
    }

    if (selectedProvider === 'dashscope' && size) {
      const sizeErr = validateSize(selectedModel, size);
      if (sizeErr) return res.status(400).json({ error: sizeErr });
    }

    if (imageStrength !== undefined) {
      if (typeof imageStrength !== 'number' || Number.isNaN(imageStrength) || imageStrength < 0 || imageStrength > 1) {
        return res.status(400).json({ error: 'image_strength 必须是 0 到 1 之间的数字' });
      }
    }

    if (selectedProvider === 'gemini') {
      const imageUrls = await generateWithGemini({
        apiKey: resolvedApiKey,
        model: selectedModel,
        prompt,
        n,
        imageDataUrl,
      });
      saveImageTaskRecord({ mode: 'image2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls });
      return res.json({ imageUrls });
    }

    if (selectedProvider === 'volcengine') {
      const uploadedImageMeta = imageFile
        ? await saveUploadedImageAsPublicUrl(req, imageFile)
        : { publicUrl: '', filePath: '' };
      const uploadedMaskMeta = imageMaskFile
        ? await saveUploadedImageAsPublicUrl(req, imageMaskFile)
        : { publicUrl: '', filePath: '' };
      let parsedImageUrls = [];
      if (imageUrls) {
        try {
          const urlInput = typeof imageUrls === 'string' ? JSON.parse(imageUrls) : imageUrls;
          parsedImageUrls = parseImageUrlsInput(urlInput);
        } catch (e) {
          parsedImageUrls = parseImageUrlsInput(imageUrls);
        }
      }
      if (uploadedImageMeta.publicUrl) {
        parsedImageUrls.unshift(uploadedImageMeta.publicUrl);
      }
      if (selectedModel === 'jimeng_i2i_v30') {
        // 文档要求图生图3.0仅允许1张参考图：优先本地上传，其次远程URL首张
        if (uploadedImageMeta.publicUrl) {
          parsedImageUrls = [uploadedImageMeta.publicUrl];
        } else if (parsedImageUrls.length > 0) {
          parsedImageUrls = [parsedImageUrls[0]];
        } else {
          return res.status(400).json({ error: 'jimeng-3.0-i2i 需要且仅支持 1 张参考图（本地上传或1条HTTP URL）' });
        }
      } else if (selectedModel === 'jimeng_i2i_seed3_tilesr_cvtob') {
        // 智能超清仅支持1张图
        if (uploadedImageMeta.publicUrl) {
          parsedImageUrls = [uploadedImageMeta.publicUrl];
        } else if (parsedImageUrls.length > 0) {
          parsedImageUrls = [parsedImageUrls[0]];
        } else {
          return res.status(400).json({ error: 'jimeng-upscale 需要且仅支持 1 张参考图（本地上传或1条HTTP URL）' });
        }
      } else if (selectedModel === 'jimeng_image2image_dream_inpaint') {
        // inpainting 需要2张图：原图 + mask
        if (uploadedImageMeta.publicUrl && uploadedMaskMeta.publicUrl) {
          parsedImageUrls = [uploadedImageMeta.publicUrl, uploadedMaskMeta.publicUrl];
        } else {
          if (uploadedImageMeta.publicUrl) {
            parsedImageUrls = [uploadedImageMeta.publicUrl, ...parsedImageUrls];
          }
          if (uploadedMaskMeta.publicUrl) {
            parsedImageUrls = [parsedImageUrls[0], uploadedMaskMeta.publicUrl].filter(Boolean);
          }
        }
        if (parsedImageUrls.length < 2) {
          return res.status(400).json({ error: 'jimeng-inpainting 需要 2 张参考图（原图+mask）。请上传原图与Mask图，或补足URL。' });
        }
        parsedImageUrls = parsedImageUrls.slice(0, 2);
      } else if (selectedModel === 'i2i_material_extraction' || selectedModel === 'jimeng_i2i_extract_tiled_images') {
        if (uploadedImageMeta.publicUrl) {
          parsedImageUrls = [uploadedImageMeta.publicUrl];
        } else if (parsedImageUrls.length > 0) {
          parsedImageUrls = [parsedImageUrls[0]];
        } else {
          return res.status(400).json({ error: `${selectedModel} 需要且仅支持 1 张参考图（本地上传或1条HTTP URL）` });
        }
      }
      const volcengineScale = selectedModel === 'jimeng_seedream46_cvtob'
        ? Math.max(1, Math.min(100, Math.round(imageStrength * 100)))
        : (selectedModel === 'jimeng_i2i_seed3_tilesr_cvtob'
          ? Math.max(0, Math.min(100, Number.isFinite(upscaleScale) ? Math.round(upscaleScale) : Math.round(imageStrength * 100)))
          : (selectedModel === 'jimeng_i2i_v30' ? imageStrength : undefined));
      const volcengineSeed = selectedModel === 'jimeng_image2image_dream_inpaint'
        ? (Number.isInteger(inpaintingSeed) ? inpaintingSeed : seed)
        : seed;
      const volcengineResult = await generateWithVolcengine({
        credentials: volcengineCredentials,
        model: selectedModel,
        prompt,
        n,
        size: parseSizeToArea(size),
        width,
        height,
        watermark,
        imageUrls: parsedImageUrls,
        scale: volcengineScale,
        usePreLlm: promptExtend,
        seed: volcengineSeed,
        resolution: selectedModel === 'jimeng_i2i_seed3_tilesr_cvtob' ? upscaleResolution : undefined,
        imageEditPrompt,
        loraWeight,
        returnTask: progressMode,
      });
      if (progressMode) {
        const cleanupDelayMs = GENERATION_REQUEST_TIMEOUT_MS + UPLOAD_FILE_CLEANUP_DELAY_MS;
        if (uploadedImageMeta.filePath) scheduleUploadedFileCleanup(uploadedImageMeta.filePath, cleanupDelayMs);
        if (uploadedMaskMeta.filePath) scheduleUploadedFileCleanup(uploadedMaskMeta.filePath, cleanupDelayMs);
        saveImageTaskRecord({
          id: volcengineResult.taskId,
          taskId: volcengineResult.taskId,
          mode: 'image2image',
          provider: 'volcengine',
          model: selectedModel,
          status: volcengineResult.taskStatus,
          prompt,
        });
        return res.json({
          provider: 'volcengine',
          resultType: 'image',
          taskId: volcengineResult.taskId,
          taskStatus: volcengineResult.taskStatus,
          model: selectedModel,
        });
      }
      if (uploadedImageMeta.filePath) {
        scheduleUploadedFileCleanup(uploadedImageMeta.filePath);
      }
      if (uploadedMaskMeta.filePath) {
        scheduleUploadedFileCleanup(uploadedMaskMeta.filePath);
      }
      saveImageTaskRecord({ mode: 'image2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls: volcengineResult });
      return res.json({ imageUrls: volcengineResult });
    }

    // 图生图使用同步API (多模态生成端点)
    const syncParams = {
      n,
    };
    
    // 图生图最高支持2K分辨率
    if (size) syncParams.size = size;
    if (seed !== undefined) syncParams.seed = seed;
    if (negativePrompt) syncParams.negative_prompt = negativePrompt;
    if (hasImageStrength) syncParams.image_strength = imageStrength;
    // prompt_extend 和 watermark 仅在明确设置时才添加
    if (promptExtend === true) syncParams.prompt_extend = true;
    if (watermark === true) syncParams.watermark = true;

    // 构建 content 数组:先放图片,再放文本
    const content = [
      { image: imageDataUrl },
    ];
    if (prompt) {
      content.push({ text: prompt });
    }

    const requestBody = {
      model: selectedModel,
      input: {
        messages: [{ role: 'user', content }],
      },
      parameters: syncParams,
    };

    // 调试日志 - 安全改进: 不记录敏感数据
    if (DEBUG) {
      console.log('=== 图生图请求调试 ===');
      console.log('模型:', selectedModel);
      console.log('图片大小:', imageFile.size, '字节');
      console.log('图片类型:', imageFile.mimetype);
      console.log('参数数量:', Object.keys(syncParams).length);
      console.log('=====================');
    }

    const syncRes = await fetchWithTimeout(
      `${BASE_URL}${SYNC_ENDPOINT}`,
      {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      I2I_REQUEST_TIMEOUT_MS
    );

    const syncData = await syncRes.json();

    if (!syncRes.ok) {
      console.error('❌ 图生图API错误:');
      console.error('HTTP状态码:', syncRes.status);
      // 安全改进: 不记录完整响应，只记录错误消息
      const errorMessage = formatUpstreamError(syncData);
      if (DEBUG) console.error('错误消息:', errorMessage);
      return res.status(syncRes.status).json({ error: errorMessage });
    }

    if (DEBUG) console.log('✅ 图生图API调用成功');

    const syncImageUrls = extractImageUrls(syncData, selectedModel);
    if (!syncImageUrls.length) {
      console.error('❌ API返回中未找到图片URL');
      // 安全改进: 不记录完整响应
      return res.status(500).json({ error: '响应中未包含图片 URL' });
    }

    if (DEBUG) console.log('✅ 生成图片数量:', syncImageUrls.length);
    saveImageTaskRecord({ mode: 'image2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls: syncImageUrls });
    res.json({ imageUrls: syncImageUrls });
  } catch (err) {
    console.error('❌ 图生图异常:', err);

    // 如果响应已经发送，不要再处理
    if (res.headersSent) {
      console.warn('响应已发送，跳过错误处理');
      return;
    }

    // 区分不同类型的错误
    if (err.name === 'AbortError' || err.message?.includes('abort')) {
      return res.status(504).json({ error: '请求超时,图片较大或网络较慢,请稍后重试' });
    }
    
    // 网络错误（DNS 解析失败、连接被拒绝等）
    if (err.message?.includes('fetch failed') || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.error('🌐 网络错误详情:', {
        message: err.message,
        code: err.code,
        cause: err.cause?.message
      });
      return res.status(502).json({ error: '网络错误,无法连接到 AI 服务,请检查网络或稍后重试' });
    }
    
    // 其他错误
    const errorMessage = formatUpstreamError(err.message);
    res.status(500).json({ error: errorMessage });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// 启动时清理残留的过期上传文件
async function cleanupStaleUploads() {
  try {
    const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true }).catch(() => []);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(UPLOADS_DIR, entry.name);
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > UPLOAD_FILE_CLEANUP_DELAY_MS) {
          await fs.unlink(filePath);
          if (DEBUG) console.log(`🧹 启动清理残留文件: ${filePath}`);
        }
      } catch (e) {
        if (e?.code !== 'ENOENT') console.error(`清理文件失败: ${filePath}`, e);
      }
    }
  } catch (e) {
    // uploads 目录不存在时忽略
  }
}

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await cleanupStaleUploads();
});
