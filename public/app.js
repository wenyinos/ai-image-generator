/**
 * AI 图片生成器 - 前端交互逻辑
 * 支持文生图和图生图两种模式
 *
 * @copyright 2026 wenyinos. All rights reserved.
 * @license MIT
 * @see https://github.com/wenyinos/ai-image-generator
 */

const GENERATION_REQUEST_TIMEOUT_MS = 900000; // 与后端 config.js 默认值保持一致
const GENERATION_PROGRESS_POLL_INTERVAL_MS = 5000;
const GENERATION_PROGRESS_MAX_POLL_ATTEMPTS = 90;
const VIDEO_PROGRESS_MAX_POLL_ATTEMPTS = 0; // 0 表示不因前端轮询次数触发超时
const MAX_CONSECUTIVE_NETWORK_ERRORS = 5;
const NETWORK_ERROR_RETRY_DELAY_MS = 3000;
const FREE_TIER_QUOTA_ERROR_CODE = 'AllocationQuota.FreeTierOnly';
const FREE_TIER_QUOTA_ERROR_MESSAGE = '此模型额度已用尽，请更换其他模型';
const FOREGROUND_RECOVERY_MIN_INTERVAL_MS = 3000;

// DOM 元素引用
const providerSelect = document.getElementById('providerSelect');
const providerSelectI2I = document.getElementById('providerSelectI2I');
const modelSelect = document.getElementById('modelSelect');
const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const generateBtnI2I = document.getElementById('generateBtnI2I');
const generateBtnVideo = document.getElementById('generateBtnVideo');
const alertContainer = document.getElementById('alertContainer');
const placeholder = document.getElementById('placeholder');
const loading = document.getElementById('loading');
const resultImages = document.getElementById('resultImages');
const downloadBtn = document.getElementById('downloadBtn');
const downloadLink = document.getElementById('downloadLink');
const imageCount = document.getElementById('imageCount');
const imageParamsPanel = document.getElementById('imageParamsPanel');
const imageSize = document.getElementById('imageSize');
const genericSizeGroup = document.getElementById('genericSizeGroup');
const genericSeedGroup = document.getElementById('genericSeedGroup');
const seedInput = document.getElementById('seedInput');
const negativePrompt = document.getElementById('negativePrompt');
const promptExtend = document.getElementById('promptExtend');
const watermarkToggle = document.getElementById('watermarkToggle');
const volcengineParams = document.getElementById('volcengineParams');
const volcengineSize = document.getElementById('volcengineSize');
const volcengineWidth = document.getElementById('volcengineWidth');
const volcengineHeight = document.getElementById('volcengineHeight');
const volcengineWatermarkGroup = document.getElementById('volcengineWatermarkGroup');
const volcengineWatermarkToggle = document.getElementById('volcengineWatermarkToggle');
const imageStrength = document.getElementById('imageStrength');
const strengthValue = document.getElementById('strengthValue');
const image2imageParams = document.getElementById('image2imageParams');
const imageStrengthGroup = document.getElementById('imageStrengthGroup');
const upscaleParamsGroup = document.getElementById('upscaleParamsGroup');
const inpaintingParamsGroup = document.getElementById('inpaintingParamsGroup');
const upscaleResolution = document.getElementById('upscaleResolution');
const upscaleScale = document.getElementById('upscaleScale');
const upscaleScaleValue = document.getElementById('upscaleScaleValue');
const inpaintingSeed = document.getElementById('inpaintingSeed');
const materialProductParamsGroup = document.getElementById('materialProductParamsGroup');
const materialPodParamsGroup = document.getElementById('materialPodParamsGroup');
const materialProductEditPrompt = document.getElementById('materialProductEditPrompt');
const materialProductSeed = document.getElementById('materialProductSeed');
const materialProductWidth = document.getElementById('materialProductWidth');
const materialProductHeight = document.getElementById('materialProductHeight');
const materialPodEditPrompt = document.getElementById('materialPodEditPrompt');
const materialPodSeed = document.getElementById('materialPodSeed');
const materialPodWidth = document.getElementById('materialPodWidth');
const materialPodHeight = document.getElementById('materialPodHeight');
const materialPodLoraWeight = document.getElementById('materialPodLoraWeight');

// 图生图相关元素
const modelHintI2I = document.getElementById('modelHintI2I');
const modelHintT2I = document.getElementById('modelHintT2I');
const modelHintVideo = document.getElementById('modelHintVideo');
const modelSnapshotGroupT2I = document.getElementById('modelSnapshotGroupT2I');
const modelSnapshotT2I = document.getElementById('modelSnapshotT2I');
const modelSnapshotGroupI2I = document.getElementById('modelSnapshotGroupI2I');
const modelSnapshotI2I = document.getElementById('modelSnapshotI2I');
const modelSnapshotGroupVideo = document.getElementById('modelSnapshotGroupVideo');
const modelSnapshotVideo = document.getElementById('modelSnapshotVideo');
const modelSelectI2I = document.getElementById('modelSelectI2I');
const promptInputI2I = document.getElementById('promptInputI2I');
const uploadArea = document.getElementById('uploadArea');
const imageUpload = document.getElementById('imageUpload');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');
const removeImageBtn = document.getElementById('removeImageBtn');
const maskUploadGroup = document.getElementById('maskUploadGroup');
const maskUploadArea = document.getElementById('maskUploadArea');
const maskImageUpload = document.getElementById('maskImageUpload');
const maskImagePreview = document.getElementById('maskImagePreview');
const maskPreviewImage = document.getElementById('maskPreviewImage');
const removeMaskImageBtn = document.getElementById('removeMaskImageBtn');
const templateUploadGroup = document.getElementById('templateUploadGroup');
const templateUploadArea = document.getElementById('templateUploadArea');
const templateImageUpload = document.getElementById('templateImageUpload');
const templateImagePreview = document.getElementById('templateImagePreview');
const templatePreviewImage = document.getElementById('templatePreviewImage');
const removeTemplateImageBtn = document.getElementById('removeTemplateImageBtn');
const volcengineLocalUploadHint = document.getElementById('volcengineLocalUploadHint');
const volcengineImageUrlsGroup = document.getElementById('volcengineImageUrlsGroup');

// 视频翻译相关
const videoTranslateGroup = document.getElementById('videoTranslateGroup');
const srcLanguage = document.getElementById('srcLanguage');
const targetLanguage = document.getElementById('targetLanguage');
const videoTranslateUrl = document.getElementById('videoTranslateUrl');

// 图片换装相关
const dressingParamsGroup = document.getElementById('dressingParamsGroup');
const dressingModelUrl = document.getElementById('dressingModelUrl');
const dressingGarmentUrl = document.getElementById('dressingGarmentUrl');
const dressingGarmentType = document.getElementById('dressingGarmentType');

// 智能绘图相关
const seededitParamsGroup = document.getElementById('seededitParamsGroup');
const seededitScale = document.getElementById('seededitScale');
const seededitScaleValue = document.getElementById('seededitScaleValue');

// 图像特效相关
const effectParamsGroup = document.getElementById('effectParamsGroup');
const effectTemplate = document.getElementById('effectTemplate');

// 视频编辑相关
const videoeditUploadGroup = document.getElementById('videoeditUploadGroup');
const videoeditVideo = document.getElementById('videoeditVideo');
const videoeditRefImage = document.getElementById('videoeditRefImage');

// 任务ID获取 - 视频
const fetchTaskIdInput = document.getElementById('fetchTaskIdInput');
const fetchTaskIdType = document.getElementById('fetchTaskIdType');
const fetchTaskIdProvider = document.getElementById('fetchTaskIdProvider');
const fetchTaskIdBtn = document.getElementById('fetchTaskIdBtn');

// 任务ID获取 - 文生图
const fetchTextImageTaskIdInput = document.getElementById('fetchTextImageTaskIdInput');
const fetchTextImageTaskIdType = document.getElementById('fetchTextImageTaskIdType');
const fetchTextImageTaskIdProvider = document.getElementById('fetchTextImageTaskIdProvider');
const fetchTextImageTaskIdBtn = document.getElementById('fetchTextImageTaskIdBtn');

// 任务ID获取 - 图生图
const fetchI2ITaskIdInput = document.getElementById('fetchI2ITaskIdInput');
const fetchI2ITaskIdType = document.getElementById('fetchI2ITaskIdType');
const fetchI2ITaskIdProvider = document.getElementById('fetchI2ITaskIdProvider');
const fetchI2ITaskIdBtn = document.getElementById('fetchI2ITaskIdBtn');

// r2v 参考生视频
const r2vUploadGroup = document.getElementById('r2vUploadGroup');
const r2vFiles = document.getElementById('r2vFiles');
const r2vFilesHint = document.getElementById('r2vFilesHint');

// 运镜模板
const recameraGroup = document.getElementById('recameraGroup');
const recameraTemplate = document.getElementById('recameraTemplate');
const recameraStrength = document.getElementById('recameraStrength');
const volcengineImageUrls = document.getElementById('volcengineImageUrls');
const videoMode = document.getElementById('videoMode');
const videoProvider = document.getElementById('videoProvider');
const videoModelSelect = document.getElementById('videoModelSelect');
const refreshVideoModelsBtn = document.getElementById('refreshVideoModelsBtn');
const videoPromptInput = document.getElementById('videoPromptInput');
const videoFrameGroup = document.getElementById('videoFrameGroup');
const videoFirstFrame = document.getElementById('videoFirstFrame');
const videoLastFrame = document.getElementById('videoLastFrame');
const motionUploadGroup = document.getElementById('motionUploadGroup');
const motionImage = document.getElementById('motionImage');
const motionVideo = document.getElementById('motionVideo');
const videoDuration = document.getElementById('videoDuration');
const videoResolution = document.getElementById('videoResolution');
const videoRatio = document.getElementById('videoRatio');
const videoRatioGroup = document.getElementById('videoRatioGroup');
const videoTaskRecordsEl = document.getElementById('videoTaskRecords');
const videoTaskRecordsEmpty = document.getElementById('videoTaskRecordsEmpty');
const importVideoTaskRecordsBtn = document.getElementById('importVideoTaskRecordsBtn');
const textImageTaskRecordsPanel = document.getElementById('textImageTaskRecordsPanel');
const textImageTaskRecordsEl = document.getElementById('textImageTaskRecords');
const textImageTaskRecordsEmpty = document.getElementById('textImageTaskRecordsEmpty');
const imageTaskRecordsPanel = document.getElementById('imageTaskRecordsPanel');
const imageTaskRecordsEl = document.getElementById('imageTaskRecords');
const imageTaskRecordsEmpty = document.getElementById('imageTaskRecordsEmpty');

// 当前模式
let currentMode = 'text2image'; // 'text2image'、'image2image' 或 'video'
let uploadedImageFile = null;
let uploadedMaskFile = null;
let uploadedTemplateFile = null;
let videoTaskRecords = [];
let textImageTaskRecords = [];
let imageTaskRecords = [];
let foregroundRecoveryNeeded = false;
let foregroundRecoveryPromise = null;
let lastForegroundRecoveryAt = 0;
let activeTaskContext = null;
const GEMINI_MODEL_ID = 'gemini-3.1-flash-image-preview';

// 统一凭证存储键（文生图 / 图生图 / 视频生成共用）
const SETTINGS_PROVIDERS = ['dashscope', 'volcengine', 'gemini', 'agnes', 'openai', 'xai'];

// 旧版按模式拆分的存储键一次性迁移到统一键
function migrateLegacyApiKeys() {
  SETTINGS_PROVIDERS.forEach((p) => {
    if (!localStorage.getItem(`apiKey_${p}`)) {
      const legacy = loadCredential(`apiKeyI2I_${p}`)
        || (p === 'dashscope' ? loadCredential('apiKey_video_dashscope') : '');
      if (legacy) localStorage.setItem(`apiKey_${p}`, legacy);
    }
  });
  ['volcengineAk', 'volcengineSk'].forEach((k) => {
    if (!localStorage.getItem(k)) {
      const legacy = loadCredential(`${k}I2I`) || loadCredential(`${k}Video`);
      if (legacy) localStorage.setItem(k, legacy);
    }
  });
}
migrateLegacyApiKeys();

// 读取指定提供商的 API Key（火山引擎为 AK:SK 拼接）；留空则走服务端环境变量回退
function getStoredApiKey(provider) {
  if (provider === 'volcengine') {
    const ak = loadCredential('volcengineAk');
    const sk = loadCredential('volcengineSk');
    return ak && sk ? `${ak}:${sk}` : '';
  }
  return loadCredential(`apiKey_${provider}`);
}


const MODELS_T2I = {
  dashscope: [
    { group: '💬 千问 Qwen-Image', options: [
      { value: 'qwen-image-3.0-pro', label: 'qwen-image-3.0-pro (最强)' },
      { value: 'qwen-image-3.0', label: 'qwen-image-3.0' },
      { value: 'qwen-image-2.0-pro', label: 'qwen-image-2.0-pro (擅长文字)' },
    ] },
    { group: '⭐ 万相 2.7 (最新)', options: [
      { value: 'wan2.7-image-pro', label: 'wan2.7-image-pro (最强, 支持4K)' },
      { value: 'wan2.7-image', label: 'wan2.7-image (快速)' },
    ] },
    { group: '🎨 万相 2.6', options: [
      { value: 'wan2.6-image', label: 'wan2.6-image (图文混排)' },
      { value: 'wan2.6-t2i', label: 'wan2.6-t2i (标准)' },
    ] },
  ],
  gemini: [
    { group: '✨ Gemini', options: [
      { value: GEMINI_MODEL_ID, label: 'Gemini 3.1 Flash Image (预览)' },
      { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (预览)' },
    ] },
  ],
  openai: [
    { group: '🤖 GPT', options: [
      { value: 'gpt-image-2', label: 'GPT Image 2' },
    ] },
  ],
  volcengine: [
    { group: '🌋 即梦AI', options: [
      { value: 'jimeng-3.0', label: '即梦AI-文生图3.0' },
      { value: 'jimeng-3.1', label: '即梦AI-文生图3.1' },
      { value: 'jimeng-4.0', label: '即梦AI-图片生成4.0' },
      { value: 'jimeng-4.6', label: '即梦AI-图片生成4.6' },
    ] },
  ],
  agnes: [
    { group: '🤖 Agnes AI', options: [
      { value: 'agnes-image-2.5-flash', label: 'Agnes Image 2.5 Flash (最新)' },
      { value: 'agnes-image-2.1-flash', label: 'Agnes Image 2.1 Flash (推荐)' },
      { value: 'agnes-image-2.0-flash', label: 'Agnes Image 2.0 Flash' },
    ] },
  ],
};

const MODELS_I2I = {
  dashscope: [
    { group: '💬 千问 Qwen-Image', options: [
      { value: 'qwen-image-3.0-pro', label: 'qwen-image-3.0-pro (最强)' },
      { value: 'qwen-image-3.0', label: 'qwen-image-3.0' },
    ] },
    { group: '⭐ 万相 2.7 (推荐)', options: [
      { value: 'wan2.7-image', label: 'wan2.7-image (快速)' },
      { value: 'wan2.7-image-pro', label: 'wan2.7-image-pro (最强)' },
    ] },
    { group: '🎨 万相 2.6', options: [
      { value: 'wan2.6-image', label: 'wan2.6-image (图文混排)' },
    ] },
  ],
  gemini: [
    { group: '✨ Gemini', options: [
      { value: GEMINI_MODEL_ID, label: 'Gemini 3.1 Flash Image (预览)' },
      { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (预览)' },
    ] },
  ],
  openai: [
    { group: '🤖 GPT', options: [
      { value: 'gpt-image-2', label: 'GPT Image 2' },
    ] },
  ],
  volcengine: [
    { group: '🌋 即梦AI', options: [
      { value: 'jimeng-3.0-i2i', label: '即梦AI-图生图3.0' },
      { value: 'jimeng-material-product', label: '即梦AI-素材提取(商品提取)' },
      { value: 'jimeng-material-pod', label: '即梦AI-素材提取(POD按需定制)' },
      { value: 'jimeng-upscale', label: '即梦AI-智能超清' },
      { value: 'jimeng-inpainting', label: '即梦AI-交互编辑inpainting' },
      { value: 'jimeng-4.0', label: '即梦AI-图片生成4.0' },
      { value: 'jimeng-4.6', label: '即梦AI-图片生成4.6' },
    ] },
    { group: '✨ 即梦AI新功能', options: [
      { value: 'jimeng-seededit', label: '即梦AI-智能绘图(图生图)' },
      { value: 'jimeng-effect', label: '即梦AI-图像特效' },
      { value: 'jimeng-dressing', label: '即梦AI-图片换装' },
    ] },
    { group: '👤 即梦AI人像处理', options: [
      { value: 'jimeng-faceswap', label: '即梦AI-人像融合(多人)' },
      { value: 'jimeng-faceswap-ai', label: '即梦AI-人像融合(美颜)' },
      { value: 'jimeng-facepretty', label: '即梦AI-智能变美' },
    ] },
    { group: '🔧 即梦AI图像修复', options: [
      { value: 'jimeng-lqir', label: '即梦AI-智能画质增强' },
      { value: 'jimeng-nnsr2', label: '即梦AI-2倍超分' },
    ] },
  ],
  agnes: [
    { group: '🤖 Agnes AI', options: [
      { value: 'agnes-image-2.5-flash', label: 'Agnes Image 2.5 Flash (最新)' },
      { value: 'agnes-image-2.1-flash', label: 'Agnes Image 2.1 Flash (推荐)' },
      { value: 'agnes-image-2.0-flash', label: 'Agnes Image 2.0 Flash' },
    ] },
  ],
};

// 文生图模型提示文本
const T2I_MODEL_HINTS = {
  'wan2.7-image-pro': '万相2.7 Pro：最强画质，支持最高4K分辨率输出，适合高质量需求场景。',
  'wan2.7-image': '万相2.7：快速生成，最高2K，平衡速度与质量。',
  'wan2.6-image': '万相2.6：支持图文混排输入，适合需要文字渲染的场景。',
  'wan2.6-t2i': '万相2.6标准版：基础文生图能力。',
  'qwen-image-2.0-pro': '千问图片2.0 Pro：擅长文字渲染，支持中英文。',
  'qwen-image-3.0': '千问图片3.0：支持图文指令，10px小字、12国语言清晰渲染，1K/2K。',
  'qwen-image-3.0-pro': '千问图片3.0 Pro：最强版，复杂版面/密集信息/微细节，支持2K。',
  'gemini-3-pro-image-preview': 'Gemini 3 Pro Image 预览：Google 顶级图像生成模型，支持文生图和图生图。',
  'gemini-3.1-flash-image-preview': 'Gemini 3.1 Flash Image 预览：Google 高速图像模型，支持文生图和图生图。',
  'gpt-image-2': 'GPT Image 2：OpenAI 图像模型，支持文生图和图生图编辑。',
  'jimeng-3.0': '即梦文生图3.0：基础文生图。',
  'jimeng-3.1': '即梦文生图3.1：画质提升版。',
  'jimeng-4.0': '即梦图片生成4.0：高质量生成。',
  'jimeng-4.6': '即梦图片生成4.6：最新版本，画质最佳。',
  'agnes-image-2.5-flash': 'Agnes Image 2.5 Flash：最新一代，支持 1K-4K 档位与多图合成。',
  'agnes-image-2.1-flash': 'Agnes Image 2.1 Flash：推荐，高性能图像生成。',
  'agnes-image-2.0-flash': 'Agnes Image 2.0 Flash：基础版图像生成。',
};

// 视频模型提示文本
const VIDEO_MODEL_HINTS = {
  'happyhorse-1.1-t2v': 'HappyHorse 1.1 文生视频：推荐模型，高质量视频生成。',
  'happyhorse-1.0-t2v': 'HappyHorse 1.0 文生视频：基础版。',
  'happyhorse-1.1-r2v': 'HappyHorse 1.1 参考生视频：最多上传9张参考图，保持主体和场景风格一致。',
  'happyhorse-1.1-i2v': 'HappyHorse 1.1 图生视频：上传首帧图片生成视频。',
  'happyhorse-1.0-r2v': 'HappyHorse 1.0 参考生视频：最多上传9张参考图。',
  'happyhorse-1.0-i2v': 'HappyHorse 1.0 图生视频：基础版。',
  'wan2.7-t2v': '万相2.7 文生视频：支持文生视频。',
  'wan2.7-i2v': '万相2.7 图生视频：支持首帧/首尾帧。',
  'wan2.7-r2v': '万相2.7 参考生视频：支持图片+视频参考，最多5个。',
  'wan2.6-t2v': '万相2.6 文生视频。',
  'wan2.6-i2v-flash': '万相2.6 图生视频快速版。',
  'wan2.7-videoedit': '万相2.7 视频编辑：上传视频+参考图，用文字指令编辑视频元素。',
  'wan3.0-video': '万相3.0 视频：all-in-one，支持文/图生视频、参考、编辑、复刻、驱动，最长30秒。',
  'wan3.0-video-prime': '万相3.0 视频高速版：能力对齐 wan3.0-video，支持文/图生视频、视频生视频，最长30秒，端到端速度显著提升。',
  'jimeng-v3.0-t2v-1080p': '即梦视频3.0 文生视频1080P：高质量文生视频。',
  'jimeng-v3.0-t2v': '即梦视频3.0 文生视频720P。',
  'jimeng-v3.0-pro': '即梦视频3.0 Pro：文/图生视频，综合能力最强。',
  'jimeng-v3.0-i2v-first-1080p': '即梦视频3.0 图生视频首帧1080P。',
  'jimeng-v3.0-i2v-tail-1080p': '即梦视频3.0 图生视频首尾帧1080P。',
  'jimeng-v3.0-i2v-first': '即梦视频3.0 图生视频首帧720P。',
  'jimeng-v3.0-i2v-tail': '即梦视频3.0 图生视频首尾帧720P。',
  'jimeng-v3.0-recamera': '即梦视频3.0 运镜模板：上传图片+选择运镜模板+强度，生成运镜视频。',
  'jimeng-video-translate': '视频翻译2.0：上传视频URL，选择源语言和目标语言，保留口型和声音翻译。',
  'jimeng-motion-2.0': '动作模仿2.0：支持多人、非真人，上传人物图+模板视频。',
  'jimeng-motion-1.0': '动作模仿1.0：单人动作模仿。',
  'agnes-video-v2.0': 'Agnes Video V2.0：支持文生视频和图生视频。',
  'agnes-video-2.5': 'Agnes Video 2.5：新一代模型，支持 4-12 秒、720P-2K、多宽高比。',
  'agnes-video-2.5-flash': 'Agnes Video 2.5 Flash：新一代快速版，720P 输出。',
  'grok-video-1.0': 'Grok Video 1.0：文生视频/图生视频，最多7张参考图，支持16:9/9:16/1:1，480p/720p。',
  'grok-video-1.5': 'Grok Video 1.5：单图生视频（必须1张参考图），支持16:9/9:16，480p/720p。',
};

let VIDEO_MODELS = {
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

// 即梦视频模型列表（按模式区分）
const JIMENG_VIDEO_MODELS = {
  text2video: [
    { value: 'jimeng-v3.0-t2v-1080p', label: '即梦视频3.0-文生视频1080P' },
    { value: 'jimeng-v3.0-t2v', label: '即梦视频3.0-文生视频720P' },
    { value: 'jimeng-v3.0-pro', label: '即梦视频3.0 Pro（文/图生视频）' },
  ],
  image2video: [
    { value: 'jimeng-v3.0-pro', label: '即梦视频3.0 Pro（文/图生视频）' },
    { value: 'jimeng-v3.0-i2v-first-1080p', label: '即梦视频3.0-图生视频首帧1080P' },
    { value: 'jimeng-v3.0-i2v-tail-1080p', label: '即梦视频3.0-图生视频首尾帧1080P' },
    { value: 'jimeng-v3.0-i2v-first', label: '即梦视频3.0-图生视频首帧720P' },
    { value: 'jimeng-v3.0-i2v-tail', label: '即梦视频3.0-图生视频首尾帧720P' },
    { value: 'jimeng-v3.0-recamera', label: '即梦视频3.0-运镜模板' },
  ],
};

// 即梦动作模仿模型列表
const JIMENG_MOTION_MODELS = [
  { value: 'jimeng-motion-2.0', label: '动作模仿2.0（多人/非真人）' },
  { value: 'jimeng-motion-1.0', label: '动作模仿1.0' },
];

// 各模型支持的尺寸选项
const MODEL_SIZES = {
  // 万相 2.7
  'wan2.7-image-pro': ['1K', '2K', '4K'],
  'wan2.7-image': ['1K', '2K'],
  // 万相 2.6
  'wan2.6-image': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.6-t2i': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  // 千问 Qwen-Image
  'qwen-image-2.0-pro': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-3.0': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-3.0-pro': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  // Gemini
  [GEMINI_MODEL_ID]: [],
  // Volcengine Jimeng
  'jimeng-3.0': ['1K', '2K', '4K'],
  'jimeng-3.1': ['1K', '2K', '4K'],
  'jimeng-3.0-i2i': ['1K', '2K', '4K'],
  'jimeng-4.0': ['1K', '2K', '4K'],
  'jimeng-4.6': ['1K', '2K', '4K'],
};

const MODEL_SIZES_I2I = {
  'qwen-image-3.0': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-3.0-pro': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'wan2.7-image-pro': ['1K', '2K'],
  'wan2.7-image': ['1K', '2K'],
  'wan2.6-image': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  [GEMINI_MODEL_ID]: [],
  'jimeng-3.0-i2i': ['1K', '2K', '4K'],
  'jimeng-material-product': ['1K', '2K', '4K'],
  'jimeng-material-pod': ['1K', '2K', '4K'],
  'jimeng-upscale': [],
  'jimeng-inpainting': [],
  'jimeng-4.0': ['1K', '2K', '4K'],
  'jimeng-4.6': ['1K', '2K', '4K'],
};

function normalizeGeminiModel(model) {
  return model || GEMINI_MODEL_ID;
}

// DashScope 模型快照拼接：选择模型 + 输入快照日期 → 拼接为 model-snapshot
function applyModelSnapshot(model, provider, inputEl) {
  if (provider === 'dashscope' && inputEl) {
    const snap = inputEl.value.trim();
    if (snap) return `${model}-${snap}`;
  }
  return model;
}

function getModelStorageKey(mode, provider) {
  if (mode === 'video') return `model_video_${provider || 'dashscope'}`;
  return mode === 'image2image' ? `modelI2I_${provider}` : `model_${provider}`;
}

/**
 * 从存储读取凭证（优先从 localStorage 读取）
 * @param {string} key - 存储键
 * @returns {string} 存储的值
 */
function loadCredential(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key) || '';
}

function renderModelOptions(selectElement, groups, selectedValue) {
  selectElement.innerHTML = '';
  groups.forEach((group) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.group;
    group.options.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      optgroup.appendChild(option);
    });
    selectElement.appendChild(optgroup);
  });

  const availableValues = groups.flatMap(group => group.options.map(option => option.value));
  if (selectedValue && availableValues.includes(selectedValue)) {
    selectElement.value = selectedValue;
  }
}

function renderVideoModelOptions() {
  const provider = videoProvider ? videoProvider.value : 'dashscope';
  const mode = videoMode ? videoMode.value : 'text2video';
  const isMotion = mode === 'motion';
  const isTranslate = mode === 'translate';
  const savedModel = localStorage.getItem(getModelStorageKey('video', provider));

  if (isMotion) {
    renderModelOptions(videoModelSelect, [{ group: '即梦动作模仿', options: JIMENG_MOTION_MODELS }], savedModel);
  } else if (isTranslate) {
    renderModelOptions(videoModelSelect, [{ group: '视频翻译', options: [{ value: 'jimeng-video-translate', label: '视频翻译 2.0' }] }], savedModel);
  } else if (mode === 'videoedit') {
    renderModelOptions(videoModelSelect, [{ group: '视频编辑', options: [{ value: 'wan2.7-videoedit', label: 'wan2.7-videoedit（视频编辑）' }] }], savedModel);
  } else if (mode === 'r2v') {
    renderModelOptions(videoModelSelect, [{ group: '参考生视频', options: [
      { value: 'happyhorse-1.1-r2v', label: 'happyhorse-1.1-r2v（推荐，最多9图）' },
      { value: 'happyhorse-1.0-r2v', label: 'happyhorse-1.0-r2v（最多9图）' },
      { value: 'wan2.7-r2v', label: 'wan2.7-r2v（最多5个参考）' },
    ] }], savedModel);
  } else if (provider === 'agnes') {
    renderModelOptions(videoModelSelect, [{ group: 'Agnes AI 视频模型', options: [
      { value: 'agnes-video-2.5-flash', label: 'Agnes Video 2.5 Flash (最新)' },
      { value: 'agnes-video-2.5', label: 'Agnes Video 2.5' },
      { value: 'agnes-video-v2.0', label: 'Agnes Video V2.0' },
    ] }], savedModel);
  } else if (provider === 'xai') {
    const grokOptions = mode === 'image2video'
      ? [
        { value: 'grok-video-1.0', label: 'Grok Video 1.0（文/图生视频，最多7图）' },
        { value: 'grok-video-1.5', label: 'Grok Video 1.5（单图生视频）' },
      ]
      : [{ value: 'grok-video-1.0', label: 'Grok Video 1.0（文/图生视频，最多7图）' }];
    renderModelOptions(videoModelSelect, [{ group: 'Grok 视频模型', options: grokOptions }], savedModel);
  } else if (provider === 'volcengine') {
    const jimengModels = JIMENG_VIDEO_MODELS[mode] || JIMENG_VIDEO_MODELS.text2video;
    renderModelOptions(videoModelSelect, [{ group: '即梦AI视频模型', options: jimengModels }], savedModel);
  } else {
    renderModelOptions(videoModelSelect, [{ group: '阿里云百炼视频模型', options: VIDEO_MODELS[mode] || [] }], savedModel);
  }
}

async function loadVideoModels() {
  const apiKey = getStoredApiKey('dashscope');
  try {
    const res = await fetch(`/api/video-models?apiKey=${encodeURIComponent(apiKey)}`);
    const data = await res.json();
    if (res.ok && data.models) {
      VIDEO_MODELS = data.models;
      renderVideoModelOptions();
    }
  } catch (err) {
    renderVideoModelOptions();
  }
}

function setImageApiKeyMeta(provider) {
  if (provider === 'volcengine') {
    modelHintI2I.textContent = '即梦AI 4.0/4.6 支持参考图与多图生成';
  }

  if (provider === 'gemini') {
    modelHintI2I.textContent = 'Gemini 图生图支持参考图+文本联合生成';
  } else if (provider === 'volcengine') {
    const i2iModel = modelSelectI2I.value;
    if (i2iModel === 'jimeng-upscale') {
      modelHintI2I.textContent = '智能超清：上传 1 张原图；可选 4K/8K，scale 越高细节增强越明显。';
    } else if (i2iModel === 'jimeng-inpainting') {
      modelHintI2I.textContent = '交互编辑：上传 2 张图（原图 + Mask）；Mask 白色区域为重绘区，prompt 可填“删除”或编辑指令。';
    } else if (i2iModel === 'jimeng-material-product') {
      modelHintI2I.textContent = '素材提取(商品提取)：上传 1 张图；prompt 作为提取/编辑指令。';
    } else if (i2iModel === 'jimeng-material-pod') {
      modelHintI2I.textContent = '素材提取(POD按需定制)：上传 1 张图；可配 seed/宽高/lora_weight。';
    } else {
      modelHintI2I.textContent = '即梦图生图：支持本地上传参考图，也支持 image_urls（HTTP/HTTPS）输入。';
    }
  }

  // 图生图模式：上传参考图并输入提示词即可生成（非火山/Gemini 时）
  if (provider !== 'gemini' && provider !== 'volcengine') {
    modelHintI2I.textContent = '图生图模式：上传参考图并输入提示词即可生成。';
  }
  if (provider === 'volcengine') {
    volcengineImageUrlsGroup.classList.remove('d-none');
    if (volcengineLocalUploadHint) volcengineLocalUploadHint.classList.remove('d-none');
    if (uploadedImageFile) {
      imagePreview.classList.remove('d-none');
      uploadArea.classList.add('d-none');
    } else {
      imagePreview.classList.add('d-none');
      uploadArea.classList.remove('d-none');
    }
  } else {
    volcengineImageUrlsGroup.classList.add('d-none');
    if (volcengineLocalUploadHint) volcengineLocalUploadHint.classList.add('d-none');
    if (uploadedImageFile) {
      imagePreview.classList.remove('d-none');
      uploadArea.classList.add('d-none');
    } else {
      imagePreview.classList.add('d-none');
      uploadArea.classList.remove('d-none');
    }
  }

  const isInpainting = provider === 'volcengine' && modelSelectI2I.value === 'jimeng-inpainting';
  if (maskUploadGroup) maskUploadGroup.classList.toggle('d-none', !isInpainting);
  if (!isInpainting) {
    uploadedMaskFile = null;
    if (maskImageUpload) maskImageUpload.value = '';
    if (maskImagePreview) maskImagePreview.classList.add('d-none');
    if (maskUploadArea) maskUploadArea.classList.remove('d-none');
  }
}

function updateSizeOptions() {
  const model = modelSelect.value;
  const sizes = MODEL_SIZES[model] || [];
  imageSize.innerHTML = '<option value="auto">自动 (模型默认)</option>';
  sizes.forEach((size) => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    imageSize.appendChild(option);
  });
  imageSize.disabled = sizes.length === 0;
}

function updateSizeOptionsI2I() {
  // imageSize is shared between T2I and I2I modes; tab switch handlers call
  // the appropriate update function, so this intentionally overwrites options.
  const model = modelSelectI2I.value;
  const sizes = MODEL_SIZES_I2I[model] || [];
  imageSize.innerHTML = '<option value="auto">自动 (模型默认)</option>';
  sizes.forEach((size) => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    imageSize.appendChild(option);
  });
  imageSize.disabled = sizes.length === 0;
}

function updateTextProviderState() {
  const provider = providerSelect.value;
  const modelStorageKey = getModelStorageKey('text2image', provider);
  const savedModel = normalizeGeminiModel(localStorage.getItem(modelStorageKey));
  if (provider === 'gemini' && savedModel === GEMINI_MODEL_ID) {
    localStorage.setItem(modelStorageKey, GEMINI_MODEL_ID);
  }
  renderModelOptions(modelSelect, MODELS_T2I[provider], savedModel);
  updateSizeOptions();
  localStorage.setItem('provider', provider);
  if (modelSnapshotGroupT2I) modelSnapshotGroupT2I.classList.toggle('d-none', provider !== 'dashscope');
}

function updateImageProviderState() {
  const provider = providerSelectI2I.value;
  const modelStorageKey = getModelStorageKey('image2image', provider);
  const savedModel = normalizeGeminiModel(localStorage.getItem(modelStorageKey));
  if (provider === 'gemini' && savedModel === GEMINI_MODEL_ID) {
    localStorage.setItem(modelStorageKey, GEMINI_MODEL_ID);
  }
  renderModelOptions(modelSelectI2I, MODELS_I2I[provider], savedModel);
  setImageApiKeyMeta(provider);
  if (currentMode === 'image2image') {
    updateSizeOptionsI2I();
  }
  localStorage.setItem('providerI2I', provider);
  if (modelSnapshotGroupI2I) modelSnapshotGroupI2I.classList.toggle('d-none', provider !== 'dashscope');
}

function getActiveProvider() {
  if (currentMode === 'video') return 'dashscope';
  return currentMode === 'image2image' ? providerSelectI2I.value : providerSelect.value;
}

function updateVolcengineUiState() {
  const isVolcengine = getActiveProvider() === 'volcengine';
  const i2iModel = modelSelectI2I ? modelSelectI2I.value : '';
  const isSpecialVolcI2I = currentMode === 'image2image' && isVolcengine
    && (i2iModel === 'jimeng-upscale'
      || i2iModel === 'jimeng-inpainting'
      || i2iModel === 'jimeng-material-product'
      || i2iModel === 'jimeng-material-pod');
  if (genericSizeGroup) genericSizeGroup.classList.toggle('d-none', isVolcengine);
  if (genericSeedGroup) genericSeedGroup.classList.toggle('d-none', isVolcengine);
  if (volcengineParams) volcengineParams.classList.toggle('d-none', !isVolcengine || isSpecialVolcI2I);
  if (volcengineWatermarkGroup) volcengineWatermarkGroup.classList.toggle('d-none', !isVolcengine);
}

function updateI2ISpecialParamState() {
  const provider = providerSelectI2I ? providerSelectI2I.value : '';
  const model = modelSelectI2I ? modelSelectI2I.value : '';
  const isVolcengine = provider === 'volcengine';
  const isUpscale = isVolcengine && model === 'jimeng-upscale';
  const isInpainting = isVolcengine && model === 'jimeng-inpainting';
  const isMaterialProduct = isVolcengine && model === 'jimeng-material-product';
  const isMaterialPod = isVolcengine && model === 'jimeng-material-pod';
  const isSeededit = isVolcengine && model === 'jimeng-seededit';
  const isEffect = isVolcengine && model === 'jimeng-effect';
  const isDressing = isVolcengine && model === 'jimeng-dressing';
  const isFaceSwap = isVolcengine && (model === 'jimeng-faceswap' || model === 'jimeng-faceswap-ai');
  const isNewFeature = isSeededit || isEffect || isDressing || isFaceSwap;

  if (imageStrengthGroup) imageStrengthGroup.classList.toggle('d-none', isUpscale || isInpainting || isMaterialProduct || isMaterialPod || isNewFeature);
  if (upscaleParamsGroup) upscaleParamsGroup.classList.toggle('d-none', !isUpscale);
  if (inpaintingParamsGroup) inpaintingParamsGroup.classList.toggle('d-none', !isInpainting);
  if (materialProductParamsGroup) materialProductParamsGroup.classList.toggle('d-none', !isMaterialProduct);
  if (materialPodParamsGroup) materialPodParamsGroup.classList.toggle('d-none', !isMaterialPod);
  if (seededitParamsGroup) seededitParamsGroup.classList.toggle('d-none', !isSeededit);
  if (effectParamsGroup) effectParamsGroup.classList.toggle('d-none', !isEffect);
  if (dressingParamsGroup) dressingParamsGroup.classList.toggle('d-none', !isDressing);
  const isFaceSwapOrDressing = isFaceSwap || isDressing;
  if (templateUploadGroup) templateUploadGroup.classList.toggle('d-none', !isFaceSwapOrDressing);
  if (!isFaceSwapOrDressing) {
    uploadedTemplateFile = null;
    if (templateImageUpload) templateImageUpload.value = '';
    if (templateImagePreview) templateImagePreview.classList.add('d-none');
    if (templateUploadArea) templateUploadArea.classList.remove('d-none');
  }
  // 新功能模型提示文本
  if (isSeededit) modelHintI2I.textContent = '智能绘图：上传参考图 + 文字描述，按指令编辑图片（如换背景、改颜色）。';
  else if (isEffect) modelHintI2I.textContent = '图像特效：上传单人照片，选择特效模板生成创意图片。';
  else if (isDressing) modelHintI2I.textContent = '图片换装：上传模特图URL和服装图URL，自动换装。';
  else if (model === 'jimeng-faceswap' || model === 'jimeng-faceswap-ai') modelHintI2I.textContent = '人像融合：上传素材图（含人脸）+ 模板图，将素材人脸融合到模板中。';
  else if (model === 'jimeng-facepretty') modelHintI2I.textContent = '智能变美：上传含人脸的照片，自动美颜处理。支持单人或多人。';
  else if (model === 'jimeng-lqir' || model === 'jimeng-nnsr2') modelHintI2I.textContent = '图像修复：上传图片，智能画质增强或超分辨率处理。';
}

function updateVideoUiState() {
  const isVideo = currentMode === 'video';
  const isImageVideo = videoMode && videoMode.value === 'image2video';
  const isMotion = videoMode && videoMode.value === 'motion';
  const isTranslate = videoMode && videoMode.value === 'translate';
  const isVideoedit = videoMode && videoMode.value === 'videoedit';
  const isR2V = videoMode && videoMode.value === 'r2v';
  const isXaiGrok = videoProvider && videoProvider.value === 'xai' && isImageVideo;
  if (imageParamsPanel) imageParamsPanel.classList.toggle('d-none', isVideo);
  const selectedVideoModel = videoModelSelect ? videoModelSelect.value : '';
  const isRecamera = isImageVideo && selectedVideoModel === 'jimeng-v3.0-recamera';
  // 即梦 720P i2v 模型不支持帧上传（后端会拒绝），隐藏入口避免误用
  const isJimeng720I2V = videoProvider && videoProvider.value === 'volcengine' && isImageVideo
    && ['jimeng-v3.0-i2v-first', 'jimeng-v3.0-i2v-tail'].includes(selectedVideoModel);
  if (videoFrameGroup) videoFrameGroup.classList.toggle('d-none', !isImageVideo || isRecamera || isXaiGrok || isJimeng720I2V);
  if (r2vUploadGroup) r2vUploadGroup.classList.toggle('d-none', !isR2V && !isXaiGrok);
  if (recameraGroup) recameraGroup.classList.toggle('d-none', !isRecamera);
  if (isR2V && r2vFiles) {
    const r2vModel = videoModelSelect ? videoModelSelect.value : '';
    const isWan27R2V = r2vModel === 'wan2.7-r2v';
    r2vFiles.accept = isWan27R2V
      ? 'image/jpeg,image/jpg,image/png,image/bmp,image/webp,video/mp4,video/quicktime'
      : 'image/jpeg,image/jpg,image/png,image/bmp,image/webp';
    if (r2vFilesHint) {
      r2vFilesHint.textContent = isWan27R2V
        ? '最多9个：图片（JPG/PNG/BMP/WebP，最大20MB）或视频（MP4/MOV，1-30秒，最大100MB）'
        : '最多9张图片：JPG/PNG/BMP/WebP，最大 20MB';
    }
  }
  if (isXaiGrok && r2vFiles) {
    const grokModel = videoModelSelect ? videoModelSelect.value : '';
    r2vFiles.accept = 'image/jpeg,image/jpg,image/png,image/bmp,image/webp';
    if (r2vFilesHint) {
      r2vFilesHint.textContent = grokModel === 'grok-video-1.5'
        ? '必须且只能上传 1 张参考图（JPG/PNG/BMP/WebP）'
        : '最多上传 7 张参考图（JPG/PNG/BMP/WebP）';
    }
  }
  if (videoRatioGroup) videoRatioGroup.classList.toggle('d-none', isImageVideo || isMotion || isTranslate || isVideoedit);
  if (motionUploadGroup) motionUploadGroup.classList.toggle('d-none', !isMotion);
  if (videoTranslateGroup) videoTranslateGroup.classList.toggle('d-none', !isTranslate);
  if (videoeditUploadGroup) videoeditUploadGroup.classList.toggle('d-none', !isVideoedit);
  if (generateBtnVideo) generateBtnVideo.classList.toggle('d-none', !isVideo);
  if (textImageTaskRecordsPanel) textImageTaskRecordsPanel.classList.toggle('d-none', currentMode !== 'text2image');
  if (imageTaskRecordsPanel) imageTaskRecordsPanel.classList.toggle('d-none', currentMode !== 'image2image');
  const videoPromptGroup = document.getElementById('videoPromptInput')?.closest('.mb-3');
  if (videoPromptGroup) videoPromptGroup.classList.toggle('d-none', isMotion || isTranslate);
  const videoDurationGroup = document.getElementById('videoDuration')?.closest('.col-md-4');
  if (videoDurationGroup) videoDurationGroup.classList.toggle('d-none', isMotion || isTranslate || isVideoedit);
  const videoResolutionGroup = document.getElementById('videoResolution')?.closest('.col-md-4');
  if (videoResolutionGroup) videoResolutionGroup.classList.toggle('d-none', isMotion || isTranslate);
  if (videoProvider) {
    const dashscopeOption = videoProvider.querySelector('option[value="dashscope"]');
    const volcengineOption = videoProvider.querySelector('option[value="volcengine"]');
    const agnesOption = videoProvider.querySelector('option[value="agnes"]');
    const xaiOption = videoProvider.querySelector('option[value="xai"]');
    const agnesSupported = videoMode && (videoMode.value === 'text2video' || videoMode.value === 'image2video');
    if (dashscopeOption) dashscopeOption.hidden = isMotion || isTranslate;
    if (volcengineOption) volcengineOption.hidden = isVideoedit || isR2V;
    if (agnesOption) agnesOption.hidden = !agnesSupported;
    if (xaiOption) xaiOption.hidden = !agnesSupported;
    if ((isMotion || isTranslate) && videoProvider.value === 'dashscope') {
      videoProvider.value = 'volcengine';
      updateVideoProviderState();
    }
    if ((isVideoedit || isR2V) && videoProvider.value === 'volcengine') {
      videoProvider.value = 'dashscope';
      updateVideoProviderState();
    }
    if (!agnesSupported && (videoProvider.value === 'agnes' || videoProvider.value === 'xai')) {
      videoProvider.value = 'dashscope';
      updateVideoProviderState();
    }
  }
}

// 从 localStorage 恢复用户设置
providerSelect.value = localStorage.getItem('provider') || 'dashscope';
providerSelectI2I.value = localStorage.getItem('providerI2I') || 'dashscope';
if (videoMode && localStorage.getItem('videoMode')) videoMode.value = localStorage.getItem('videoMode');
if (videoProvider && localStorage.getItem('videoProvider')) videoProvider.value = localStorage.getItem('videoProvider');

if (localStorage.getItem('imageCount')) {
  imageCount.value = localStorage.getItem('imageCount');
}
if (localStorage.getItem('imageSize')) {
  imageSize.value = localStorage.getItem('imageSize');
}
if (localStorage.getItem('promptExtend') !== null) {
  promptExtend.checked = localStorage.getItem('promptExtend') === 'true';
}
if (localStorage.getItem('watermark') !== null) {
  watermarkToggle.checked = localStorage.getItem('watermark') === 'true';
}

updateTextProviderState();
updateImageProviderState();
updateVolcengineUiState();
updateI2ISpecialParamState();
renderVideoModelOptions();
updateVideoUiState();
loadVideoModels();

// 切换事件
providerSelect.addEventListener('change', () => {
  updateTextProviderState();
  updateVolcengineUiState();
  if (modelHintT2I && modelSelect) modelHintT2I.textContent = T2I_MODEL_HINTS[modelSelect.value] || '输入描述即可生成图片。';
});
providerSelectI2I.addEventListener('change', () => {
  updateImageProviderState();
  updateVolcengineUiState();
  updateI2ISpecialParamState();
});
if (videoMode) {
  videoMode.addEventListener('change', () => {
    localStorage.setItem('videoMode', videoMode.value);
    renderVideoModelOptions();
    updateVideoUiState();
    if (modelHintVideo && videoModelSelect) {
      modelHintVideo.textContent = VIDEO_MODEL_HINTS[videoModelSelect.value] || '';
    }
  });
}
if (refreshVideoModelsBtn) {
  refreshVideoModelsBtn.addEventListener('click', loadVideoModels);
}
if (videoModelSelect) {
  videoModelSelect.addEventListener('change', () => {
    const provider = videoProvider ? videoProvider.value : 'dashscope';
    localStorage.setItem(getModelStorageKey('video', provider), videoModelSelect.value);
    if (modelHintVideo) modelHintVideo.textContent = VIDEO_MODEL_HINTS[videoModelSelect.value] || '';
    updateVideoUiState();
  });
}

function updateVideoProviderState() {
  const provider = videoProvider ? videoProvider.value : 'dashscope';
  const isVolcengine = provider === 'volcengine';
  const isMotion = videoMode && videoMode.value === 'motion';
  const isImageVideo = videoMode && videoMode.value === 'image2video';
  if (modelSnapshotGroupVideo) modelSnapshotGroupVideo.classList.toggle('d-none', provider !== 'dashscope');
  if (refreshVideoModelsBtn) refreshVideoModelsBtn.classList.toggle('d-none', isVolcengine);

  // 渲染模型列表
  const savedModel = localStorage.getItem(getModelStorageKey('video', provider));
  if (isMotion) {
    // 动作模仿模式：强制使用即梦AI
    renderModelOptions(videoModelSelect, [{ group: '即梦动作模仿', options: JIMENG_MOTION_MODELS }], savedModel);
    if (videoProvider) videoProvider.value = 'volcengine';
  } else if (provider === 'agnes') {
    // Agnes 视频模型
    renderModelOptions(videoModelSelect, [{ group: 'Agnes AI 视频模型', options: [
      { value: 'agnes-video-2.5-flash', label: 'Agnes Video 2.5 Flash (最新)' },
      { value: 'agnes-video-2.5', label: 'Agnes Video 2.5' },
      { value: 'agnes-video-v2.0', label: 'Agnes Video V2.0' },
    ] }], savedModel);
  } else if (provider === 'xai') {
    const grokOptions = isImageVideo
      ? [
        { value: 'grok-video-1.0', label: 'Grok Video 1.0（文/图生视频，最多7图）' },
        { value: 'grok-video-1.5', label: 'Grok Video 1.5（单图生视频）' },
      ]
      : [{ value: 'grok-video-1.0', label: 'Grok Video 1.0（文/图生视频，最多7图）' }];
    renderModelOptions(videoModelSelect, [{ group: 'Grok 视频模型', options: grokOptions }], savedModel);
  } else if (isVolcengine) {
    const videoModeKey = isImageVideo ? 'image2video' : 'text2video';
    renderModelOptions(videoModelSelect, [{ group: '即梦AI视频模型', options: JIMENG_VIDEO_MODELS[videoModeKey] }], savedModel);
  } else {
    const mode = videoMode ? videoMode.value : 'text2video';
    if (mode === 'videoedit') {
      renderModelOptions(videoModelSelect, [{ group: '视频编辑', options: [{ value: 'wan2.7-videoedit', label: 'wan2.7-videoedit（视频编辑）' }] }], savedModel);
    } else if (mode === 'r2v') {
      renderModelOptions(videoModelSelect, [{ group: '参考生视频', options: [
        { value: 'happyhorse-1.1-r2v', label: 'happyhorse-1.1-r2v（推荐，最多9图）' },
        { value: 'happyhorse-1.0-r2v', label: 'happyhorse-1.0-r2v（最多9图）' },
        { value: 'wan2.7-r2v', label: 'wan2.7-r2v（支持图片+视频）' },
      ] }], savedModel);
    } else {
      renderModelOptions(videoModelSelect, [{ group: '阿里云百炼视频模型', options: VIDEO_MODELS[mode] || [] }], savedModel);
    }
  }

  // 更新图生视频帧图片提示
  if (videoFrameGroup) {
    const lastFrameLabel = videoFrameGroup.querySelector('label[for="videoLastFrame"]');
    if (lastFrameLabel) {
      lastFrameLabel.textContent = isVolcengine ? '尾帧图片（首尾帧模式可选）' : '尾帧图片（仅 2.7 可选）';
    }
  }
}

if (videoProvider) {
  videoProvider.addEventListener('change', () => {
    localStorage.setItem('videoProvider', videoProvider.value);
    updateVideoProviderState();
    if (modelHintVideo && videoModelSelect) {
      modelHintVideo.textContent = VIDEO_MODEL_HINTS[videoModelSelect.value] || '';
    }
  });
}

// 更新视频提供商状态
updateVideoProviderState();

if (importVideoTaskRecordsBtn) {
  importVideoTaskRecordsBtn.addEventListener('click', async () => {
    let legacyRecords = [];
    try {
      legacyRecords = JSON.parse(localStorage.getItem('videoTaskRecords') || '[]');
    } catch (err) {
      legacyRecords = [];
    }
    if (!Array.isArray(legacyRecords) || legacyRecords.length === 0) {
      showAlert('未发现浏览器旧任务记录', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/video-task-records/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: legacyRecords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '导入失败');
      await loadVideoTaskRecords();
      showAlert(`已导入 ${data.imported || 0} 条旧任务记录`, 'success');
    } catch (err) {
      showAlert(`导入失败: ${err.message}`);
    }
  });
}

async function fetchTaskById(inputEl, typeEl, providerEl) {
  const taskId = inputEl ? inputEl.value.trim() : '';
  if (!taskId) { showAlert('请输入任务ID'); return; }
  const provider = providerEl ? providerEl.value : 'dashscope';
  const resultType = typeEl ? typeEl.value : 'image';
  const endpoint = provider === 'volcengine' ? '/api/volcengine-task-status' : '/api/dashscope-task-status';
  const isVolcengine = provider === 'volcengine';
  const apiKey = getStoredApiKey(provider);
  setLoading(true, '正在查询任务状态...');
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, taskId, resultType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '查询失败');
    const status = data.taskStatus || 'UNKNOWN';
    if (status === 'SUCCEEDED') {
      if (data.videoUrl) {
        displayVideos([data.videoUrl]);
        upsertVideoTaskRecord({ taskId, provider, model: data.model || '', mode: 'fetch', status: 'SUCCEEDED', videoUrl: data.videoUrl, createdAt: Date.now() });
        showAlert('视频获取成功', 'success');
      } else if (data.imageUrls && data.imageUrls.length > 0) {
        displayImages(data.imageUrls);
        showAlert('图片获取成功', 'success');
      } else {
        showAlert('任务已完成但未返回内容', 'warning');
      }
    } else if (status === 'FAILED' || status === 'CANCELED') {
      showAlert(`任务已${status === 'FAILED' ? '失败' : '取消'}：${data.message || '无详细信息'}`);
    } else {
      showAlert(`任务状态：${getTaskStatusText(status)}，请稍后再试`, 'warning');
    }
  } catch (err) {
    showAlert(`查询失败: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

if (fetchTaskIdBtn) {
  fetchTaskIdBtn.addEventListener('click', () => fetchTaskById(fetchTaskIdInput, fetchTaskIdType, fetchTaskIdProvider));
}
if (fetchTextImageTaskIdBtn) {
  fetchTextImageTaskIdBtn.addEventListener('click', () => fetchTaskById(fetchTextImageTaskIdInput, fetchTextImageTaskIdType, fetchTextImageTaskIdProvider));
}
if (fetchI2ITaskIdBtn) {
  fetchI2ITaskIdBtn.addEventListener('click', () => fetchTaskById(fetchI2ITaskIdInput, fetchI2ITaskIdType, fetchI2ITaskIdProvider));
}

modelSelect.addEventListener('change', () => {
  const provider = providerSelect.value;
  updateSizeOptions();
  localStorage.setItem(getModelStorageKey('text2image', provider), modelSelect.value);
  if (modelHintT2I) modelHintT2I.textContent = T2I_MODEL_HINTS[modelSelect.value] || '输入描述即可生成图片。';
});

modelSelectI2I.addEventListener('change', () => {
  const provider = providerSelectI2I.value;
  updateSizeOptionsI2I();
  localStorage.setItem(getModelStorageKey('image2image', provider), modelSelectI2I.value);
  setImageApiKeyMeta(provider);
  updateVolcengineUiState();
  updateI2ISpecialParamState();
});

// 保存参数偏好到 localStorage
imageCount.addEventListener('change', () => {
  localStorage.setItem('imageCount', imageCount.value);
});

promptExtend.addEventListener('change', () => {
  localStorage.setItem('promptExtend', promptExtend.checked);
});

watermarkToggle.addEventListener('change', () => {
  localStorage.setItem('watermark', watermarkToggle.checked);
});

// API Key 显示/隐藏切换
function bindPasswordToggle(buttonEl, inputEl) {
  if (!buttonEl || !inputEl) return;
  buttonEl.addEventListener('click', () => {
    const isPassword = inputEl.type === 'password';
    inputEl.type = isPassword ? 'text' : 'password';
    buttonEl.innerHTML = `<i class="bi bi-eye${isPassword ? '-slash' : ''}"></i>`;
  });
}

// 设置页：按提供商统一保存 API Key（文生图 / 图生图 / 视频生成共用）
document.querySelectorAll('.settings-api-key-input').forEach((el) => {
  const provider = el.dataset.provider;
  el.value = loadCredential(`apiKey_${provider}`);
  el.addEventListener('input', () => {
    localStorage.setItem(`apiKey_${provider}`, el.value.trim());
  });
});
document.querySelectorAll('.settings-cred-input').forEach((el) => {
  el.value = loadCredential(el.dataset.cred);
  el.addEventListener('input', () => {
    localStorage.setItem(el.dataset.cred, el.value.trim());
  });
});
document.querySelectorAll('.settings-toggle-visibility').forEach((btn) => {
  bindPasswordToggle(btn, document.getElementById(btn.dataset.target));
});

// 设置/历史页只显示各自内容：隐藏/恢复三个生成模式共享的参数与结果区
const settingsTabEl = document.getElementById('settings-tab');
if (settingsTabEl) {
  const enterNonGenMode = () => document.body.classList.add('settings-active');
  settingsTabEl.addEventListener('shown.bs.tab', enterNonGenMode);
  const historyTabEl = document.getElementById('history-tab');
  if (historyTabEl) {
    historyTabEl.addEventListener('shown.bs.tab', () => { enterNonGenMode(); loadHistoryRecords(); });
  }
  ['text2image-tab', 'image2image-tab', 'video-tab'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('shown.bs.tab', () => document.body.classList.remove('settings-active'));
  });
}

// ---------- 生成内容历史与存储备份 ----------

// 当前生成上下文：供历史上报补充模型/提供商信息
let currentGenContext = { provider: '', model: '' };

function reportHistory(type, url) {
  if (!url || (!url.startsWith('http') && !url.startsWith('data:'))) return;
  fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, url, provider: currentGenContext.provider, model: currentGenContext.model }),
  }).then(async (res) => {
    if (!res.ok) console.warn('历史记录上报失败：', (await res.json().catch(() => ({}))).error || res.status);
  }).catch((e) => console.warn('历史记录上报失败：', e.message));
}

// ---------- 存储备份配置（设置页弹窗） ----------

const storageConfigBtn = document.getElementById('storageConfigBtn');
const storageStatusText = document.getElementById('storageStatusText');
const storageConfigModalEl = document.getElementById('storageConfigModal');
const storagePresetSelect = document.getElementById('storagePresetSelect');
const storageEndpointInput = document.getElementById('storageEndpointInput');
const storageRegionInput = document.getElementById('storageRegionInput');
const storageBucketInput = document.getElementById('storageBucketInput');
const storageAkInput = document.getElementById('storageAkInput');
const storageSkInput = document.getElementById('storageSkInput');
const storagePathStyleCheck = document.getElementById('storagePathStyleCheck');
const storageSaveBtn = document.getElementById('storageSaveBtn');
const storageDisableBtn = document.getElementById('storageDisableBtn');
const storageConfigAlert = document.getElementById('storageConfigAlert');
let storagePresets = {};
let storageModalInstance = null;

function showStorageAlert(message, type = 'danger') {
  storageConfigAlert.innerHTML = `<div class="alert alert-${type} py-2 mb-0">${escapeHtml(message)}</div>`;
}

function applyStoragePresetMeta(preset, cfg = {}) {
  const def = storagePresets[preset] || {};
  if (!cfg.endpoint) storageEndpointInput.placeholder = def.endpointPlaceholder || '';
  if (!cfg.region) storageRegionInput.value = def.region || '';
  storagePathStyleCheck.checked = cfg.pathStyle !== undefined ? !!cfg.pathStyle : !!def.pathStyle;
}

async function refreshStorageStatus() {
  try {
    const res = await fetch('/api/storage-config/view');
    const data = await res.json();
    storagePresets = data.presets || {};
    applyStoragePresetMeta(storagePresetSelect.value, data.config || {});
    const cfg = data.config;
    if (cfg.configured) {
      const state = cfg.enabled
        ? `已启用：${cfg.presetLabel} · 桶 ${cfg.bucket}`
        : `已配置但已停用：${cfg.presetLabel} · 桶 ${cfg.bucket}`;
      storageStatusText.textContent = state;
      storageDisableBtn.classList.toggle('d-none', !cfg.enabled);
    } else {
      storageStatusText.textContent = '未配置 — 生成内容不会备份，可对接 Cloudflare R2 / AWS S3 / OSS / COS / MinIO。';
      storageDisableBtn.classList.add('d-none');
    }
  } catch (e) {
    console.warn('读取存储配置失败：', e.message);
  }
}

if (storageConfigBtn) {
  storageConfigBtn.addEventListener('click', async () => {
    storageConfigAlert.innerHTML = '';
    await refreshStorageStatus();
    try {
      const res = await fetch('/api/storage-config/view');
      const { config } = await res.json();
      if (config.configured) {
        storagePresetSelect.value = config.preset || 'custom';
        storageEndpointInput.value = config.endpoint || '';
        storageEndpointInput.placeholder = '';
        storageRegionInput.value = config.region || '';
        storageBucketInput.value = config.bucket || '';
        storagePathStyleCheck.checked = !!config.pathStyle;
      }
    } catch { /* 打开弹窗时回填失败不阻塞 */ }
    if (!storageModalInstance) storageModalInstance = new bootstrap.Modal(storageConfigModalEl);
    storageModalInstance.show();
  });
}

if (storagePresetSelect) {
  storagePresetSelect.addEventListener('change', () => {
    storageEndpointInput.value = '';
    applyStoragePresetMeta(storagePresetSelect.value);
  });
}

if (storageSaveBtn) {
  storageSaveBtn.addEventListener('click', async () => {
    const payload = {
      preset: storagePresetSelect.value,
      endpoint: storageEndpointInput.value.trim(),
      region: storageRegionInput.value.trim(),
      bucket: storageBucketInput.value.trim(),
      accessKeyId: storageAkInput.value.trim(),
      secretAccessKey: storageSkInput.value.trim(),
      pathStyle: storagePathStyleCheck.checked,
    };
    if (!payload.endpoint || !payload.bucket || !payload.accessKeyId || !payload.secretAccessKey) {
      showStorageAlert('Endpoint、Bucket、Access Key ID、Secret Access Key 均为必填');
      return;
    }
    storageSaveBtn.disabled = true;
    storageSaveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>正在验证连接...';
    try {
      const res = await fetch('/api/storage-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      showStorageAlert('连接验证通过，备份已启用', 'success');
      storageSkInput.value = '';
      await refreshStorageStatus();
      setTimeout(() => storageModalInstance && storageModalInstance.hide(), 800);
    } catch (e) {
      showStorageAlert(`验证失败：${e.message}`);
    } finally {
      storageSaveBtn.disabled = false;
      storageSaveBtn.innerHTML = '<i class="bi bi-plug me-1"></i>测试并保存';
    }
  });
}

if (storageDisableBtn) {
  storageDisableBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/storage-config/disable', { method: 'POST' });
      if (!res.ok) throw new Error('停用失败');
      showStorageAlert('备份已停用', 'warning');
      await refreshStorageStatus();
    } catch (e) {
      showStorageAlert(e.message);
    }
  });
}

// ---------- 历史页 ----------

const historyListEl = document.getElementById('historyList');
const historyEmptyEl = document.getElementById('historyEmpty');
const historyFilterGroup = document.getElementById('historyFilterGroup');
const historyFromInput = document.getElementById('historyFromInput');
const historyToInput = document.getElementById('historyToInput');
const historyDateClearBtn = document.getElementById('historyDateClearBtn');
const historyPageSizeSelect = document.getElementById('historyPageSizeSelect');
const historyPrevBtn = document.getElementById('historyPrevBtn');
const historyNextBtn = document.getElementById('historyNextBtn');
const historyPageInfo = document.getElementById('historyPageInfo');
const historyPagerEl = document.getElementById('historyPager');

const historyState = { page: 1, pageSize: 20, type: '', from: '', to: '' };
let historyTotal = 0;
let historyLoadSeq = 0;

function historyPageCount() {
  return Math.max(1, Math.ceil(historyTotal / historyState.pageSize));
}

async function loadHistoryRecords() {
  const seq = ++historyLoadSeq;
  const params = new URLSearchParams({
    limit: String(historyState.pageSize),
    offset: String((historyState.page - 1) * historyState.pageSize),
  });
  if (historyState.type) params.set('type', historyState.type);
  if (historyState.from) params.set('from', historyState.from);
  if (historyState.to) params.set('to', historyState.to);
  try {
    const res = await fetch(`/api/history?${params}`);
    const data = await res.json();
    if (seq !== historyLoadSeq) return; // 已发起更新的筛选，丢弃过期响应
    if (!res.ok) throw new Error(data.error || '加载失败');
    historyTotal = data.total || 0;
    if (historyState.page > historyPageCount()) {
      historyState.page = historyPageCount();
      return loadHistoryRecords();
    }
    renderHistoryRecords(data.records || []);
    historyPageInfo.textContent = `共 ${historyTotal.toLocaleString('zh-CN')} 条记录 · 第 ${historyState.page} / ${historyPageCount()} 页`;
    historyPrevBtn.disabled = historyState.page <= 1;
    historyNextBtn.disabled = historyState.page >= historyPageCount();
    historyPagerEl.classList.toggle('d-none', historyTotal === 0);
  } catch (e) {
    if (seq === historyLoadSeq) showAlert(`加载历史记录失败：${e.message}`);
  }
}

function formatHistoryTime(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatHistorySize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderHistoryBadge(record) {
  switch (record.backupStatus) {
    case 'success': {
      const size = formatHistorySize(record.sizeBytes);
      return `<span class="badge bg-success"><i class="bi bi-cloud-check"></i> 已备份${size ? ` ${size}` : ''}</span>`;
    }
    case 'pending':
      return '<span class="badge bg-warning"><i class="bi bi-hourglass-split"></i> 备份中</span>';
    case 'failed':
      return `<span class="badge bg-danger" title="${escapeHtml(record.backupError)}"><i class="bi bi-cloud-slash"></i> 备份失败</span>`;
    default:
      return '<span class="badge bg-secondary">未启用备份</span>';
  }
}

function renderHistoryRecords(records) {
  historyListEl.innerHTML = '';
  records.forEach((record) => {
    const isImage = record.type === 'image';
    const item = document.createElement('div');
    item.className = 'border rounded p-2 mb-2 d-flex align-items-center gap-2 flex-wrap';
    item.innerHTML = `
      <span class="badge ${isImage ? 'bg-primary' : 'bg-info'}">
        <i class="bi ${isImage ? 'bi-image' : 'bi-camera-video'}"></i> ${isImage ? '图片' : '视频'}
      </span>
      <span class="text-muted small">${escapeHtml(formatHistoryTime(record.createdAt))}</span>
      <span class="small">${escapeHtml([record.provider, record.model].filter(Boolean).join(' · ') || '未知模型')}</span>
      ${renderHistoryBadge(record)}
      <div class="ms-auto d-flex gap-2">
        ${record.sourceUrl && record.sourceUrl.startsWith('http') ? `<a class="btn btn-sm btn-outline-secondary" href="${escapeHtml(record.sourceUrl)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> 原始链接</a>` : ''}
        ${record.backupStatus === 'success' ? `<a class="btn btn-sm btn-outline-primary" href="/api/history/${encodeURIComponent(record.id)}/download"><i class="bi bi-download"></i> 下载${isImage ? '图片' : '视频'}</a>` : ''}
        <button class="btn btn-sm btn-outline-danger history-delete-btn" type="button" data-id="${escapeHtml(record.id)}" data-backedup="${record.backupStatus === 'success' ? '1' : ''}"><i class="bi bi-trash"></i> 删除</button>
      </div>`;
    historyListEl.appendChild(item);
  });
  historyEmptyEl.classList.toggle('d-none', historyListEl.children.length === 0);
}

if (historyFilterGroup) {
  historyFilterGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    historyFilterGroup.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    historyState.type = btn.dataset.filter;
    historyState.page = 1;
    loadHistoryRecords();
  });
}

// 日期筛选与分页控件
if (historyFromInput) {
  historyFromInput.addEventListener('change', () => {
    historyState.from = historyFromInput.value || '';
    historyState.page = 1;
    loadHistoryRecords();
  });
}
if (historyToInput) {
  historyToInput.addEventListener('change', () => {
    historyState.to = historyToInput.value || '';
    historyState.page = 1;
    loadHistoryRecords();
  });
}
if (historyDateClearBtn) {
  historyDateClearBtn.addEventListener('click', () => {
    historyFromInput.value = '';
    historyToInput.value = '';
    historyState.from = '';
    historyState.to = '';
    historyState.page = 1;
    loadHistoryRecords();
  });
}
if (historyPageSizeSelect) {
  historyPageSizeSelect.addEventListener('change', () => {
    historyState.pageSize = Number.parseInt(historyPageSizeSelect.value, 10) || 20;
    historyState.page = 1;
    loadHistoryRecords();
  });
}
if (historyPrevBtn) {
  historyPrevBtn.addEventListener('click', () => {
    if (historyState.page <= 1) return;
    historyState.page -= 1;
    loadHistoryRecords();
  });
}
if (historyNextBtn) {
  historyNextBtn.addEventListener('click', () => {
    if (historyState.page >= historyPageCount()) return;
    historyState.page += 1;
    loadHistoryRecords();
  });
}

// 删除历史记录：已备份的会同时删除存储桶文件
if (historyListEl) {
  historyListEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.history-delete-btn');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    const willAlsoDeleteFile = btn.dataset.backedup === '1';
    const confirmed = window.confirm(willAlsoDeleteFile
      ? '确定删除这条记录吗？存储桶中已备份的文件将一并删除，且不可恢复。'
      : '确定删除这条记录吗？');
    if (!confirmed) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '删除失败');
      loadHistoryRecords();
    } catch (err) {
      showAlert(`删除失败：${err.message}`);
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-trash"></i> 删除';
    }
  });
}

refreshStorageStatus();

/**
 * 转义 HTML 特殊字符，防止 XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFriendlyErrorMessage(error, fallback = '生成失败', forceFailurePrefix = false) {
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
    collectCode(error.error?.code);
    collectMessage(error.message);
    collectMessage(error.error?.message);
  }
  const values = [...codes, ...messages];
  if (values.some(value => value.includes(FREE_TIER_QUOTA_ERROR_CODE))) {
    return FREE_TIER_QUOTA_ERROR_MESSAGE;
  }
  if (values.some(value => value.includes(FREE_TIER_QUOTA_ERROR_MESSAGE))) {
    return FREE_TIER_QUOTA_ERROR_MESSAGE;
  }
  const stripPrefix = value => String(value || '').replace(/^(?:生成失败[:：]\s*)+/, '').trim();
  const code = stripPrefix(codes.find(Boolean) || '');
  const message = stripPrefix(messages.find(value => stripPrefix(value) !== code) || fallback);
  if (!forceFailurePrefix && !code && !messages.some(value => /^生成失败[:：]/.test(value))) {
    return message || fallback;
  }
  if (code && message && message !== code) return `生成失败：${code} - ${message}`;
  if (code) return `生成失败：${code}`;
  return message && message !== '生成失败' ? `生成失败：${message}` : '生成失败';
}

function saveVideoTaskRecords() {
  videoTaskRecords = videoTaskRecords.slice(0, 20);
}

async function loadVideoTaskRecords() {
  if (!videoTaskRecordsEl) return;
  try {
    const res = await fetch('/api/video-task-records?limit=100');
    const data = await res.json();
    if (res.ok && Array.isArray(data.records)) {
      videoTaskRecords = data.records;
      renderVideoTaskRecords();
    }
  } catch (err) {
    renderVideoTaskRecords();
  }
}

function upsertVideoTaskRecord(record) {
  if (!record?.taskId) return;
  const existingIndex = videoTaskRecords.findIndex(item => item.taskId === record.taskId);
  const nextRecord = {
    ...(existingIndex >= 0 ? videoTaskRecords[existingIndex] : {}),
    ...record,
    updatedAt: Date.now(),
  };
  if (existingIndex >= 0) {
    videoTaskRecords.splice(existingIndex, 1);
  }
  videoTaskRecords.unshift(nextRecord);
  saveVideoTaskRecords();
  renderVideoTaskRecords();
}

function upsertImageTaskRecord(record) {
  if (!record?.id) return;
  const existingIndex = imageTaskRecords.findIndex(item => item.id === record.id);
  const nextRecord = {
    ...(existingIndex >= 0 ? imageTaskRecords[existingIndex] : {}),
    ...record,
    updatedAt: Date.now(),
  };
  if (existingIndex >= 0) {
    imageTaskRecords.splice(existingIndex, 1);
  }
  imageTaskRecords.unshift(nextRecord);
  renderImageTaskRecords('image2image');
}

function renderVideoTaskRecords() {
  if (!videoTaskRecordsEl || !videoTaskRecordsEmpty) return;
  videoTaskRecordsEmpty.classList.toggle('d-none', videoTaskRecords.length > 0);
  videoTaskRecordsEl.innerHTML = videoTaskRecords.map((record) => {
    const createdAt = record.createdAt ? new Date(record.createdAt).toLocaleString() : '';
    const statusText = getTaskStatusText(record.status);
    const params = `${record.mode === 'image2video' ? '图生视频' : '文生视频'} · ${record.duration || '-'}秒 · ${record.resolution || '-'}`;
    const usage = record.usage?.output_video_duration || record.usage?.duration || '';
    const usageText = usage ? ` · 输出${usage}秒` : '';
    const link = record.videoUrl
      ? `<a href="${escapeHtml(record.videoUrl)}" target="_blank" class="btn btn-sm btn-outline-primary ms-2">打开</a>`
      : '';
    return `
      <div class="list-group-item">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="text-break">
            <div class="fw-semibold">${escapeHtml(record.model || '')}</div>
            <div class="text-muted">${escapeHtml(params)} · ${escapeHtml(statusText)}${escapeHtml(usageText)}</div>
            <div class="text-muted">任务ID：${escapeHtml(record.taskId)}</div>
          </div>
          <div class="text-end flex-shrink-0">
            <div class="text-muted">${escapeHtml(createdAt)}</div>
            ${link}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

loadVideoTaskRecords();

async function loadImageTaskRecords(mode) {
  const targetList = mode === 'image2image' ? imageTaskRecordsEl : textImageTaskRecordsEl;
  if (!targetList) return;
  try {
    const res = await fetch(`/api/image-task-records?mode=${encodeURIComponent(mode)}&limit=100`);
    const data = await res.json();
    if (res.ok && Array.isArray(data.records)) {
      if (mode === 'image2image') {
        imageTaskRecords = data.records;
      } else {
        textImageTaskRecords = data.records;
      }
      renderImageTaskRecords(mode);
    }
  } catch (err) {
    renderImageTaskRecords(mode);
  }
}

function renderImageTaskRecords(mode) {
  const records = mode === 'image2image' ? imageTaskRecords : textImageTaskRecords;
  const listEl = mode === 'image2image' ? imageTaskRecordsEl : textImageTaskRecordsEl;
  const emptyEl = mode === 'image2image' ? imageTaskRecordsEmpty : textImageTaskRecordsEmpty;
  if (!listEl || !emptyEl) return;
  emptyEl.classList.toggle('d-none', records.length > 0);
  listEl.innerHTML = records.map((record) => {
    const createdAt = record.createdAt ? new Date(record.createdAt).toLocaleString() : '';
    const statusText = getTaskStatusText(record.status);
    const count = Array.isArray(record.imageUrls) ? record.imageUrls.length : 0;
    const preview = count > 0
      ? `<a href="${escapeHtml(record.imageUrls[0])}" target="_blank" class="btn btn-sm btn-outline-primary ms-2">打开</a>`
      : '';
    return `
      <div class="list-group-item">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="text-break">
            <div class="fw-semibold">${escapeHtml(record.model || '')}</div>
            <div class="text-muted">${escapeHtml(record.provider || '')} · ${escapeHtml(statusText)} · ${count || '-'}张</div>
            ${record.taskId ? `<div class="text-muted">任务ID：${escapeHtml(record.taskId)}</div>` : ''}
          </div>
          <div class="text-end flex-shrink-0">
            <div class="text-muted">${escapeHtml(createdAt)}</div>
            ${preview}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

loadImageTaskRecords('text2image');
loadImageTaskRecords('image2image');

/**
 * 显示提示信息
 * @param {string} message - 提示内容
 * @param {string} type - 提示类型 (danger/success)
 */
function showAlert(message, type = 'danger') {
  const safeType = escapeHtml(type);
  const safeMessage = escapeHtml(type === 'danger' ? getFriendlyErrorMessage(message, '操作失败') : message);
  alertContainer.innerHTML = `
    <div class="alert alert-${safeType} alert-dismissible fade show" role="alert">
      ${safeMessage}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
}

/**
 * 设置加载状态
 * @param {boolean} isLoading - 是否加载中
 * @param {string} message - 可选的加载提示消息
 */
function setLoading(isLoading, message = '正在生成图片，请稍候...') {
  const imageContainer = document.getElementById('imageContainer');
  
  generateBtn.disabled = isLoading;
  generateBtnI2I.disabled = isLoading;
  if (generateBtnVideo) generateBtnVideo.disabled = isLoading;
  placeholder.classList.toggle('d-none', isLoading);
  loading.classList.toggle('d-none', !isLoading);
  resultImages.classList.toggle('d-none', isLoading);
  
  // 加载时隐藏灰色背景框
  if (isLoading) {
    imageContainer.classList.add('has-images');
  }

  // 更新加载提示文本
  const loadingText = loading.querySelector('p');
  if (loadingText) {
    loadingText.textContent = message;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatElapsed(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}分${restSeconds}秒` : `${restSeconds}秒`;
}

function getTaskStatusText(status) {
  const labels = {
    PENDING: '排队中',
    RUNNING: '生成中',
    SUCCEEDED: '已完成',
    FAILED: '失败',
    CANCELED: '已取消',
    UNKNOWN: '状态未知',
  };
  return labels[status] || status || '查询中';
}

async function pollActiveTaskOnce() {
  if (!activeTaskContext) return;
  const { endpoint, payload, resultType, onTaskUpdate } = activeTaskContext;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return;
    const status = data.taskStatus || 'PENDING';
    if (onTaskUpdate) onTaskUpdate(data, status);
    if (status === 'SUCCEEDED') {
      activeTaskContext = null;
      if (resultType === 'video') {
        if (data.videoUrl) displayVideos([data.videoUrl]);
      } else {
        if (Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
          displayImages(data.imageUrls);
        }
      }
      setLoading(false);
    }
  } catch {
    // 静默处理，主轮询循环负责错误处理
  }
}

async function pollGenerationTask({ endpoint, payload, resultType, title, maxAttempts = GENERATION_PROGRESS_MAX_POLL_ATTEMPTS, onTaskUpdate }) {
  const startedAt = Date.now();
  let attempt = 0;
  activeTaskContext = { endpoint, payload, resultType, title, onTaskUpdate };
  let consecutiveErrors = 0;
  try {
    while (!maxAttempts || attempt < maxAttempts) {
      await sleep(GENERATION_PROGRESS_POLL_INTERVAL_MS);
      let res; let data;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
      } catch (netErr) {
        consecutiveErrors += 1;
        const elapsed = formatElapsed(Date.now() - startedAt);
        if (consecutiveErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
          throw new Error(`网络请求连续 ${consecutiveErrors} 次失败（已等待 ${elapsed}）：${netErr.message || '连接中断'}。请检查网络后重试。`);
        }
        setLoading(true, `${title}：网络异常（${netErr.message || '连接中断'}），第${consecutiveErrors}次重试...`);
        await sleep(NETWORK_ERROR_RETRY_DELAY_MS);
        continue;
      }
      consecutiveErrors = 0;

      if (!res.ok) {
        throw new Error(getFriendlyErrorMessage(data.error || data, '查询任务失败', true));
      }

      const status = data.taskStatus || 'PENDING';
      const progressText = typeof data.progress === 'number' && data.progress >= 0 ? ` (${data.progress}%)` : '';
      setLoading(true, `${title}：${getTaskStatusText(status)}${progressText}，已等待 ${formatElapsed(Date.now() - startedAt)}，任务ID ${data.taskId || payload.taskId}`);
      if (onTaskUpdate) onTaskUpdate(data, status);

      if (status === 'SUCCEEDED') {
        if (!activeTaskContext) return;
        if (resultType === 'video') {
          if (!data.videoUrl) throw new Error('任务完成但未返回视频 URL');
          displayVideos([data.videoUrl]);
        } else {
          if (!Array.isArray(data.imageUrls) || data.imageUrls.length === 0) {
            throw new Error('任务完成但未返回图片 URL');
          }
          displayImages(data.imageUrls);
        }
        return;
      }
      if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
        throw new Error(getFriendlyErrorMessage(data.message || data, `任务状态异常：${status}`, true));
      }
      attempt += 1;
    }
    throw new Error('任务查询超时');
  } finally {
    activeTaskContext = null;
  }
}

async function handleGenerationResult(data, { apiKey, model, resultType, title, mode, onTaskUpdate }) {
  currentGenContext.model = data.model || model || currentGenContext.model;
  if (data.taskId) {
    const endpoint = data.provider === 'volcengine' ? '/api/volcengine-task-status'
      : data.provider === 'agnes' ? '/api/agnes-task-status'
      : data.provider === 'xai' ? '/api/grok-task-status'
      : '/api/dashscope-task-status';
    setLoading(true, `${title}：${getTaskStatusText(data.taskStatus)}，任务ID ${data.taskId}`);
    await pollGenerationTask({
      endpoint,
      payload: {
        apiKey,
        taskId: data.taskId,
        videoId: data.videoId,
        model: data.model || model,
        resultType,
        mode,
        queryAction: data.queryAction,
      },
      resultType,
      title,
      maxAttempts: resultType === 'video' ? VIDEO_PROGRESS_MAX_POLL_ATTEMPTS : GENERATION_PROGRESS_MAX_POLL_ATTEMPTS,
      onTaskUpdate,
    });
    return;
  }
  if (resultType === 'video') {
    displayVideos([data.videoUrl]);
  } else {
    displayImages(data.imageUrls);
  }
}

function validateVolcengineSizeAndRatio({ model, size, width, height }) {
  const isJimengT2IV3 = model === 'jimeng-3.0' || model === 'jimeng-3.1';
  const isJimengI2IV30 = model === 'jimeng-3.0-i2i';

  const minArea = isJimengT2IV3 ? 512 * 512 : 1024 * 1024;
  const maxArea = isJimengT2IV3 ? 2048 * 2048 : 4096 * 4096;
  const minRatio = isJimengT2IV3 ? (1 / 3) : (1 / 16);
  const maxRatio = isJimengT2IV3 ? 3 : 16;
  const minEdge = isJimengI2IV30 ? 512 : 1;
  const maxEdge = isJimengI2IV30 ? 2016 : Number.MAX_SAFE_INTEGER;

  if (size !== undefined) {
    if (!Number.isInteger(size) || size < minArea || size > maxArea) {
      if (isJimengT2IV3) {
        return `${model} 参数错误：size 需在 262144 到 4194304 之间。`;
      }
      return 'Volcengine 参数错误：size 需在 1048576 到 16777216 之间。';
    }
  }

  const hasWidth = width !== undefined;
  const hasHeight = height !== undefined;
  if (hasWidth !== hasHeight) {
    return 'Volcengine 参数错误：width 和 height 必须同时填写。';
  }

  if (hasWidth && hasHeight) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      return 'Volcengine 参数错误：width/height 必须为正整数。';
    }
    if ((width < minEdge || width > maxEdge) || (height < minEdge || height > maxEdge)) {
      if (isJimengI2IV30) {
        return 'jimeng-3.0-i2i 参数错误：width/height 需在 512 到 2016 之间。';
      }
      return 'Volcengine 参数错误：width/height 超出允许范围。';
    }
    const area = width * height;
    if (area < minArea || area > maxArea) {
      if (isJimengT2IV3) {
        return `${model} 参数错误：width*height 需在 262144 到 4194304 之间。`;
      }
      return 'Volcengine 参数错误：width*height 需在 1048576 到 16777216 之间。';
    }
    const ratio = width / height;
    if (ratio < minRatio || ratio > maxRatio) {
      if (isJimengT2IV3) {
        return `${model} 参数错误：宽高比需在 1/3 到 3 之间。`;
      }
      return 'Volcengine 参数错误：宽高比需在 1/16 到 16 之间。';
    }
  }

  return null;
}

function validateVolcengineImageUrls(urls, model) {
  if (!Array.isArray(urls)) return null;
  if (model === 'jimeng-3.0-i2i' && urls.length !== 1) {
    return 'Volcengine 参数错误：jimeng-3.0-i2i 必须且仅支持 1 张参考图 URL。';
  }
  if (model === 'jimeng-upscale' && urls.length !== 1) {
    return 'Volcengine 参数错误：jimeng-upscale 必须且仅支持 1 张参考图 URL。';
  }
  if (model === 'jimeng-material-product' && urls.length !== 1) {
    return 'Volcengine 参数错误：jimeng-material-product 必须且仅支持 1 张参考图 URL。';
  }
  if (model === 'jimeng-material-pod' && urls.length !== 1) {
    return 'Volcengine 参数错误：jimeng-material-pod 必须且仅支持 1 张参考图 URL。';
  }
  if (model === 'jimeng-inpainting' && urls.length !== 2) {
    return 'Volcengine 参数错误：jimeng-inpainting 需要 2 张参考图 URL（原图+mask图）。';
  }
  const maxCount = (model === 'jimeng-4.0' || model === 'jimeng-3.0-i2i') ? 10 : 14;
  if (urls.length > maxCount) {
    return `Volcengine 参数错误：${model} 最多支持 ${maxCount} 张参考图 URL。`;
  }
  return null;
}

/**
 * 展示生成的图片 (支持多张网格布局)
 * @param {string[]} imageUrls - 图片 URL 数组
 */
function displayImages(imageUrls) {
  // 上报历史（后端按配置决定是否转存到存储桶）
  (imageUrls || []).forEach((url) => reportHistory('image', url));
  // 隐藏 placeholder 和加载状态，显示图片容器
  const imageContainer = document.getElementById('imageContainer');
  imageContainer.classList.add('has-images');
  placeholder.classList.add('d-none');
  loading.classList.add('d-none');

  resultImages.innerHTML = '';
  const count = imageUrls.length;
  const gridClass = count <= 4 ? `grid-${count}` : 'grid-4';
  resultImages.className = `result-images-grid ${gridClass}`;

  // 初始化预览模态框
  const previewModal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
  const modalImage = document.getElementById('modalPreviewImage');
  const modalDownloadLink = document.getElementById('modalDownloadLink');

  imageUrls.forEach((url, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-wrapper';

    const img = document.createElement('img');
    img.alt = `生成的图片 ${index + 1}`;
    img.loading = 'lazy';

    // 图片加载错误处理
    img.onerror = () => {
      wrapper.innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center bg-light rounded" style="min-height: 200px;">
          <i class="bi bi-image text-muted fs-1"></i>
          <small class="text-muted mt-2">图片加载失败</small>
          <a href="${url}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">
            <i class="bi bi-box-arrow-up-right"></i> 在新窗口打开
          </a>
        </div>
      `;
    };

    // 图片加载成功后添加点击预览
    img.onload = () => {
      img.addEventListener('click', () => {
        modalImage.src = url;
        setupDownloadLink(url, `generated-image-${index + 1}.png`);
        previewModal.show();
      });
    };

    img.src = url;
    wrapper.appendChild(img);
    resultImages.appendChild(wrapper);
  });

  resultImages.classList.remove('d-none');
  downloadBtn.classList.remove('d-none');
  setupDownloadLink(imageUrls[0], 'generated-image-1.png');
}

function setupDownloadLink(url, filename) {
  downloadLink.href = '#';
  downloadLink.onclick = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };
}

function displayVideos(videoUrls) {
  // 上报历史（后端按配置决定是否转存到存储桶）
  (videoUrls || []).forEach((url) => reportHistory('video', url));
  const imageContainer = document.getElementById('imageContainer');
  imageContainer.classList.add('has-images');
  placeholder.classList.add('d-none');
  loading.classList.add('d-none');
  resultImages.innerHTML = '';
  resultImages.className = 'w-100';

  videoUrls.forEach((url) => {
    const video = document.createElement('video');
    video.className = 'w-100 rounded bg-dark';
    video.controls = true;
    video.src = url;
    resultImages.appendChild(video);
  });

  resultImages.classList.remove('d-none');
  downloadBtn.classList.remove('d-none');
  setupDownloadLink(videoUrls[0], 'generated-video.mp4');
}

// 生成按钮点击事件
generateBtn.addEventListener('click', async () => {
  const provider = providerSelect.value;
  const apiKey = getStoredApiKey(provider);
  const model = applyModelSnapshot(modelSelect.value, provider, modelSnapshotT2I);
  currentGenContext = { provider, model };
  const prompt = promptInput.value.trim();
  const n = parseInt(imageCount.value, 10);
  const genericSize = imageSize.value === 'auto' ? undefined : imageSize.value;
  const volcengineSizeVal = volcengineSize && volcengineSize.value !== 'auto' ? parseInt(volcengineSize.value, 10) : undefined;
  const volcengineWidthVal = volcengineWidth && volcengineWidth.value ? parseInt(volcengineWidth.value, 10) : undefined;
  const volcengineHeightVal = volcengineHeight && volcengineHeight.value ? parseInt(volcengineHeight.value, 10) : undefined;
  const size = provider === 'volcengine' ? volcengineSizeVal : genericSize;
  const seed = seedInput.value ? parseInt(seedInput.value, 10) : undefined;
  const negativePromptVal = negativePrompt.value.trim() || undefined;
  const promptExtendVal = promptExtend.checked;
  const watermarkVal = provider === 'volcengine'
    ? (volcengineWatermarkToggle ? volcengineWatermarkToggle.checked : false)
    : watermarkToggle.checked;

  if (!prompt) {
    showAlert('请输入图片描述');
    return;
  }

  if (provider === 'volcengine' && !!loadCredential('volcengineAk') !== !!loadCredential('volcengineSk')) {
    showAlert('Volcengine AK/SK 需同时填写，或同时留空使用服务端环境变量（请在"设置"页修改）。');
    return;
  }

  if (provider === 'volcengine') {
    const volcParamErr = validateVolcengineSizeAndRatio({
      model,
      size,
      width: volcengineWidthVal,
      height: volcengineHeightVal,
    });
    if (volcParamErr) {
      showAlert(volcParamErr);
      return;
    }
  }

  if (!(await ensureForegroundRecoveredBeforeGenerate())) return;

  localStorage.setItem(getModelStorageKey('text2image', provider), model);
  if (genericSize) localStorage.setItem('imageSize', imageSize.value);

  alertContainer.innerHTML = '';
  setLoading(true);
  downloadBtn.classList.add('d-none');

  // 生成阶段等待提示：同步模型（响应不带 taskId）也能看到“已等待 X”；
  // 一旦进入任务轮询（activeTaskContext 已设置），文案由轮询接管。
  const t2iElapsedStartedAt = Date.now();
  let t2iElapsedTimer = null;
  const t2iStopTimer = () => {
    if (t2iElapsedTimer) {
      clearInterval(t2iElapsedTimer);
      t2iElapsedTimer = null;
    }
  };
  t2iElapsedTimer = setInterval(() => {
    if (activeTaskContext) return;
    setLoading(true, `正在生成图片（已等待 ${formatElapsed(Date.now() - t2iElapsedStartedAt)}）...`);
  }, 1000);

  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey,
        model,
        prompt,
        progressMode: true,
        parameters: {
          n,
          size,
          width: provider === 'volcengine' ? volcengineWidthVal : undefined,
          height: provider === 'volcengine' ? volcengineHeightVal : undefined,
          seed,
          negative_prompt: negativePromptVal,
          prompt_extend: promptExtendVal,
          watermark: watermarkVal,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
    }

    await handleGenerationResult(data, {
      apiKey,
      model,
      resultType: 'image',
      title: '图片生成',
      mode: 'text2image',
      onTaskUpdate: () => loadImageTaskRecords('text2image'),
    });
    await loadImageTaskRecords('text2image');
    t2iStopTimer();
    setLoading(false);
  } catch (err) {
    t2iStopTimer();
    setLoading(false);
    showAlert(`生成失败: ${err.message}`);
  }
});

if (generateBtnVideo) {
  generateBtnVideo.addEventListener('click', async () => {
    const provider = videoProvider ? videoProvider.value : 'dashscope';
    const mode = videoMode.value;
    const apiKey = getStoredApiKey(provider);
    const model = applyModelSnapshot(videoModelSelect.value, provider, modelSnapshotVideo);
    currentGenContext = { provider, model };
    const prompt = videoPromptInput.value.trim();
    const firstFrame = videoFirstFrame.files[0];
    const lastFrame = videoLastFrame.files[0];
    const motionImageFile = motionImage.files[0];
    const motionVideoFile = motionVideo.files[0];
    const seed = seedInput.value ? parseInt(seedInput.value, 10) : undefined;

    // 视频编辑模式
    if (mode === 'videoedit') {
      const videoFile = videoeditVideo ? videoeditVideo.files[0] : null;
      const refImageFile = videoeditRefImage ? videoeditRefImage.files[0] : null;
      if (!videoFile) { showAlert('请上传待编辑的视频'); return; }
      if (!prompt) { showAlert('请输入视频编辑指令'); return; }
      if (!(await ensureForegroundRecoveredBeforeGenerate())) return;
      localStorage.setItem(getModelStorageKey('video', provider), model);
      alertContainer.innerHTML = '';
      setLoading(true, '正在提交视频编辑任务...');
      downloadBtn.classList.add('d-none');
      const fd = new FormData();
      fd.append('apiKey', apiKey);
      fd.append('mode', 'videoedit');
      fd.append('model', model);
      fd.append('prompt', prompt);
      fd.append('progressMode', 'true');
      fd.append('videoFile', videoFile);
      if (refImageFile) fd.append('refImage', refImageFile);
      fd.append('parameters', JSON.stringify({
        resolution: videoResolution ? videoResolution.value : '720P',
        prompt_extend: promptExtend.checked,
        watermark: watermarkToggle.checked,
        seed,
      }));
      let activeVideoTaskId = '';
      try {
        const res = await fetch('/api/generate-video', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
        if (data.taskId) {
          activeVideoTaskId = data.taskId;
          upsertVideoTaskRecord({ taskId: data.taskId, provider: 'dashscope', model, mode: 'videoedit', status: data.taskStatus || 'PENDING', createdAt: Date.now() });
        }
        await handleGenerationResult(data, {
          apiKey, model, resultType: 'video', title: '视频编辑',
          onTaskUpdate: (taskData, status) => { upsertVideoTaskRecord({ taskId: taskData.taskId || activeVideoTaskId, status, videoUrl: taskData.videoUrl, usage: taskData.usage }); },
        });
        setLoading(false);
      } catch (err) {
        if (activeVideoTaskId) {
          const existingRecord = videoTaskRecords.find(item => item.taskId === activeVideoTaskId);
          if (!['FAILED', 'CANCELED', 'UNKNOWN'].includes(existingRecord?.status)) {
            upsertVideoTaskRecord({ taskId: activeVideoTaskId, status: 'FAILED', error: err.message });
          }
        }
        setLoading(false);
        showAlert(`生成失败: ${err.message}`);
      }
      return;
    }

    // 视频翻译模式
    if (mode === 'translate') {
      const videoUrl = videoTranslateUrl ? videoTranslateUrl.value.trim() : '';
      const srcLang = srcLanguage ? srcLanguage.value : '';
      const targetLang = targetLanguage ? targetLanguage.value : '';
      if (!videoUrl) { showAlert('请输入待翻译视频 URL'); return; }
      if (!srcLang) { showAlert('请选择原始语种'); return; }
      if (!targetLang) { showAlert('请选择目标语种'); return; }
      if (!(await ensureForegroundRecoveredBeforeGenerate())) return;
      localStorage.setItem(getModelStorageKey('video', provider), model);
      alertContainer.innerHTML = '';
      setLoading(true, '正在提交视频翻译任务...');
      downloadBtn.classList.add('d-none');
      let activeVideoTaskId = '';
      try {
        const res = await fetch('/api/volcengine-video-translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, videoUrl, srcLanguage: srcLang, targetLanguage: targetLang }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
        if (data.taskId) {
          activeVideoTaskId = data.taskId;
          upsertVideoTaskRecord({ taskId: data.taskId, provider, model, mode: 'translate', status: data.taskStatus || 'PENDING', createdAt: Date.now() });
        }
        await handleGenerationResult(data, {
          apiKey, model, resultType: 'video', title: '视频翻译',
          onTaskUpdate: (taskData, status) => {
            upsertVideoTaskRecord({ taskId: taskData.taskId || activeVideoTaskId, status, videoUrl: taskData.videoUrl, usage: taskData.usage });
          },
        });
        setLoading(false);
      } catch (err) {
        if (activeVideoTaskId) {
          const existingRecord = videoTaskRecords.find(item => item.taskId === activeVideoTaskId);
          if (!['FAILED', 'CANCELED', 'UNKNOWN'].includes(existingRecord?.status)) {
            upsertVideoTaskRecord({ taskId: activeVideoTaskId, status: 'FAILED', error: err.message });
          }
        }
        setLoading(false);
        showAlert(`生成失败: ${err.message}`);
      }
      return;
    }

    // 动作模仿模式
    if (mode === 'motion') {
      if (!motionImageFile) { showAlert('请上传人物图片'); return; }
      if (!motionVideoFile) { showAlert('请上传模板视频'); return; }
      if (!(await ensureForegroundRecoveredBeforeGenerate())) return;
      localStorage.setItem(getModelStorageKey('video', provider), model);
      alertContainer.innerHTML = '';
      setLoading(true, '正在生成动作模仿视频，请耐心等待...');
      downloadBtn.classList.add('d-none');

      const formData = new FormData();
      formData.append('apiKey', apiKey);
      formData.append('model', model);
      formData.append('motionImage', motionImageFile);
      formData.append('motionVideo', motionVideoFile);

      let activeVideoTaskId = '';
      try {
        const res = await fetch('/api/jimeng-motion', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
        if (data.taskId) {
          activeVideoTaskId = data.taskId;
          upsertVideoTaskRecord({ taskId: data.taskId, provider, model, mode: 'motion', status: data.taskStatus || 'PENDING', createdAt: Date.now() });
        }
        await handleGenerationResult(data, {
          apiKey, model, resultType: 'video', title: '动作模仿',
          onTaskUpdate: (taskData, status) => {
            upsertVideoTaskRecord({ taskId: taskData.taskId || activeVideoTaskId, status, videoUrl: taskData.videoUrl, usage: taskData.usage });
          },
        });
        setLoading(false);
      } catch (err) {
        if (activeVideoTaskId) {
          const existingRecord = videoTaskRecords.find(item => item.taskId === activeVideoTaskId);
          if (!['FAILED', 'CANCELED', 'UNKNOWN'].includes(existingRecord?.status)) {
            upsertVideoTaskRecord({ taskId: activeVideoTaskId, status: 'FAILED', error: err.message });
          }
        }
        setLoading(false);
        showAlert(`生成失败: ${err.message}`);
      }
      return;
    }

    // 文生视频/图生视频/参考生视频模式
    const r2vFileList = r2vFiles ? Array.from(r2vFiles.files) : [];
    if (!prompt) {
      showAlert('请输入视频描述');
      return;
    }
    if (mode === 'r2v' && r2vFileList.length === 0) {
      showAlert('参考生视频需要上传至少1个参考图片或视频');
      return;
    }
    if (mode === 'image2video' && !firstFrame && provider === 'dashscope') {
      showAlert('图生视频需要上传首帧图片');
      return;
    }

    if (!(await ensureForegroundRecoveredBeforeGenerate())) return;

    localStorage.setItem(getModelStorageKey('video', provider), model);
    alertContainer.innerHTML = '';
    setLoading(true, '正在生成视频，请耐心等待...');
    downloadBtn.classList.add('d-none');

    const isRecameraModel = model === 'jimeng-v3.0-recamera';
    const isXai = provider === 'xai';
    const videoParams = {
      duration: parseInt(videoDuration.value, 10),
      resolution: isXai
        ? (videoResolution.value === '1080P' ? '720p' : (videoResolution.value === '720P' ? '720p' : videoResolution.value.toLowerCase()))
        : videoResolution.value,
      ratio: mode === 'text2video' ? videoRatio.value : undefined,
      seed,
      negative_prompt: negativePrompt.value.trim() || undefined,
      prompt_extend: promptExtend.checked,
      watermark: watermarkToggle.checked,
      frames: provider === 'volcengine' ? (parseInt(videoDuration.value, 10) === 10 ? 241 : 121) : undefined,
      aspect_ratio: (provider === 'volcengine' || isXai) && mode === 'text2video' ? videoRatio.value : undefined,
      template_id: isRecameraModel && recameraTemplate ? recameraTemplate.value : undefined,
      camera_strength: isRecameraModel && recameraStrength ? recameraStrength.value : undefined,
    };
    const formData = new FormData();
    formData.append('apiKey', apiKey);
    formData.append('mode', mode);
    formData.append('model', model);
    formData.append('prompt', prompt);
    formData.append('progressMode', 'true');
    if (mode === 'r2v' && r2vFileList.length > 0) {
      r2vFileList.forEach((file) => formData.append('r2vFiles', file));
    } else if (isXai && mode === 'image2video' && r2vFileList.length > 0) {
      // Grok 参考生视频：复用 r2vFiles 多图上传
      r2vFileList.forEach((file) => formData.append('grokImages', file));
    } else {
      if (firstFrame) formData.append('firstFrame', firstFrame);
      if (lastFrame) formData.append('lastFrame', lastFrame);
    }
    formData.append('parameters', JSON.stringify(videoParams));

    const apiEndpoint = provider === 'volcengine' ? '/api/jimeng-video'
      : provider === 'agnes' ? '/api/agnes-video'
      : provider === 'xai' ? '/api/grok-video'
      : '/api/generate-video';
    let activeVideoTaskId = '';
    try {
      const res = await fetch(apiEndpoint, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
      }
      if (data.taskId) {
        activeVideoTaskId = data.taskId;
        upsertVideoTaskRecord({
          taskId: data.taskId,
          provider,
          model,
          mode,
          duration: videoParams.duration,
          resolution: videoParams.resolution,
          ratio: videoParams.ratio,
          status: data.taskStatus || 'PENDING',
          createdAt: Date.now(),
        });
      }
      await handleGenerationResult(data, {
        apiKey,
        model,
        resultType: 'video',
        title: '视频生成',
        onTaskUpdate: (taskData, status) => {
          upsertVideoTaskRecord({
            taskId: taskData.taskId || activeVideoTaskId,
            status,
            videoUrl: taskData.videoUrl,
            usage: taskData.usage,
          });
        },
      });
      setLoading(false);
    } catch (err) {
      if (activeVideoTaskId) {
        const existingRecord = videoTaskRecords.find(item => item.taskId === activeVideoTaskId);
        if (!['FAILED', 'CANCELED', 'UNKNOWN'].includes(existingRecord?.status)) {
          upsertVideoTaskRecord({ taskId: activeVideoTaskId, status: 'FAILED', error: err.message });
        }
      }
      setLoading(false);
      showAlert(`生成失败: ${err.message}`);
    }
  });
}

// 快捷键 Ctrl+Enter 触发生成
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    generateBtn.click();
  }
});
if (videoPromptInput) {
  videoPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      generateBtnVideo.click();
    }
  });
}

// ========== 图生图相关功能 ==========

// 模式切换
const text2imageTab = document.getElementById('text2image-tab');
const image2imageTab = document.getElementById('image2image-tab');
const videoTab = document.getElementById('video-tab');

text2imageTab.addEventListener('click', () => {
  currentMode = 'text2image';
  generateBtn.classList.remove('d-none');
  generateBtnI2I.classList.add('d-none');
  image2imageParams.classList.add('d-none');
  updateSizeOptions();
  updateVolcengineUiState();
  updateVideoUiState();
});

image2imageTab.addEventListener('click', () => {
  currentMode = 'image2image';
  generateBtn.classList.add('d-none');
  generateBtnI2I.classList.remove('d-none');
  image2imageParams.classList.remove('d-none');
  updateSizeOptionsI2I();
  updateVolcengineUiState();
  updateVideoUiState();
});

if (videoTab) {
  videoTab.addEventListener('click', () => {
    currentMode = 'video';
    generateBtn.classList.add('d-none');
    generateBtnI2I.classList.add('d-none');
    image2imageParams.classList.add('d-none');
    updateVolcengineUiState();
    updateVideoUiState();
  });
}

// 参考图强度滑块
if (imageStrength) {
  imageStrength.addEventListener('input', () => {
    strengthValue.textContent = imageStrength.value;
  });
}
if (upscaleScale) {
  upscaleScale.addEventListener('input', () => {
    if (upscaleScaleValue) upscaleScaleValue.textContent = upscaleScale.value;
  });
}
if (seededitScale) {
  seededitScale.addEventListener('input', () => {
    if (seededitScaleValue) seededitScaleValue.textContent = seededitScale.value;
  });
}

// 图片上传功能
uploadArea.addEventListener('click', () => {
  imageUpload.click();
});

imageUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleImageFile(file);
  }
});

// 拖拽上传
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleImageFile(file);
  }
});

/**
 * 压缩图片文件
 * @param {File} file - 原始图片文件
 * @param {number} maxWidth - 最大宽度 (默认 1536)
 * @param {number} quality - JPEG 质量 (默认 0.8)
 * @returns {Promise<File>} - 压缩后的图片文件
 */
function compressImage(file, maxWidth = 1536, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxWidth && file.size < 2 * 1024 * 1024) {
        resolve(file);
        return;
      }

      let newWidth = img.width;
      let newHeight = img.height;
      if (img.width > maxWidth) {
        newWidth = maxWidth;
        newHeight = (img.height / img.width) * maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // PNG 保留透明通道，JPEG 压缩体积更小
      const isPng = file.type === 'image/png';
      const outputType = isPng ? 'image/png' : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('图片压缩失败'));
            return;
          }
          const ext = isPng ? '.png' : '.jpg';
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressedFile = new File([blob], `${baseName}${ext}`, {
            type: outputType,
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        outputType,
        quality
      );
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * 处理图片文件
 * @param {File} file - 图片文件
 */
async function handleImageFile(file) {
  // 检查文件大小 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    showAlert('图片文件大小不能超过10MB');
    return;
  }

  try {
    // 对于大于 1MB 的图片,先压缩再上传 (降低阈值，避免大图导致超时)
    if (file.size > 1 * 1024 * 1024) {
      console.log(`图片较大 (${(file.size / 1024 / 1024).toFixed(2)}MB),正在压缩...`);
      uploadedImageFile = await compressImage(file, 1536, 0.8);
      console.log(`压缩后大小: ${(uploadedImageFile.size / 1024 / 1024).toFixed(2)}MB`);
    } else {
      uploadedImageFile = file;
    }

    // 预览图片 (使用原始文件)
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      imagePreview.classList.remove('d-none');
      uploadArea.classList.add('d-none');
    };
    reader.readAsDataURL(file);
  } catch (err) {
    showAlert(`图片处理失败: ${err.message}`);
  }
}

async function handleMaskImageFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showAlert('Mask 图片文件大小不能超过10MB');
    return;
  }

  try {
    if (file.size > 1 * 1024 * 1024) {
      uploadedMaskFile = await compressImage(file, 1536, 0.8);
    } else {
      uploadedMaskFile = file;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      maskPreviewImage.src = e.target.result;
      maskImagePreview.classList.remove('d-none');
      maskUploadArea.classList.add('d-none');
    };
    reader.readAsDataURL(file);
  } catch (err) {
    showAlert(`Mask 图片处理失败: ${err.message}`);
  }
}

// 移除图片
if (removeImageBtn) {
  removeImageBtn.addEventListener('click', () => {
    uploadedImageFile = null;
    imageUpload.value = '';
    imagePreview.classList.add('d-none');
    uploadArea.classList.remove('d-none');
  });
}

if (maskUploadArea) {
  maskUploadArea.addEventListener('click', () => {
    maskImageUpload.click();
  });

  maskUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    maskUploadArea.classList.add('dragover');
  });

  maskUploadArea.addEventListener('dragleave', () => {
    maskUploadArea.classList.remove('dragover');
  });

  maskUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    maskUploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleMaskImageFile(file);
    }
  });
}

if (maskImageUpload) {
  maskImageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleMaskImageFile(file);
  });
}

// 模板图上传（人像融合/智能变美）- 复用 inpainting 模式
async function handleTemplateImageFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showAlert('模板图片文件大小不能超过10MB');
    return;
  }
  try {
    if (file.size > 1 * 1024 * 1024) {
      uploadedTemplateFile = await compressImage(file, 1536, 0.8);
    } else {
      uploadedTemplateFile = file;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      templatePreviewImage.src = e.target.result;
      templateImagePreview.classList.remove('d-none');
      templateUploadArea.classList.add('d-none');
    };
    reader.readAsDataURL(file);
  } catch (err) {
    showAlert(`模板图片处理失败: ${err.message}`);
  }
}

if (templateUploadArea) {
  templateUploadArea.addEventListener('click', () => {
    templateImageUpload.click();
  });
  templateUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    templateUploadArea.classList.add('dragover');
  });
  templateUploadArea.addEventListener('dragleave', () => {
    templateUploadArea.classList.remove('dragover');
  });
  templateUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    templateUploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleTemplateImageFile(file);
    }
  });
}

if (templateImageUpload) {
  templateImageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleTemplateImageFile(file);
  });
}

if (removeTemplateImageBtn) {
  removeTemplateImageBtn.addEventListener('click', () => {
    uploadedTemplateFile = null;
    if (templateImageUpload) templateImageUpload.value = '';
    if (templateImagePreview) templateImagePreview.classList.add('d-none');
    if (templateUploadArea) templateUploadArea.classList.remove('d-none');
  });
}

if (removeMaskImageBtn) {
  removeMaskImageBtn.addEventListener('click', () => {
    uploadedMaskFile = null;
    if (maskImageUpload) maskImageUpload.value = '';
    if (maskImagePreview) maskImagePreview.classList.add('d-none');
    if (maskUploadArea) maskUploadArea.classList.remove('d-none');
  });
}

// 图生图生成按钮点击
generateBtnI2I.addEventListener('click', async () => {
  const provider = providerSelectI2I.value;
  const apiKey = getStoredApiKey(provider);
  const model = applyModelSnapshot(modelSelectI2I.value, provider, modelSnapshotI2I);
  currentGenContext = { provider, model };
  const prompt = promptInputI2I.value.trim();
  const n = parseInt(imageCount.value, 10);
  const genericSize = imageSize.value === 'auto' ? undefined : imageSize.value;
  const volcengineSizeVal = volcengineSize && volcengineSize.value !== 'auto' ? parseInt(volcengineSize.value, 10) : undefined;
  const volcengineWidthVal = volcengineWidth && volcengineWidth.value ? parseInt(volcengineWidth.value, 10) : undefined;
  const volcengineHeightVal = volcengineHeight && volcengineHeight.value ? parseInt(volcengineHeight.value, 10) : undefined;
  const size = provider === 'volcengine' ? volcengineSizeVal : genericSize;
  const seed = seedInput.value ? parseInt(seedInput.value, 10) : undefined;
  const negativePromptVal = negativePrompt.value.trim() || undefined;
  const promptExtendVal = promptExtend.checked;
  const watermarkVal = provider === 'volcengine'
    ? (volcengineWatermarkToggle ? volcengineWatermarkToggle.checked : false)
    : watermarkToggle.checked;
  const imageStrengthVal = parseFloat(imageStrength.value);
  const upscaleResolutionVal = upscaleResolution ? upscaleResolution.value : '4k';
  const upscaleScaleVal = upscaleScale ? parseInt(upscaleScale.value, 10) : 50;
  const inpaintingSeedVal = inpaintingSeed && inpaintingSeed.value !== ''
    ? parseInt(inpaintingSeed.value, 10)
    : undefined;
  const materialProductSeedVal = materialProductSeed && materialProductSeed.value !== ''
    ? parseInt(materialProductSeed.value, 10)
    : undefined;
  const materialProductWidthVal = materialProductWidth && materialProductWidth.value !== ''
    ? parseInt(materialProductWidth.value, 10)
    : undefined;
  const materialProductHeightVal = materialProductHeight && materialProductHeight.value !== ''
    ? parseInt(materialProductHeight.value, 10)
    : undefined;
  const materialPodSeedVal = materialPodSeed && materialPodSeed.value !== ''
    ? parseInt(materialPodSeed.value, 10)
    : undefined;
  const materialPodWidthVal = materialPodWidth && materialPodWidth.value !== ''
    ? parseInt(materialPodWidth.value, 10)
    : undefined;
  const materialPodHeightVal = materialPodHeight && materialPodHeight.value !== ''
    ? parseInt(materialPodHeight.value, 10)
    : undefined;
  const materialPodLoraWeightVal = materialPodLoraWeight && materialPodLoraWeight.value !== ''
    ? parseFloat(materialPodLoraWeight.value)
    : undefined;
  const modelSpecificSeed = provider === 'volcengine' && model === 'jimeng-inpainting'
    ? inpaintingSeedVal
    : seed;
  const isMaterialProduct = provider === 'volcengine' && model === 'jimeng-material-product';
  const isMaterialPod = provider === 'volcengine' && model === 'jimeng-material-pod';
  const materialEditPromptVal = isMaterialProduct
    ? ((materialProductEditPrompt && materialProductEditPrompt.value.trim()) || prompt || undefined)
    : ((materialPodEditPrompt && materialPodEditPrompt.value.trim()) || prompt || undefined);
  const materialLoraWeightVal = isMaterialPod ? materialPodLoraWeightVal : undefined;
  const modelSpecificWidth = isMaterialProduct
    ? materialProductWidthVal
    : (isMaterialPod ? materialPodWidthVal : volcengineWidthVal);
  const modelSpecificHeight = isMaterialProduct
    ? materialProductHeightVal
    : (isMaterialPod ? materialPodHeightVal : volcengineHeightVal);
  const modelSpecificSeedFinal = isMaterialProduct
    ? materialProductSeedVal
    : (isMaterialPod ? materialPodSeedVal : modelSpecificSeed);
  const modelSpecificSize = (isMaterialProduct || isMaterialPod) ? undefined : size;

  if (provider !== 'volcengine' && !uploadedImageFile) {
    showAlert('请上传参考图片');
    return;
  }
  if (provider === 'volcengine' && model === 'jimeng-inpainting' && !uploadedMaskFile) {
    showAlert('jimeng-inpainting 需要上传第二张 Mask 图片。');
    return;
  }

  if (provider === 'volcengine' && !!loadCredential('volcengineAk') !== !!loadCredential('volcengineSk')) {
    showAlert('Volcengine AK/SK 需同时填写，或同时留空使用服务端环境变量（请在"设置"页修改）。');
    return;
  }

  if (provider === 'volcengine' && (Number.isNaN(imageStrengthVal) || imageStrengthVal < 0 || imageStrengthVal > 1)) {
    showAlert('参考图强度需在 0 到 1 之间。');
    return;
  }

  if (!(await ensureForegroundRecoveredBeforeGenerate())) return;

  localStorage.setItem(getModelStorageKey('image2image', provider), model);

  // 智能绘图(图生图 SeedEdit)
  if (provider === 'volcengine' && model === 'jimeng-seededit') {
    if (!prompt) { showAlert('请填写编辑指令（如：背景换成海边）'); return; }
    const seededitScaleVal = seededitScale ? parseFloat(seededitScale.value) : 0.5;
    alertContainer.innerHTML = '';
    setLoading(true, '正在提交智能绘图任务...');
    downloadBtn.classList.add('d-none');
    const fd = new FormData();
    fd.append('apiKey', apiKey);
    fd.append('prompt', prompt);
    fd.append('scale', String(seededitScaleVal));
    if (seedInput.value) fd.append('seed', seedInput.value);
    if (uploadedImageFile) fd.append('image', uploadedImageFile);
    else {
      const urls = (volcengineImageUrls?.value || '').split(/[\n,\s]+/).map(v => v.trim()).filter(v => /^https?:\/\//i.test(v));
      if (urls.length === 0) { showAlert('请上传参考图或填写图片 URL'); return; }
      fd.append('imageUrl', urls[0]);
    }
    let activeTaskId = '';
    try {
      const res = await fetch('/api/volcengine-seededit', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
      if (data.taskId) {
        activeTaskId = data.taskId;
        upsertImageTaskRecord({ id: data.taskId, taskId: data.taskId, mode: 'text2image', provider, model, status: 'PENDING', createdAt: Date.now() });
      }
      await handleGenerationResult({ ...data, queryAction: data.queryAction || 'CVSync2AsyncGetResult' }, {
        apiKey, model, resultType: 'image', title: '智能绘图',
        onTaskUpdate: (taskData, status) => { upsertImageTaskRecord({ id: activeTaskId, taskId: activeTaskId, status, imageUrls: taskData.imageUrls }); },
      });
      setLoading(false);
    } catch (err) { setLoading(false); showAlert(`生成失败: ${err.message}`); }
    return;
  }

  // 图像特效
  if (provider === 'volcengine' && model === 'jimeng-effect') {
    if (!effectTemplate || !effectTemplate.value) { showAlert('请选择特效模板'); return; }
    alertContainer.innerHTML = '';
    setLoading(true, '正在提交图像特效任务...');
    downloadBtn.classList.add('d-none');
    const fd = new FormData();
    fd.append('apiKey', apiKey);
    fd.append('templateId', effectTemplate.value);
    if (uploadedImageFile) fd.append('image', uploadedImageFile);
    else {
      const urls = (volcengineImageUrls?.value || '').split(/[\n,\s]+/).map(v => v.trim()).filter(v => /^https?:\/\//i.test(v));
      if (urls.length === 0) { showAlert('请上传参考图或填写图片 URL'); return; }
      fd.append('imageUrl', urls[0]);
    }
    if (volcengineWidth && volcengineWidth.value) fd.append('width', volcengineWidth.value);
    if (volcengineHeight && volcengineHeight.value) fd.append('height', volcengineHeight.value);
    let activeTaskId = '';
    try {
      const res = await fetch('/api/volcengine-effect', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
      if (data.taskId) {
        activeTaskId = data.taskId;
        upsertImageTaskRecord({ id: data.taskId, taskId: data.taskId, mode: 'text2image', provider, model, status: 'PENDING', createdAt: Date.now() });
      }
      await handleGenerationResult({ ...data, queryAction: data.queryAction || 'CVSync2AsyncGetResult' }, {
        apiKey, model, resultType: 'image', title: '图像特效',
        onTaskUpdate: (taskData, status) => { upsertImageTaskRecord({ id: activeTaskId, taskId: activeTaskId, status, imageUrls: taskData.imageUrls }); },
      });
      setLoading(false);
    } catch (err) { setLoading(false); showAlert(`生成失败: ${err.message}`); }
    return;
  }

  // 图片换装
  if (provider === 'volcengine' && model === 'jimeng-dressing') {
    if (!uploadedImageFile) { showAlert('请上传模特图'); return; }
    if (!uploadedTemplateFile) { showAlert('请上传服装图'); return; }
    const garmentType = dressingGarmentType ? dressingGarmentType.value : 'full';
    alertContainer.innerHTML = '';
    setLoading(true, '正在提交图片换装任务...');
    downloadBtn.classList.add('d-none');
    const fd = new FormData();
    fd.append('apiKey', apiKey);
    fd.append('images', uploadedImageFile);
    fd.append('images', uploadedTemplateFile);
    fd.append('garmentType', garmentType);
    let activeTaskId = '';
    try {
      const res = await fetch('/api/volcengine-dressing', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
      if (data.taskId) {
        activeTaskId = data.taskId;
        upsertImageTaskRecord({ id: data.taskId, taskId: data.taskId, mode: 'text2image', provider, model, status: 'PENDING', createdAt: Date.now() });
      }
      await handleGenerationResult({ ...data, queryAction: data.queryAction || 'CVGetResult' }, {
        apiKey, model, resultType: 'image', title: '图片换装',
        onTaskUpdate: (taskData, status) => { upsertImageTaskRecord({ id: activeTaskId, taskId: activeTaskId, status, imageUrls: taskData.imageUrls }); },
      });
      setLoading(false);
    } catch (err) { setLoading(false); showAlert(`生成失败: ${err.message}`); }
    return;
  }

  // 人像融合
  if (provider === 'volcengine' && (model === 'jimeng-faceswap' || model === 'jimeng-faceswap-ai')) {
    if (!uploadedImageFile) { showAlert('请上传素材图（含人脸）'); return; }
    if (!uploadedTemplateFile) { showAlert('请上传模板图'); return; }
    alertContainer.innerHTML = '';
    setLoading(true, '正在提交人像融合任务...');
    downloadBtn.classList.add('d-none');
    const fd = new FormData();
    fd.append('apiKey', apiKey);
    fd.append('model', model);
    fd.append('images', uploadedImageFile);
    fd.append('images', uploadedTemplateFile);
    try {
      const res = await fetch('/api/volcengine-faceswap', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
      if (data.imageUrls && data.imageUrls.length > 0) {
        displayImages(data.imageUrls);
        upsertImageTaskRecord({ id: Date.now().toString(), mode: 'image2image', provider: 'volcengine', model, status: 'SUCCEEDED', imageUrls: data.imageUrls });
      }
      setLoading(false);
    } catch (err) { setLoading(false); showAlert(`生成失败: ${err.message}`); }
    return;
  }

  // 智能变美
  if (provider === 'volcengine' && model === 'jimeng-facepretty') {
    alertContainer.innerHTML = '';
    setLoading(true, '正在提交智能变美任务...');
    downloadBtn.classList.add('d-none');
    const fd = new FormData();
    fd.append('apiKey', apiKey);
    if (uploadedImageFile) fd.append('image', uploadedImageFile);
    else {
      const urls = (volcengineImageUrls?.value || '').split(/[\n,\s]+/).map(v => v.trim()).filter(v => /^https?:\/\//i.test(v));
      if (urls.length > 0) fd.append('imageUrl', urls[0]);
    }
    fd.append('beautyLevel', '1.0');
    try {
      const res = await fetch('/api/volcengine-facepretty', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
      if (data.imageData) {
        displayImages([`data:image/png;base64,${data.imageData}`]);
      }
      setLoading(false);
    } catch (err) { setLoading(false); showAlert(`生成失败: ${err.message}`); }
    return;
  }

  // 图像修复与增强
  if (provider === 'volcengine' && (model === 'jimeng-lqir' || model === 'jimeng-nnsr2')) {
    alertContainer.innerHTML = '';
    setLoading(true, '正在提交图像修复任务...');
    downloadBtn.classList.add('d-none');
    const fd = new FormData();
    fd.append('apiKey', apiKey);
    fd.append('model', model);
    if (uploadedImageFile) fd.append('image', uploadedImageFile);
    else {
      const urls = (volcengineImageUrls?.value || '').split(/[\n,\s]+/).map(v => v.trim()).filter(v => /^https?:\/\//i.test(v));
      if (urls.length > 0) fd.append('imageUrl', urls[0]);
    }
    try {
      const res = await fetch('/api/volcengine-restoration', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
      if (data.imageUrls && data.imageUrls.length > 0) {
        displayImages(data.imageUrls);
        upsertImageTaskRecord({ id: Date.now().toString(), mode: 'image2image', provider: 'volcengine', model, status: 'SUCCEEDED', imageUrls: data.imageUrls });
      }
      setLoading(false);
    } catch (err) { setLoading(false); showAlert(`生成失败: ${err.message}`); }
    return;
  }

  alertContainer.innerHTML = '';
  setLoading(true, '正在上传图片，请稍候...');
  downloadBtn.classList.add('d-none');

  // 构建表单数据
  const formData = new FormData();
  formData.append('provider', provider);
  if (uploadedImageFile) {
    formData.append('image', uploadedImageFile);
  }
  if (provider === 'volcengine' && model === 'jimeng-inpainting' && uploadedMaskFile) {
    formData.append('imageMask', uploadedMaskFile);
  }
  formData.append('apiKey', apiKey);
  formData.append('model', model);
  formData.append('progressMode', (provider === 'volcengine' || provider === 'dashscope') ? 'true' : 'false');
  if (prompt) formData.append('prompt', prompt);
  if (provider === 'volcengine' && volcengineImageUrls) {
    const urls = volcengineImageUrls.value
      .split(/[\n,\s]+/)
      .map(v => v.trim())
      .filter(v => /^https?:\/\//i.test(v));
    const volcParamErr = validateVolcengineSizeAndRatio({
      model,
      size: modelSpecificSize,
      width: modelSpecificWidth,
      height: modelSpecificHeight,
    });
    if (!isMaterialProduct && !isMaterialPod && volcParamErr) {
      showAlert(volcParamErr);
      return;
    }
    const shouldValidateUrls = urls.length > 0 || !uploadedImageFile;
    if (shouldValidateUrls) {
      const volcUrlErr = validateVolcengineImageUrls(urls, model);
      if (volcUrlErr) {
        showAlert(volcUrlErr);
        return;
      }
    }
    formData.append('imageUrls', JSON.stringify(urls));
  } else if (provider === 'volcengine') {
    const volcParamErr = validateVolcengineSizeAndRatio({
      model,
      size: modelSpecificSize,
      width: modelSpecificWidth,
      height: modelSpecificHeight,
    });
    if (!isMaterialProduct && !isMaterialPod && volcParamErr) {
      showAlert(volcParamErr);
      return;
    }
  }
  if ((isMaterialProduct || isMaterialPod) && !materialEditPromptVal) {
    showAlert('素材提取模型必须填写提取指令（image_edit_prompt）。');
    return;
  }
  if ((isMaterialProduct || isMaterialPod) && ((modelSpecificWidth !== undefined) !== (modelSpecificHeight !== undefined))) {
    showAlert('素材提取模型的 width 和 height 需要同时填写或同时留空。');
    return;
  }
  if (isMaterialPod && materialLoraWeightVal !== undefined && (Number.isNaN(materialLoraWeightVal) || materialLoraWeightVal < 0 || materialLoraWeightVal > 1)) {
    showAlert('POD 的 lora_weight 需在 0 到 1 之间。');
    return;
  }
  formData.append('parameters', JSON.stringify({
    n,
    size: modelSpecificSize,
    width: provider === 'volcengine' ? modelSpecificWidth : undefined,
    height: provider === 'volcengine' ? modelSpecificHeight : undefined,
    seed: modelSpecificSeedFinal,
    negative_prompt: negativePromptVal,
    prompt_extend: promptExtendVal,
    watermark: watermarkVal,
    image_strength: imageStrengthVal,
    upscale_resolution: provider === 'volcengine' && model === 'jimeng-upscale' ? upscaleResolutionVal : undefined,
    upscale_scale: provider === 'volcengine' && model === 'jimeng-upscale' ? upscaleScaleVal : undefined,
    inpainting_seed: provider === 'volcengine' && model === 'jimeng-inpainting' ? inpaintingSeedVal : undefined,
    image_edit_prompt: isMaterialProduct || isMaterialPod ? materialEditPromptVal : undefined,
    edit_prompt: isMaterialProduct ? materialEditPromptVal : undefined,
    lora_weight: isMaterialPod ? materialLoraWeightVal : undefined,
  }));

  try {
    // 使用 XMLHttpRequest 以便监听上传进度
    const xhr = new XMLHttpRequest();

    // 上传完成后进入生成阶段：持续显示“已等待”时长，避免一直停在 100%
    let uploadFinished = false;
    let uploadFinishedAt = 0;
    let generatingTimer = null;
    const stopGeneratingTimer = () => {
      if (generatingTimer) {
        clearInterval(generatingTimer);
        generatingTimer = null;
      }
    };

    // 上传进度
    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const percent = Math.round((e.loaded / e.total) * 100);
      if (uploadFinished) return;
      if (percent >= 100) {
        uploadFinished = true;
        uploadFinishedAt = Date.now();
        setLoading(true, '上传完成，AI 正在生成（已等待 0 秒）...');
        generatingTimer = setInterval(() => {
          setLoading(true, `上传完成，AI 正在生成（已等待 ${formatElapsed(Date.now() - uploadFinishedAt)}）...`);
        }, 1000);
      } else {
        setLoading(true, `正在上传图片 (${percent}%)...`);
      }
    });

    // 请求完成
    xhr.addEventListener('load', async () => {
      stopGeneratingTimer();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          await handleGenerationResult(data, {
            apiKey,
            model,
            resultType: 'image',
            title: '图生图',
            mode: 'image2image',
            onTaskUpdate: () => loadImageTaskRecords('image2image'),
          });
          await loadImageTaskRecords('image2image');
          setLoading(false);
        } catch (err) {
          setLoading(false);
          showAlert(`解析响应失败: ${err.message}`);
        }
      } else {
        setLoading(false);
        try {
          // 先检查响应是否为 JSON 格式
          const contentType = xhr.getResponseHeader('Content-Type');
          if (!contentType || !contentType.includes('application/json')) {
            // 服务器返回了非 JSON 响应（可能是 HTML 错误页面）
            throw new Error(`服务器错误 (HTTP ${xhr.status})`);
          }

          const data = JSON.parse(xhr.responseText);
          throw new Error(getFriendlyErrorMessage(data.error || data, '生成失败', true));
        } catch (err) {
          showAlert(`生成失败: ${err.message}`);
        }
      }
    });

    // 请求错误
    xhr.addEventListener('error', () => {
      stopGeneratingTimer();
      setLoading(false);
      showAlert('网络错误,请检查网络连接后重试');
    });

    // 请求超时
    xhr.addEventListener('timeout', () => {
      stopGeneratingTimer();
      setLoading(false);
      showAlert('请求超时,图片可能较大,请稍后重试');
    });

    xhr.open('POST', '/api/image-to-image');
    xhr.timeout = GENERATION_REQUEST_TIMEOUT_MS;
    xhr.send(formData);
  } catch (err) {
    if (typeof stopGeneratingTimer === 'function') stopGeneratingTimer();
    setLoading(false);
    showAlert(`生成失败: ${err.message}`);
  }
});

// 图生图快捷键
if (promptInputI2I) {
  promptInputI2I.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      generateBtnI2I.click();
    }
  });
}

function isGenerationActive() {
  return generateBtn.disabled || generateBtnI2I.disabled || (generateBtnVideo && generateBtnVideo.disabled);
}

async function recoverForegroundState({ force = false } = {}) {
  if (!force && !foregroundRecoveryNeeded) return true;
  if (!force && Date.now() - lastForegroundRecoveryAt < FOREGROUND_RECOVERY_MIN_INTERVAL_MS) return true;
  if (isGenerationActive()) return true;
  if (foregroundRecoveryPromise) return foregroundRecoveryPromise;

  foregroundRecoveryPromise = (async () => {
    try {
      const res = await fetch('/health', { cache: 'no-store', credentials: 'same-origin' });
      const redirectedToUnlock = res.redirected && new URL(res.url).pathname === '/unlock';
      if (redirectedToUnlock || res.status === 401) {
        window.location.href = '/unlock';
        return false;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      updateTextProviderState();
      updateImageProviderState();
      updateVolcengineUiState();
      updateI2ISpecialParamState();
      renderVideoModelOptions();
      updateVideoUiState();
      await Promise.allSettled([
        loadVideoModels(),
        loadVideoTaskRecords(),
        loadImageTaskRecords('text2image'),
        loadImageTaskRecords('image2image'),
      ]);
      foregroundRecoveryNeeded = false;
      lastForegroundRecoveryAt = Date.now();
      return true;
    } catch (err) {
      showAlert('服务连接异常，请刷新页面后重试', 'warning');
      return false;
    } finally {
      foregroundRecoveryPromise = null;
    }
  })();

  return foregroundRecoveryPromise;
}

function ensureForegroundRecoveredBeforeGenerate() {
  if (!foregroundRecoveryNeeded && !foregroundRecoveryPromise) return Promise.resolve(true);
  return recoverForegroundState({ force: true });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    foregroundRecoveryNeeded = true;
    return;
  }
  recoverForegroundState({ force: foregroundRecoveryNeeded });
  pollActiveTaskOnce();
});

window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  foregroundRecoveryNeeded = true;
  recoverForegroundState({ force: true });
  pollActiveTaskOnce();
});
