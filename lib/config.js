/**
 * 配置常量和环境变量
 */

const path = require('path');
const dotenv = require('dotenv');

const DOTENV_PATH = path.join(__dirname, '..', '.env');
const dotenvResult = dotenv.config({ path: DOTENV_PATH });
const DOTENV_PARSED = dotenvResult.parsed || {};

const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOADS_RELATIVE_DIR = 'uploads';
const UPLOADS_DIR = path.join(PUBLIC_DIR, UPLOADS_RELATIVE_DIR);
const VIDEO_TASK_DB_PATH = process.env.VIDEO_TASK_DB_PATH || path.join(DATA_DIR, 'video-tasks.sqlite');
const ACCESS_COOKIE_SECRET_PATH = process.env.ACCESS_COOKIE_SECRET_PATH || path.join(path.dirname(VIDEO_TASK_DB_PATH), 'access-cookie-secret');

const UPLOAD_FILE_CLEANUP_DELAY_MS = 5 * 60 * 1000;
const UPLOAD_FILE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MOTION_FILE_MAX_SIZE = 64 * 1024 * 1024; // 64MB

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

const PLACEHOLDER_CREDENTIALS = new Set([
  'your_api_key_here',
  'your_dashscope_key',
  'your_gemini_api_key_here',
  'your_google_api_key_here',
  'your_volcengine_access_key',
  'your_volcengine_secret_key',
  'your_volcengine_session_token',
  'sk-...',
]);

// 访问控制配置
const FRONTEND_ACCESS_CONTROL_ENABLED = process.env.FRONTEND_ACCESS_CONTROL_ENABLED === '1' || process.env.FRONTEND_ACCESS_CONTROL_ENABLED === 'true';
const FRONTEND_ACCESS_KEY = typeof process.env.FRONTEND_ACCESS_KEY === 'string' ? process.env.FRONTEND_ACCESS_KEY.trim() : '';
const ACCESS_COOKIE_NAME = 'access_auth';
const ACCESS_AUTH_WINDOW_MS = Number.parseInt(process.env.ACCESS_AUTH_WINDOW_MS || '300000', 10);
const ACCESS_AUTH_MAX_ATTEMPTS = Number.parseInt(process.env.ACCESS_AUTH_MAX_ATTEMPTS || '8', 10);
const ACCESS_AUTH_LOCK_MS = Number.parseInt(process.env.ACCESS_AUTH_LOCK_MS || '900000', 10);

// API 基础地址
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

// Volcengine 模型别名映射
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
  // 即梦视频模型
  'jimeng-v3.0-t2v-1080p': 'jimeng_t2v_v30_1080p',
  'jimeng-v3.0-i2v-first-1080p': 'jimeng_i2v_first_v30_1080',
  'jimeng-v3.0-i2v-tail-1080p': 'jimeng_i2v_first_tail_v30_1080',
  'jimeng-v3.0-pro': 'jimeng_ti2v_v30_pro',
  // 动作模仿
  'jimeng-motion-1.0': 'jimeng_dream_actor_m1_gen_video_cv',
  'jimeng-motion-2.0': 'jimeng_dreamactor_m20_gen_video',
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

// 视频模型列表
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

// 模型默认配置
const MODEL_CONFIG = {
  'wan2.7-image-pro': { size: '2K', type: 'wan' },
  'wan2.7-image': { size: '2K', type: 'wan' },
  'wan2.6-image': { size: '1024*1024', type: 'wan' },
  'wan2.6-t2i': { size: '1280*1280', type: 'wan' },
  'wan2.5-t2i-preview': { size: '1280*1280', type: 'wan' },
  'wan2.2-t2i-flash': { size: '1024*1024', type: 'wan' },
  'wan2.2-t2i-plus': { size: '1024*1024', type: 'wan' },
  'wanx2.1-t2i-turbo': { size: '1024*1024', type: 'wan' },
  'wanx2.1-t2i-plus': { size: '1024*1024', type: 'wan' },
  'wanx2.0-t2i-turbo': { size: '1024*1024', type: 'wan' },
  'qwen-image-2.0-pro': { size: '2048*2048', type: 'qwen' },
  'qwen-image-2.0': { size: '2048*2048', type: 'qwen' },
  'qwen-image-max': { size: '1664*928', type: 'qwen' },
  'qwen-image-plus': { size: '1664*928', type: 'qwen' },
  'qwen-image': { size: '1664*928', type: 'qwen' },
  'z-image-turbo': { size: '1024*1024', type: 'wan' },
};

// 各模型允许的 size 白名单
const ALLOWED_SIZES_BY_MODEL = {
  'wan2.7-image-pro': ['1K', '2K', '4K'],
  'wan2.7-image': ['1K', '2K'],
  'wan2.6-image': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.6-t2i': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.5-t2i-preview': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.2-t2i-flash': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.2-t2i-plus': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wanx2.1-t2i-turbo': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wanx2.1-t2i-plus': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wanx2.0-t2i-turbo': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'qwen-image-2.0-pro': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-2.0': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-max': ['1664*928', '928*1664', '1328*1328', '1472*1104', '1104*1472', '1024*1024'],
  'qwen-image-plus': ['1664*928', '928*1664', '1328*1328', '1472*1104', '1104*1472', '1024*1024'],
  'qwen-image': ['1664*928', '928*1664', '1328*1328', '1472*1104', '1104*1472', '1024*1024'],
  'z-image-turbo': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
};

// 允许的 provider 和 model 白名单
const ALLOWED_PROVIDERS = ['dashscope', 'gemini', 'volcengine'];
const ALLOWED_MODELS = Object.keys(MODEL_CONFIG);

// MIME 类型映射
const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

module.exports = {
  DOTENV_PATH,
  DOTENV_PARSED,
  PORT,
  DEBUG,
  PUBLIC_DIR,
  DATA_DIR,
  UPLOADS_RELATIVE_DIR,
  UPLOADS_DIR,
  VIDEO_TASK_DB_PATH,
  ACCESS_COOKIE_SECRET_PATH,
  UPLOAD_FILE_CLEANUP_DELAY_MS,
  UPLOAD_FILE_MAX_SIZE,
  MOTION_FILE_MAX_SIZE,
  GENERATION_MAX_POLL_ATTEMPTS,
  GENERATION_POLL_INTERVAL_MS,
  GENERATION_REQUEST_TIMEOUT_MS,
  VIDEO_GENERATION_MAX_POLL_ATTEMPTS,
  VIDEO_GENERATION_REQUEST_TIMEOUT_MS,
  DASHSCOPE_MAX_POLL_ATTEMPTS,
  DASHSCOPE_POLL_INTERVAL_MS,
  DASHSCOPE_VIDEO_MAX_POLL_ATTEMPTS,
  DASHSCOPE_VIDEO_POLL_INTERVAL_MS,
  I2I_REQUEST_TIMEOUT_MS,
  FREE_TIER_QUOTA_ERROR_CODE,
  FREE_TIER_QUOTA_ERROR_MESSAGE,
  PLACEHOLDER_CREDENTIALS,
  FRONTEND_ACCESS_CONTROL_ENABLED,
  FRONTEND_ACCESS_KEY,
  ACCESS_COOKIE_NAME,
  ACCESS_AUTH_WINDOW_MS,
  ACCESS_AUTH_MAX_ATTEMPTS,
  ACCESS_AUTH_LOCK_MS,
  BASE_URL,
  GEMINI_BASE_URL,
  GEMINI_DEFAULT_MODEL,
  GEMINI_MODEL_ALIASES,
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
  ALLOWED_PROVIDERS,
  ALLOWED_MODELS,
  MIME_EXTENSION_MAP,
};
