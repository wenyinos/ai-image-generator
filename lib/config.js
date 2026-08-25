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
// 单库双表：video_tasks 与 image_tasks 共用同一个 SQLite 文件
const VIDEO_TASK_DB_PATH = process.env.VIDEO_TASK_DB_PATH || path.join(DATA_DIR, 'video-tasks.sqlite');
const ACCESS_COOKIE_SECRET_PATH = process.env.ACCESS_COOKIE_SECRET_PATH || path.join(path.dirname(VIDEO_TASK_DB_PATH), 'access-cookie-secret');

const UPLOAD_FILE_CLEANUP_DELAY_MS = 5 * 60 * 1000;
const UPLOAD_FILE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MOTION_FILE_MAX_SIZE = 64 * 1024 * 1024; // 64MB

const GENERATION_MAX_POLL_ATTEMPTS = Number.parseInt(process.env.GENERATION_MAX_POLL_ATTEMPTS || '90', 10);
const GENERATION_POLL_INTERVAL_MS = Number.parseInt(process.env.GENERATION_POLL_INTERVAL_MS || '5000', 10);
const GENERATION_REQUEST_TIMEOUT_MS = Number.parseInt(process.env.GENERATION_REQUEST_TIMEOUT_MS || '900000', 10);
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
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_DEFAULT_MODEL = process.env.GEMINI_DEFAULT_MODEL || 'gemini-3.1-flash-image-preview';
const GEMINI_MODEL_ALIASES = {};

// OpenAI (GPT 图片)
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_DEFAULT_MODEL = 'gpt-image-2';
const OPENAI_MODEL_ALIASES = {
  'gpt-image-2': 'gpt-image-2',
};

// xAI (Grok 视频)
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_DEFAULT_MODEL = 'grok-video-1.0';
const XAI_MODEL_ALIASES = {
  'grok-video-1.0': 'grok-video-1.0',
  'grok-video-1.5': 'grok-video-1.5',
};

// HTTP 代理（Gemini / OpenAI 等外网 API 可能需要代理访问）
const HTTP_PROXY = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.ALL_PROXY || '';

// 是否信任反向代理头（X-Forwarded-For / X-Forwarded-Host / Forwarded）。
// 仅在反向代理后部署时开启（TRUST_PROXY=1）；直连部署保持关闭，防止伪造头绕过限流。
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';

const VOLCENGINE_HOST = process.env.VOLCENGINE_HOST || 'visual.volcengineapi.com';
const VOLCENGINE_REGION = process.env.VOLCENGINE_REGION || 'cn-north-1';
const VOLCENGINE_SERVICE = process.env.VOLCENGINE_SERVICE || 'cv';
const VOLCENGINE_VERSION = '2022-08-31';

// Agnes AI
const AGNES_BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';
const AGNES_API_KEY = process.env.AGNES_API_KEY || '';

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
  // 即梦视频模型 - 1080P
  'jimeng-v3.0-t2v-1080p': 'jimeng_t2v_v30_1080p',
  'jimeng-v3.0-i2v-first-1080p': 'jimeng_i2v_first_v30_1080',
  'jimeng-v3.0-i2v-tail-1080p': 'jimeng_i2v_first_tail_v30_1080',
  'jimeng-v3.0-pro': 'jimeng_ti2v_v30_pro',
  // 即梦视频模型 - 720P
  'jimeng-v3.0-t2v': 'jimeng_t2v_v30',
  'jimeng-v3.0-i2v-first': 'jimeng_i2v_first_v30',
  'jimeng-v3.0-i2v-tail': 'jimeng_i2v_first_tail_v30',
  'jimeng-v3.0-recamera': 'jimeng_i2v_recamera_v30',
  // 动作模仿
  'jimeng-motion-1.0': 'jimeng_dream_actor_m1_gen_video_cv',
  'jimeng-motion-2.0': 'jimeng_dreamactor_m20_gen_video',
  // 视频翻译
  'jimeng-video-translate': 'video_translate_v2_cvtob',
  // 图片换装
  'jimeng-dressing': 'dressing_diffusionV2',
  'jimeng-dressing-v1': 'dressing_diffusion',
  // 智能绘图
  'jimeng-seededit': 'seededit_v3.0',
  // 图像特效
  'jimeng-effect': 'i2i_multi_style_zx2x',
  // 人像融合
  'jimeng-faceswap': 'face_swap3_6',
  'jimeng-faceswap-ai': 'faceswap_ai',
  // 智能变美
  'jimeng-facepretty': 'FacePretty',
  // 图像修复与增强
  'jimeng-lqir': 'lens_lqir',
  'jimeng-nnsr2': 'lens_nnsr2_pic_common',
};

// 图像特效模板列表
const IMAGE_EFFECT_TEMPLATES = [
  { value: 'felt_3d_polaroid', label: '毛毡3D拍立得' },
  { value: 'my_world', label: '像素世界风' },
  { value: 'my_world_universal', label: '像素世界-万物通用版' },
  { value: 'plastic_bubble_figure', label: '塑料泡罩人偶' },
  { value: 'plastic_bubble_figure_cartoon_text', label: '塑料泡罩人偶-文字卡头版' },
  { value: 'furry_dream_doll', label: '毛茸茸梦幻娃娃' },
  { value: 'micro_landscape_mini_world', label: '迷你世界玩偶风' },
  { value: 'micro_landscape_mini_world_professional', label: '微型景观小世界-职业版' },
  { value: 'acrylic_ornaments', label: '亚克力挂饰' },
  { value: 'felt_keychain', label: '毛毡钥匙扣' },
  { value: 'lofi_pixel_character_mini_card', label: 'Lofi像素人物小卡' },
  { value: 'angel_figurine', label: '天使形象手办' },
  { value: 'lying_in_fluffy_belly', label: '躺在毛茸茸肚皮里' },
  { value: 'glass_ball', label: '玻璃球' },
  { value: 'earphone_case_style', label: '耳机盒' },
  { value: 'electronic_pet_egg_style', label: '电子宠物蛋' },
  { value: 'patchwork_collage_style', label: '拼贴缝布' },
  { value: 'claw_machine_style', label: '抓娃娃机' },
  { value: 'car_miniature_ornaments', label: '车内微缩摆件' },
  { value: 'graduation_photo', label: '毕业照' },
  { value: 'birthday_photo_gorgeous', label: '生日照-华丽' },
  { value: 'birthday_photo_red', label: '生日照-红色' },
  { value: 'birthday_photo_party', label: '生日照-派对' },
];

// 视频翻译语种列表
const VIDEO_TRANSLATE_LANGUAGES = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
  { value: 'es', label: '西班牙语' },
  { value: 'pt', label: '葡萄牙语' },
  { value: 'ru', label: '俄语' },
  { value: 'ar', label: '阿拉伯语' },
  { value: 'hi', label: '印地语' },
  { value: 'id', label: '印尼语' },
  { value: 'it', label: '意大利语' },
  { value: 'nl', label: '荷兰语' },
  { value: 'tr', label: '土耳其语' },
  { value: 'pl', label: '波兰语' },
  { value: 'sv', label: '瑞典语' },
  { value: 'fil', label: '菲律宾语' },
  { value: 'ms', label: '马来语' },
  { value: 'ro', label: '罗马尼亚语' },
  { value: 'uk', label: '乌克兰语' },
  { value: 'el', label: '希腊语' },
  { value: 'cs', label: '捷克语' },
  { value: 'da', label: '丹麦语' },
  { value: 'fi', label: '芬兰语' },
  { value: 'bg', label: '保加利亚语' },
  { value: 'hr', label: '克罗地亚语' },
  { value: 'sk', label: '斯洛伐克语' },
  { value: 'ta', label: '泰米尔语' },
];

// 使用同步调用协议的模型列表
const SYNC_MODELS = new Set([
  'wan2.7-image-pro',
  'wan2.7-image',
  'wan2.6-image',
  'qwen-image-2.0-pro',
  'qwen-image-3.0',
  'qwen-image-3.0-pro',
]);

// API 端点路径
const SYNC_ENDPOINT = '/services/aigc/multimodal-generation/generation';
const ASYNC_ENDPOINT = '/services/aigc/text2image/image-synthesis';
const VIDEO_ENDPOINT = '/services/aigc/video-generation/video-synthesis';
const TASK_ENDPOINT = '/tasks/';

// 视频模型列表
const VIDEO_MODELS = {
  text2video: [
    { value: 'happyhorse-1.1-t2v', label: 'happyhorse-1.1-t2v（推荐）' },
    { value: 'happyhorse-1.0-t2v', label: 'happyhorse-1.0-t2v' },
    { value: 'wan3.0-video-prime', label: 'wan3.0-video-prime（文生视频）' },
    { value: 'wan3.0-video', label: 'wan3.0-video（文生视频）' },
    { value: 'wan2.7-t2v', label: 'wan2.7-t2v（文生视频2.7）' },
    { value: 'wan2.6-t2v', label: 'wan2.6-t2v（文生视频2.6）' },
  ],
  image2video: [
    { value: 'happyhorse-1.1-i2v', label: 'happyhorse-1.1-i2v（图生视频）' },
    { value: 'happyhorse-1.0-i2v', label: 'happyhorse-1.0-i2v' },
    { value: 'wan3.0-video-prime', label: 'wan3.0-video-prime（图生视频）' },
    { value: 'wan3.0-video', label: 'wan3.0-video（图生视频）' },
    { value: 'wan2.7-i2v', label: 'wan2.7-i2v（图生视频2.7）' },
    { value: 'wan2.6-i2v-flash', label: 'wan2.6-i2v-flash' },
  ],
  r2v: [
    { value: 'happyhorse-1.1-r2v', label: 'happyhorse-1.1-r2v（推荐，最多9图）' },
    { value: 'happyhorse-1.0-r2v', label: 'happyhorse-1.0-r2v（最多9图）' },
    { value: 'wan2.7-r2v', label: 'wan2.7-r2v（支持图片+视频）' },
  ],
  videoedit: [
    { value: 'wan2.7-videoedit', label: 'wan2.7-videoedit（视频编辑）' },
  ],
};

// 模型默认配置
const MODEL_CONFIG = {
  'wan2.7-image-pro': { size: '2K', type: 'wan' },
  'wan2.7-image': { size: '2K', type: 'wan' },
  'wan2.6-image': { size: '1024*1024', type: 'wan' },
  'wan2.6-t2i': { size: '1280*1280', type: 'wan' },
  'qwen-image-2.0-pro': { size: '2048*2048', type: 'qwen' },
  'qwen-image-3.0': { size: '2048*2048', type: 'qwen' },
  'qwen-image-3.0-pro': { size: '2048*2048', type: 'qwen' },
  'agnes-image-2.0-flash': { size: '1024x768', type: 'agnes' },
  'agnes-image-2.1-flash': { size: '1024x768', type: 'agnes' },
  'gemini-3-pro-image-preview': { size: '1024x1024', type: 'gemini' },
  'gemini-3.1-flash-image-preview': { size: '1024x1024', type: 'gemini' },
  'gpt-image-2': { size: '1024x1024', type: 'openai' },
};

// 各模型允许的 size 白名单
const ALLOWED_SIZES_BY_MODEL = {
  'wan2.7-image-pro': ['1K', '2K', '4K'],
  'wan2.7-image': ['1K', '2K'],
  'wan2.6-image': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.6-t2i': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  'qwen-image-2.0-pro': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-3.0': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-3.0-pro': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'agnes-image-2.0-flash': ['1024x1024', '1024x768', '768x1024', '1280x720', '720x1280', '1152x896', '896x1152'],
  'agnes-image-2.1-flash': ['1024x1024', '1024x768', '768x1024', '1280x720', '720x1280', '1152x896', '896x1152'],
  'gemini-3-pro-image-preview': ['1024x1024', '1536x1024', '1024x1536'],
  'gemini-3.1-flash-image-preview': ['1024x1024', '1536x1024', '1024x1536'],
  'gpt-image-2': ['1024x1024', '1536x1024', '1024x1536'],
};

// 允许的 provider 和 model 白名单
const ALLOWED_PROVIDERS = ['dashscope', 'gemini', 'volcengine', 'agnes', 'openai'];
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
  OPENAI_BASE_URL,
  OPENAI_API_KEY,
  OPENAI_DEFAULT_MODEL,
  OPENAI_MODEL_ALIASES,
  XAI_BASE_URL,
  XAI_API_KEY,
  XAI_DEFAULT_MODEL,
  XAI_MODEL_ALIASES,
  HTTP_PROXY,
  TRUST_PROXY,
  VOLCENGINE_HOST,
  VOLCENGINE_REGION,
  VOLCENGINE_SERVICE,
  VOLCENGINE_VERSION,
  VOLCENGINE_MODEL_ALIASES,
  AGNES_BASE_URL,
  AGNES_API_KEY,
  IMAGE_EFFECT_TEMPLATES,
  VIDEO_TRANSLATE_LANGUAGES,
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
