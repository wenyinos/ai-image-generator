/**
 * AI 图片生成器 - 前端交互逻辑
 * 支持文生图和图生图两种模式
 *
 * @copyright 2026 wenyinos. All rights reserved.
 * @license MIT
 * @see https://github.com/wenyinos/ai-image-generator
 */

const GENERATION_REQUEST_TIMEOUT_MS = 450000; // 与后端默认补偿窗口保持一致
const GENERATION_PROGRESS_POLL_INTERVAL_MS = 5000;
const GENERATION_PROGRESS_MAX_POLL_ATTEMPTS = 90;
const VIDEO_PROGRESS_MAX_POLL_ATTEMPTS = 0; // 0 表示不因前端轮询次数触发超时
const FREE_TIER_QUOTA_ERROR_CODE = 'AllocationQuota.FreeTierOnly';
const FREE_TIER_QUOTA_ERROR_MESSAGE = '此模型额度已用尽，请更换其他模型';
const FOREGROUND_RECOVERY_MIN_INTERVAL_MS = 3000;

// DOM 元素引用
const providerSelect = document.getElementById('providerSelect');
const providerSelectI2I = document.getElementById('providerSelectI2I');
const apiKeyInput = document.getElementById('apiKeyInput');
const standardApiKeyGroup = document.getElementById('standardApiKeyGroup');
const volcengineCredGroup = document.getElementById('volcengineCredGroup');
const volcengineAkInput = document.getElementById('volcengineAkInput');
const volcengineSkInput = document.getElementById('volcengineSkInput');
const toggleVolcengineAkBtn = document.getElementById('toggleVolcengineAkBtn');
const toggleVolcengineSkBtn = document.getElementById('toggleVolcengineSkBtn');
const apiKeyLabelText = document.getElementById('apiKeyLabelText');
const apiKeyHelpLink = document.getElementById('apiKeyHelpLink');
const apiKeyConsoleLink = document.getElementById('apiKeyConsoleLink');
const apiEnvName = document.getElementById('apiEnvName');
const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
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
const apiKeyInputI2I = document.getElementById('apiKeyInputI2I');
const standardApiKeyGroupI2I = document.getElementById('standardApiKeyGroupI2I');
const volcengineCredGroupI2I = document.getElementById('volcengineCredGroupI2I');
const volcengineAkInputI2I = document.getElementById('volcengineAkInputI2I');
const volcengineSkInputI2I = document.getElementById('volcengineSkInputI2I');
const toggleVolcengineAkBtnI2I = document.getElementById('toggleVolcengineAkBtnI2I');
const toggleVolcengineSkBtnI2I = document.getElementById('toggleVolcengineSkBtnI2I');
const apiKeyLabelTextI2I = document.getElementById('apiKeyLabelTextI2I');
const apiEnvNameI2I = document.getElementById('apiEnvNameI2I');
const modelHintI2I = document.getElementById('modelHintI2I');
const toggleApiKeyBtnI2I = document.getElementById('toggleApiKeyBtnI2I');
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
const volcengineLocalUploadHint = document.getElementById('volcengineLocalUploadHint');
const volcengineImageUrlsGroup = document.getElementById('volcengineImageUrlsGroup');
const volcengineImageUrls = document.getElementById('volcengineImageUrls');
const videoMode = document.getElementById('videoMode');
const videoProvider = document.getElementById('videoProvider');
const videoApiKeyInput = document.getElementById('videoApiKeyInput');
const toggleVideoApiKeyBtn = document.getElementById('toggleVideoApiKeyBtn');
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
let videoTaskRecords = [];
let textImageTaskRecords = [];
let imageTaskRecords = [];
let foregroundRecoveryNeeded = false;
let foregroundRecoveryPromise = null;
let lastForegroundRecoveryAt = 0;
const GEMINI_MODEL_ID = 'gemini-2.5-flash-image';
const GEMINI_MODEL_LEGACY_ID = 'gemini-2.5-flash-preview-image';

// "记住我"复选框
const rememberApiKey = document.getElementById('rememberApiKey');
const rememberVolcengine = document.getElementById('rememberVolcengine');
const rememberApiKeyI2I = document.getElementById('rememberApiKeyI2I');
const rememberVolcengineI2I = document.getElementById('rememberVolcengineI2I');
const rememberApiKeyVideo = document.getElementById('rememberApiKeyVideo');
const rememberVolcengineVideo = document.getElementById('rememberVolcengineVideo');

const PROVIDER_CONFIG = {
  dashscope: {
    label: 'DashScope API Key（可选）',
    envName: 'DASHSCOPE_API_KEY',
    placeholder: 'sk-...',
    helpLink: 'https://help.aliyun.com/zh/model-studio/get-api-key',
    consoleLink: 'https://bailian.console.aliyun.com/cn-beijing?apiKey=1&tab=model#/api-key',
  },
  gemini: {
    label: 'Gemini API Key（可选）',
    envName: 'GEMINI_API_KEY',
    placeholder: 'AIza...',
    helpLink: 'https://ai.google.dev/gemini-api/docs/api-key',
    consoleLink: 'https://aistudio.google.com/apikey',
  },
  volcengine: {
    label: 'Volcengine AK:SK（可选）',
    envName: 'VOLCENGINE_ACCESS_KEY / VOLCENGINE_SECRET_KEY',
    placeholder: 'AK:SK',
    helpLink: 'https://www.volcengine.com/docs/82379/1666945',
    consoleLink: 'https://console.volcengine.com/ark',
  },
};

const MODELS_T2I = {
  dashscope: [
    { group: '⭐ 万相 2.7 (最新)', options: [
      { value: 'wan2.7-image-pro', label: 'wan2.7-image-pro (最强, 支持4K)' },
      { value: 'wan2.7-image', label: 'wan2.7-image (快速)' },
    ] },
    { group: '🎨 万相 2.6', options: [
      { value: 'wan2.6-image', label: 'wan2.6-image (图文混排)' },
      { value: 'wan2.6-t2i', label: 'wan2.6-t2i (标准)' },
    ] },
    { group: '⚡ 万相 2.5/2.2', options: [
      { value: 'wan2.5-t2i-preview', label: 'wan2.5-t2i-preview (预览)' },
      { value: 'wan2.2-t2i-flash', label: 'wan2.2-t2i-flash (极速)' },
      { value: 'wan2.2-t2i-plus', label: 'wan2.2-t2i-plus (增强)' },
    ] },
    { group: '万相 2.1/2.0', options: [
      { value: 'wanx2.1-t2i-turbo', label: 'wanx2.1-t2i-turbo' },
      { value: 'wanx2.1-t2i-plus', label: 'wanx2.1-t2i-plus' },
      { value: 'wanx2.0-t2i-turbo', label: 'wanx2.0-t2i-turbo' },
    ] },
    { group: '💬 千问 Qwen-Image', options: [
      { value: 'qwen-image-2.0-pro', label: 'qwen-image-2.0-pro (擅长文字)' },
      { value: 'qwen-image-2.0', label: 'qwen-image-2.0' },
      { value: 'qwen-image-max', label: 'qwen-image-max (真实感)' },
      { value: 'qwen-image-plus', label: 'qwen-image-plus (艺术风格)' },
      { value: 'qwen-image', label: 'qwen-image' },
    ] },
    { group: '🚀 Z-Image', options: [
      { value: 'z-image-turbo', label: 'z-image-turbo (轻量快速)' },
    ] },
  ],
  gemini: [
    { group: '✨ Gemini', options: [
      { value: GEMINI_MODEL_ID, label: 'Gemini 2.5 Flash Image' },
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
};

const MODELS_I2I = {
  dashscope: [
    { group: '⭐ 万相 2.7 (推荐)', options: [
      { value: 'wan2.7-image-pro', label: 'wan2.7-image-pro (最强)' },
      { value: 'wan2.7-image', label: 'wan2.7-image (快速)' },
    ] },
    { group: '🎨 万相 2.6', options: [
      { value: 'wan2.6-image', label: 'wan2.6-image (图文混排)' },
    ] },
  ],
  gemini: [
    { group: '✨ Gemini', options: [
      { value: GEMINI_MODEL_ID, label: 'Gemini 2.5 Flash Image' },
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
  ],
};

let VIDEO_MODELS = {
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

// 即梦视频模型列表（按模式区分）
const JIMENG_VIDEO_MODELS = {
  text2video: [
    { value: 'jimeng-v3.0-t2v-1080p', label: '即梦视频3.0-文生视频1080P' },
    { value: 'jimeng-v3.0-pro', label: '即梦视频3.0 Pro（文/图生视频）' },
  ],
  image2video: [
    { value: 'jimeng-v3.0-pro', label: '即梦视频3.0 Pro（文/图生视频）' },
    { value: 'jimeng-v3.0-i2v-first-1080p', label: '即梦视频3.0-图生视频首帧1080P' },
    { value: 'jimeng-v3.0-i2v-tail-1080p', label: '即梦视频3.0-图生视频首尾帧1080P' },
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
  return model === GEMINI_MODEL_LEGACY_ID ? GEMINI_MODEL_ID : model;
}

function getApiKeyStorageKey(mode, provider) {
  if (mode === 'video') return 'apiKey_video_dashscope';
  return mode === 'image2image' ? `apiKeyI2I_${provider}` : `apiKey_${provider}`;
}

function getVolcengineAkStorageKey(mode) {
  if (mode === 'image2image') return 'volcengineAkI2I';
  if (mode === 'video') return 'volcengineAkVideo';
  return 'volcengineAk';
}

function getVolcengineSkStorageKey(mode) {
  if (mode === 'image2image') return 'volcengineSkI2I';
  if (mode === 'video') return 'volcengineSkVideo';
  return 'volcengineSk';
}

function getModelStorageKey(mode, provider) {
  if (mode === 'video') return `model_video_${provider || 'dashscope'}`;
  return mode === 'image2image' ? `modelI2I_${provider}` : `model_${provider}`;
}

/**
 * 根据"记住我"状态获取存储对象
 * @param {boolean} remember - 是否勾选"记住我"
 * @returns {Storage} localStorage 或 sessionStorage
 */
function getStorage(remember) {
  return remember ? localStorage : sessionStorage;
}

/**
 * 保存凭证到存储
 * @param {string} key - 存储键
 * @param {string} value - 存储值
 * @param {boolean} remember - 是否持久保存
 */
function saveCredential(key, value, remember) {
  const storage = getStorage(remember);
  storage.setItem(key, value);
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
  const savedModel = localStorage.getItem(getModelStorageKey('video', provider));

  if (isMotion) {
    renderModelOptions(videoModelSelect, [{ group: '即梦动作模仿', options: JIMENG_MOTION_MODELS }], savedModel);
  } else if (provider === 'volcengine') {
    const jimengModels = JIMENG_VIDEO_MODELS[mode] || JIMENG_VIDEO_MODELS.text2video;
    renderModelOptions(videoModelSelect, [{ group: '即梦AI视频模型', options: jimengModels }], savedModel);
  } else {
    renderModelOptions(videoModelSelect, [{ group: '阿里云百炼视频模型', options: VIDEO_MODELS[mode] || [] }], savedModel);
  }
}

async function loadVideoModels() {
  const apiKey = videoApiKeyInput ? videoApiKeyInput.value.trim() : '';
  try {
    const res = await fetch('/api/video-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json();
    if (res.ok && data.models) {
      VIDEO_MODELS = data.models;
      renderVideoModelOptions();
    }
  } catch (err) {
    renderVideoModelOptions();
  }
}

function setTextApiKeyMeta(provider) {
  if (provider === 'volcengine') {
    standardApiKeyGroup.classList.add('d-none');
    volcengineCredGroup.classList.remove('d-none');
    // 读取凭证（优先从 localStorage）
    volcengineAkInput.value = loadCredential(getVolcengineAkStorageKey('text2image'));
    volcengineSkInput.value = loadCredential(getVolcengineSkStorageKey('text2image'));
    return;
  }

  standardApiKeyGroup.classList.remove('d-none');
  volcengineCredGroup.classList.add('d-none');

  const cfg = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.dashscope;
  apiKeyLabelText.textContent = cfg.label;
  apiEnvName.textContent = cfg.envName;
  apiKeyInput.placeholder = cfg.placeholder;
  apiKeyHelpLink.href = cfg.helpLink;
  apiKeyConsoleLink.href = cfg.consoleLink;

  // 读取 API Key（优先从 localStorage）
  apiKeyInput.value = loadCredential(getApiKeyStorageKey('text2image', provider));
}

function setImageApiKeyMeta(provider) {
  if (provider === 'volcengine') {
    standardApiKeyGroupI2I.classList.add('d-none');
    volcengineCredGroupI2I.classList.remove('d-none');
    // 读取凭证（优先从 localStorage）
    volcengineAkInputI2I.value = loadCredential(getVolcengineAkStorageKey('image2image'));
    volcengineSkInputI2I.value = loadCredential(getVolcengineSkStorageKey('image2image'));
    modelHintI2I.textContent = '即梦AI 4.0/4.6 支持参考图与多图生成';
  } else {
    standardApiKeyGroupI2I.classList.remove('d-none');
    volcengineCredGroupI2I.classList.add('d-none');
  }

  const cfg = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.dashscope;
  apiKeyLabelTextI2I.textContent = cfg.label;
  apiEnvNameI2I.textContent = cfg.envName;
  apiKeyInputI2I.placeholder = cfg.placeholder;

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
  } else {
    modelHintI2I.textContent = '图生图模式：上传参考图并输入提示词即可生成。';
  }

  // 读取 API Key（优先从 localStorage）
  apiKeyInputI2I.value = loadCredential(getApiKeyStorageKey('image2image', provider));

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
  setTextApiKeyMeta(provider);
  updateSizeOptions();
  localStorage.setItem('provider', provider);
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

  if (imageStrengthGroup) imageStrengthGroup.classList.toggle('d-none', isUpscale || isInpainting || isMaterialProduct || isMaterialPod);
  if (upscaleParamsGroup) upscaleParamsGroup.classList.toggle('d-none', !isUpscale);
  if (inpaintingParamsGroup) inpaintingParamsGroup.classList.toggle('d-none', !isInpainting);
  if (materialProductParamsGroup) materialProductParamsGroup.classList.toggle('d-none', !isMaterialProduct);
  if (materialPodParamsGroup) materialPodParamsGroup.classList.toggle('d-none', !isMaterialPod);
}

function updateVideoUiState() {
  const isVideo = currentMode === 'video';
  const isImageVideo = videoMode && videoMode.value === 'image2video';
  const isMotion = videoMode && videoMode.value === 'motion';
  if (imageParamsPanel) imageParamsPanel.classList.toggle('d-none', isVideo);
  if (videoFrameGroup) videoFrameGroup.classList.toggle('d-none', !isImageVideo);
  if (videoRatioGroup) videoRatioGroup.classList.toggle('d-none', isImageVideo || isMotion);
  if (motionUploadGroup) motionUploadGroup.classList.toggle('d-none', !isMotion);
  if (generateBtnVideo) generateBtnVideo.classList.toggle('d-none', !isVideo);
  if (textImageTaskRecordsPanel) textImageTaskRecordsPanel.classList.toggle('d-none', currentMode !== 'text2image');
  if (imageTaskRecordsPanel) imageTaskRecordsPanel.classList.toggle('d-none', currentMode !== 'image2image');
  // 动作模仿时隐藏视频描述和时长/分辨率选择
  const videoPromptGroup = document.getElementById('videoPromptInput')?.closest('.mb-3');
  if (videoPromptGroup) videoPromptGroup.classList.toggle('d-none', isMotion);
  const videoDurationGroup = document.getElementById('videoDuration')?.closest('.col-md-4');
  if (videoDurationGroup) videoDurationGroup.classList.toggle('d-none', isMotion);
  const videoResolutionGroup = document.getElementById('videoResolution')?.closest('.col-md-4');
  if (videoResolutionGroup) videoResolutionGroup.classList.toggle('d-none', isMotion);
  // 动作模仿时隐藏 DashScope 提供商选项（不支持）
  if (videoProvider) {
    const dashscopeOption = videoProvider.querySelector('option[value="dashscope"]');
    if (dashscopeOption) dashscopeOption.hidden = isMotion;
    if (isMotion && videoProvider.value === 'dashscope') {
      videoProvider.value = 'volcengine';
      updateVideoProviderState();
    }
  }
}

// 从 localStorage 恢复用户设置
providerSelect.value = localStorage.getItem('provider') || 'dashscope';
providerSelectI2I.value = localStorage.getItem('providerI2I') || 'dashscope';
if (videoApiKeyInput) videoApiKeyInput.value = loadCredential(getApiKeyStorageKey('video', 'dashscope'));
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
  });
}
if (refreshVideoModelsBtn) {
  refreshVideoModelsBtn.addEventListener('click', loadVideoModels);
}
if (videoModelSelect) {
  videoModelSelect.addEventListener('change', () => {
    const provider = videoProvider ? videoProvider.value : 'dashscope';
    localStorage.setItem(getModelStorageKey('video', provider), videoModelSelect.value);
  });
}

// 视频提供商切换
const videoApiKeyDashscopeGroup = document.getElementById('videoApiKeyDashscopeGroup');
const videoApiKeyVolcengineGroup = document.getElementById('videoApiKeyVolcengineGroup');
const videoVolcengineAk = document.getElementById('videoVolcengineAk');
const toggleVideoVolcengineAkBtn = document.getElementById('toggleVideoVolcengineAkBtn');
const videoVolcengineSk = document.getElementById('videoVolcengineSk');
const toggleVideoVolcengineSkBtn = document.getElementById('toggleVideoVolcengineSkBtn');
// 从 localStorage 恢复视频火山引擎凭证
if (videoVolcengineAk) videoVolcengineAk.value = loadCredential(getVolcengineAkStorageKey('video'));
if (videoVolcengineSk) videoVolcengineSk.value = loadCredential(getVolcengineSkStorageKey('video'));

function updateVideoProviderState() {
  const provider = videoProvider ? videoProvider.value : 'dashscope';
  const isVolcengine = provider === 'volcengine';
  const isMotion = videoMode && videoMode.value === 'motion';
  const isImageVideo = videoMode && videoMode.value === 'image2video';
  if (videoApiKeyDashscopeGroup) videoApiKeyDashscopeGroup.classList.toggle('d-none', isVolcengine);
  if (videoApiKeyVolcengineGroup) videoApiKeyVolcengineGroup.classList.toggle('d-none', !isVolcengine);
  if (refreshVideoModelsBtn) refreshVideoModelsBtn.classList.toggle('d-none', isVolcengine);
  // 切换到火山引擎时加载已保存的 AK/SK
  if (isVolcengine && videoVolcengineAk && videoVolcengineSk) {
    videoVolcengineAk.value = loadCredential(getVolcengineAkStorageKey('video'));
    videoVolcengineSk.value = loadCredential(getVolcengineSkStorageKey('video'));
  }

  // 渲染模型列表
  const savedModel = localStorage.getItem(getModelStorageKey('video', provider));
  if (isMotion) {
    // 动作模仿模式：强制使用即梦AI
    renderModelOptions(videoModelSelect, [{ group: '即梦动作模仿', options: JIMENG_MOTION_MODELS }], savedModel);
    if (videoProvider) videoProvider.value = 'volcengine';
    if (videoApiKeyDashscopeGroup) videoApiKeyDashscopeGroup.classList.add('d-none');
    if (videoApiKeyVolcengineGroup) videoApiKeyVolcengineGroup.classList.remove('d-none');
  } else if (isVolcengine) {
    const videoModeKey = isImageVideo ? 'image2video' : 'text2video';
    renderModelOptions(videoModelSelect, [{ group: '即梦AI视频模型', options: JIMENG_VIDEO_MODELS[videoModeKey] }], savedModel);
  } else {
    const mode = videoMode ? videoMode.value : 'text2video';
    renderModelOptions(videoModelSelect, [{ group: '阿里云百炼视频模型', options: VIDEO_MODELS[mode] || [] }], savedModel);
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
  });
}
if (toggleVideoVolcengineAkBtn && videoVolcengineAk) {
  bindPasswordToggle(toggleVideoVolcengineAkBtn, videoVolcengineAk);
}
if (toggleVideoVolcengineSkBtn && videoVolcengineSk) {
  bindPasswordToggle(toggleVideoVolcengineSkBtn, videoVolcengineSk);
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

modelSelect.addEventListener('change', () => {
  const provider = providerSelect.value;
  updateSizeOptions();
  localStorage.setItem(getModelStorageKey('text2image', provider), modelSelect.value);
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
toggleApiKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleApiKeyBtn.innerHTML = `<i class="bi bi-eye${isPassword ? '-slash' : ''}"></i>`;
});

if (toggleApiKeyBtnI2I) {
  toggleApiKeyBtnI2I.addEventListener('click', () => {
    const isPassword = apiKeyInputI2I.type === 'password';
    apiKeyInputI2I.type = isPassword ? 'text' : 'password';
    toggleApiKeyBtnI2I.innerHTML = `<i class="bi bi-eye${isPassword ? '-slash' : ''}"></i>`;
  });
}

function bindPasswordToggle(buttonEl, inputEl) {
  if (!buttonEl || !inputEl) return;
  buttonEl.addEventListener('click', () => {
    const isPassword = inputEl.type === 'password';
    inputEl.type = isPassword ? 'text' : 'password';
    buttonEl.innerHTML = `<i class="bi bi-eye${isPassword ? '-slash' : ''}"></i>`;
  });
}

bindPasswordToggle(toggleVolcengineAkBtn, volcengineAkInput);
bindPasswordToggle(toggleVolcengineSkBtn, volcengineSkInput);
bindPasswordToggle(toggleVolcengineAkBtnI2I, volcengineAkInputI2I);
bindPasswordToggle(toggleVolcengineSkBtnI2I, volcengineSkInputI2I);
bindPasswordToggle(toggleVideoApiKeyBtn, videoApiKeyInput);

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

async function pollGenerationTask({ endpoint, payload, resultType, title, maxAttempts = GENERATION_PROGRESS_MAX_POLL_ATTEMPTS, onTaskUpdate }) {
  const startedAt = Date.now();
  let attempt = 0;
  while (!maxAttempts || attempt < maxAttempts) {
    await sleep(GENERATION_PROGRESS_POLL_INTERVAL_MS);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getFriendlyErrorMessage(data.error || data, '查询任务失败', true));
    }

    const status = data.taskStatus || 'PENDING';
    setLoading(true, `${title}：${getTaskStatusText(status)}，已等待 ${formatElapsed(Date.now() - startedAt)}，任务ID ${data.taskId || payload.taskId}`);
    if (onTaskUpdate) onTaskUpdate(data, status);

    if (status === 'SUCCEEDED') {
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
}

async function handleGenerationResult(data, { apiKey, model, resultType, title, mode, onTaskUpdate }) {
  if (data.taskId) {
    const endpoint = data.provider === 'volcengine' ? '/api/volcengine-task-status' : '/api/dashscope-task-status';
    setLoading(true, `${title}：${getTaskStatusText(data.taskStatus)}，任务ID ${data.taskId}`);
    await pollGenerationTask({
      endpoint,
      payload: {
        apiKey,
        taskId: data.taskId,
        model: data.model || model,
        resultType,
        mode,
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
  const volcAk = (volcengineAkInput.value || '').trim();
  const volcSk = (volcengineSkInput.value || '').trim();
  const apiKey = provider === 'volcengine'
    ? (volcAk && volcSk ? `${volcAk}:${volcSk}` : '')
    : apiKeyInput.value.trim();
  const model = modelSelect.value;
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

  if (provider === 'volcengine' && ((volcAk && !volcSk) || (!volcAk && volcSk))) {
    showAlert('Volcengine 凭证需同时填写 AK 和 SK，或同时留空使用服务端环境变量。');
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

  // 根据"记住我"状态存储凭证
  if (provider === 'volcengine') {
    const rememberVolc = rememberVolcengine?.checked ?? true;
    saveCredential(getVolcengineAkStorageKey('text2image'), (volcengineAkInput.value || '').trim(), rememberVolc);
    saveCredential(getVolcengineSkStorageKey('text2image'), (volcengineSkInput.value || '').trim(), rememberVolc);
  } else if (apiKey) {
    const remember = rememberApiKey?.checked ?? true;
    saveCredential(getApiKeyStorageKey('text2image', provider), apiKey, remember);
  }
  localStorage.setItem(getModelStorageKey('text2image', provider), model);
  if (genericSize) localStorage.setItem('imageSize', imageSize.value);

  alertContainer.innerHTML = '';
  setLoading(true);
  downloadBtn.classList.add('d-none');

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
    setLoading(false);
  } catch (err) {
    setLoading(false);
    showAlert(`生成失败: ${err.message}`);
  }
});

if (generateBtnVideo) {
  generateBtnVideo.addEventListener('click', async () => {
    const provider = videoProvider ? videoProvider.value : 'dashscope';
    const mode = videoMode.value;
    let apiKey;
    if (provider === 'volcengine') {
      const ak = videoVolcengineAk ? videoVolcengineAk.value.trim() : '';
      const sk = videoVolcengineSk ? videoVolcengineSk.value.trim() : '';
      apiKey = ak && sk ? `${ak}:${sk}` : '';
    } else {
      apiKey = videoApiKeyInput.value.trim();
    }
    const model = videoModelSelect.value;
    const prompt = videoPromptInput.value.trim();
    const firstFrame = videoFirstFrame.files[0];
    const lastFrame = videoLastFrame.files[0];
    const motionImageFile = motionImage.files[0];
    const motionVideoFile = motionVideo.files[0];
    const seed = seedInput.value ? parseInt(seedInput.value, 10) : undefined;

    // 动作模仿模式
    if (mode === 'motion') {
      if (!motionImageFile) { showAlert('请上传人物图片'); return; }
      if (!motionVideoFile) { showAlert('请上传模板视频'); return; }
      if (!(await ensureForegroundRecoveredBeforeGenerate())) return;
      const rememberVolcMotion = rememberVolcengineVideo?.checked ?? true;
      if (videoVolcengineAk && videoVolcengineAk.value.trim()) saveCredential(getVolcengineAkStorageKey('video'), videoVolcengineAk.value.trim(), rememberVolcMotion);
      if (videoVolcengineSk && videoVolcengineSk.value.trim()) saveCredential(getVolcengineSkStorageKey('video'), videoVolcengineSk.value.trim(), rememberVolcMotion);
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

    // 文生视频/图生视频模式
    if (!prompt) {
      showAlert('请输入视频描述');
      return;
    }
    if (mode === 'image2video' && !firstFrame && provider === 'dashscope') {
      showAlert('图生视频需要上传首帧图片');
      return;
    }

    if (!(await ensureForegroundRecoveredBeforeGenerate())) return;

    // 保存凭证
    if (provider === 'volcengine') {
      const rememberVolc = rememberVolcengineVideo?.checked ?? true;
      if (videoVolcengineAk && videoVolcengineAk.value.trim()) saveCredential(getVolcengineAkStorageKey('video'), videoVolcengineAk.value.trim(), rememberVolc);
      if (videoVolcengineSk && videoVolcengineSk.value.trim()) saveCredential(getVolcengineSkStorageKey('video'), videoVolcengineSk.value.trim(), rememberVolc);
    } else {
      const remember = rememberApiKeyVideo?.checked ?? true;
      if (apiKey) saveCredential(getApiKeyStorageKey('video', 'dashscope'), apiKey, remember);
    }
    localStorage.setItem(getModelStorageKey('video', provider), model);
    alertContainer.innerHTML = '';
    setLoading(true, '正在生成视频，请耐心等待...');
    downloadBtn.classList.add('d-none');

    const videoParams = {
      duration: parseInt(videoDuration.value, 10),
      resolution: videoResolution.value,
      ratio: mode === 'text2video' ? videoRatio.value : undefined,
      seed,
      negative_prompt: negativePrompt.value.trim() || undefined,
      prompt_extend: promptExtend.checked,
      watermark: watermarkToggle.checked,
      frames: provider === 'volcengine' ? (parseInt(videoDuration.value, 10) === 10 ? 241 : 121) : undefined,
      aspect_ratio: provider === 'volcengine' && mode === 'text2video' ? videoRatio.value : undefined,
    };
    const formData = new FormData();
    formData.append('apiKey', apiKey);
    formData.append('mode', mode);
    formData.append('model', model);
    formData.append('prompt', prompt);
    formData.append('progressMode', 'true');
    if (firstFrame) formData.append('firstFrame', firstFrame);
    if (lastFrame) formData.append('lastFrame', lastFrame);
    formData.append('parameters', JSON.stringify(videoParams));

    const apiEndpoint = provider === 'volcengine' ? '/api/jimeng-video' : '/api/generate-video';
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
  const volcAkI2I = (volcengineAkInputI2I.value || '').trim();
  const volcSkI2I = (volcengineSkInputI2I.value || '').trim();
  const apiKey = provider === 'volcengine'
    ? (volcAkI2I && volcSkI2I ? `${volcAkI2I}:${volcSkI2I}` : '')
    : apiKeyInputI2I.value.trim();
  const model = modelSelectI2I.value;
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

  if (provider === 'volcengine' && ((volcAkI2I && !volcSkI2I) || (!volcAkI2I && volcSkI2I))) {
    showAlert('Volcengine 凭证需同时填写 AK 和 SK，或同时留空使用服务端环境变量。');
    return;
  }

  if (provider === 'volcengine' && (Number.isNaN(imageStrengthVal) || imageStrengthVal < 0 || imageStrengthVal > 1)) {
    showAlert('参考图强度需在 0 到 1 之间。');
    return;
  }

  if (!(await ensureForegroundRecoveredBeforeGenerate())) return;

  // 根据"记住我"状态存储凭证
  const rememberI2I = rememberApiKeyI2I?.checked ?? true;
  if (provider === 'volcengine') {
    const rememberVolc = rememberVolcengineI2I?.checked ?? true;
    saveCredential(getVolcengineAkStorageKey('image2image'), (volcengineAkInputI2I.value || '').trim(), rememberVolc);
    saveCredential(getVolcengineSkStorageKey('image2image'), (volcengineSkInputI2I.value || '').trim(), rememberVolc);
  } else if (apiKey) {
    saveCredential(getApiKeyStorageKey('image2image', provider), apiKey, rememberI2I);
  }
  localStorage.setItem(getModelStorageKey('image2image', provider), model);

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
  formData.append('progressMode', provider === 'volcengine' ? 'true' : 'false');
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

    // 上传进度
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setLoading(true, `正在上传图片 (${percent}%)...`);
      }
    });

    // 请求完成
    xhr.addEventListener('load', async () => {
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
      setLoading(false);
      showAlert('网络错误,请检查网络连接后重试');
    });

    // 请求超时
    xhr.addEventListener('timeout', () => {
      setLoading(false);
      showAlert('请求超时,图片可能较大,请稍后重试');
    });

    xhr.open('POST', '/api/image-to-image');
    xhr.timeout = GENERATION_REQUEST_TIMEOUT_MS;
    xhr.send(formData);
  } catch (err) {
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
});

window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  foregroundRecoveryNeeded = true;
  recoverForegroundState({ force: true });
});
