/**
 * AI 图片生成器 - 前端交互逻辑
 * 支持文生图和图生图两种模式
 *
 * @copyright 2026 wenyinos. All rights reserved.
 * @license MIT
 * @see https://github.com/wenyinos/ai-image-generator
 */

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
const alertContainer = document.getElementById('alertContainer');
const placeholder = document.getElementById('placeholder');
const loading = document.getElementById('loading');
const resultImages = document.getElementById('resultImages');
const downloadBtn = document.getElementById('downloadBtn');
const downloadLink = document.getElementById('downloadLink');
const imageCount = document.getElementById('imageCount');
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

// 当前模式
let currentMode = 'text2image'; // 'text2image' 或 'image2image'
let uploadedImageFile = null;
let uploadedMaskFile = null;
const GEMINI_MODEL_ID = 'gemini-2.5-flash-image';
const GEMINI_MODEL_LEGACY_ID = 'gemini-2.5-flash-preview-image';

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
      { value: 'jimeng-upscale', label: '即梦AI-智能超清' },
      { value: 'jimeng-inpainting', label: '即梦AI-交互编辑inpainting' },
      { value: 'jimeng-4.0', label: '即梦AI-图片生成4.0' },
      { value: 'jimeng-4.6', label: '即梦AI-图片生成4.6' },
    ] },
  ],
};

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
  'jimeng-upscale': [],
  'jimeng-inpainting': [],
  'jimeng-4.0': ['1K', '2K', '4K'],
  'jimeng-4.6': ['1K', '2K', '4K'],
};

function normalizeGeminiModel(model) {
  return model === GEMINI_MODEL_LEGACY_ID ? GEMINI_MODEL_ID : model;
}

function getApiKeyStorageKey(mode, provider) {
  return mode === 'image2image' ? `apiKeyI2I_${provider}` : `apiKey_${provider}`;
}

function getVolcengineAkStorageKey(mode) {
  return mode === 'image2image' ? 'volcengineAkI2I' : 'volcengineAk';
}

function getVolcengineSkStorageKey(mode) {
  return mode === 'image2image' ? 'volcengineSkI2I' : 'volcengineSk';
}

function getModelStorageKey(mode, provider) {
  return mode === 'image2image' ? `modelI2I_${provider}` : `model_${provider}`;
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

function setTextApiKeyMeta(provider) {
  if (provider === 'volcengine') {
    standardApiKeyGroup.classList.add('d-none');
    volcengineCredGroup.classList.remove('d-none');
    volcengineAkInput.value = localStorage.getItem(getVolcengineAkStorageKey('text2image')) || '';
    volcengineSkInput.value = localStorage.getItem(getVolcengineSkStorageKey('text2image')) || '';
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

  const savedKey = localStorage.getItem(getApiKeyStorageKey('text2image', provider));
  apiKeyInput.value = savedKey || '';
}

function setImageApiKeyMeta(provider) {
  if (provider === 'volcengine') {
    standardApiKeyGroupI2I.classList.add('d-none');
    volcengineCredGroupI2I.classList.remove('d-none');
    volcengineAkInputI2I.value = localStorage.getItem(getVolcengineAkStorageKey('image2image')) || '';
    volcengineSkInputI2I.value = localStorage.getItem(getVolcengineSkStorageKey('image2image')) || '';
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
    } else {
      modelHintI2I.textContent = '即梦图生图：支持本地上传参考图，也支持 image_urls（HTTP/HTTPS）输入。';
    }
  } else {
    modelHintI2I.textContent = '图生图模式：上传参考图并输入提示词即可生成。';
  }

  const savedKey = localStorage.getItem(getApiKeyStorageKey('image2image', provider));
  apiKeyInputI2I.value = savedKey || '';

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
  return currentMode === 'image2image' ? providerSelectI2I.value : providerSelect.value;
}

function updateVolcengineUiState() {
  const isVolcengine = getActiveProvider() === 'volcengine';
  const i2iModel = modelSelectI2I ? modelSelectI2I.value : '';
  const isSpecialVolcI2I = currentMode === 'image2image' && isVolcengine
    && (i2iModel === 'jimeng-upscale' || i2iModel === 'jimeng-inpainting');
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

  if (imageStrengthGroup) imageStrengthGroup.classList.toggle('d-none', isUpscale || isInpainting);
  if (upscaleParamsGroup) upscaleParamsGroup.classList.toggle('d-none', !isUpscale);
  if (inpaintingParamsGroup) inpaintingParamsGroup.classList.toggle('d-none', !isInpainting);
}

// 从 localStorage 恢复用户设置
providerSelect.value = localStorage.getItem('provider') || 'dashscope';
providerSelectI2I.value = localStorage.getItem('providerI2I') || 'dashscope';

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

// 切换事件
providerSelect.addEventListener('change', updateTextProviderState);
providerSelectI2I.addEventListener('change', () => {
  updateImageProviderState();
  updateI2ISpecialParamState();
});
providerSelect.addEventListener('change', updateVolcengineUiState);
providerSelectI2I.addEventListener('change', () => {
  updateVolcengineUiState();
  updateI2ISpecialParamState();
});

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

/**
 * 显示提示信息
 * @param {string} message - 提示内容
 * @param {string} type - 提示类型 (danger/success)
 */
function showAlert(message, type = 'danger') {
  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
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
  generateBtn.disabled = isLoading;
  generateBtnI2I.disabled = isLoading;
  placeholder.classList.toggle('d-none', isLoading);
  loading.classList.toggle('d-none', !isLoading);
  resultImages.classList.toggle('d-none', isLoading);

  // 更新加载提示文本
  const loadingText = loading.querySelector('p');
  if (loadingText) {
    loadingText.textContent = message;
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
  resultImages.innerHTML = '';
  const count = imageUrls.length;
  const gridClass = count <= 4 ? `grid-${count}` : 'grid-4';
  resultImages.className = `result-images-grid ${gridClass}`;

  imageUrls.forEach((url, index) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = `生成的图片 ${index + 1}`;
    img.loading = 'lazy';
    resultImages.appendChild(img);
  });

  resultImages.classList.remove('d-none');
  downloadBtn.classList.remove('d-none');
  downloadLink.href = imageUrls[0];
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

  if (provider === 'volcengine') {
    localStorage.setItem(getVolcengineAkStorageKey('text2image'), (volcengineAkInput.value || '').trim());
    localStorage.setItem(getVolcengineSkStorageKey('text2image'), (volcengineSkInput.value || '').trim());
  } else if (apiKey) {
    localStorage.setItem(getApiKeyStorageKey('text2image', provider), apiKey);
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
      const errorMsg = data.error?.message || data.error || '生成失败';
      throw new Error(typeof errorMsg === 'string' ? errorMsg : '未知错误');
    }

    displayImages(data.imageUrls);
    setLoading(false);
  } catch (err) {
    setLoading(false);
    showAlert(`生成失败: ${err.message}`);
  }
});

// 快捷键 Ctrl+Enter 触发生成
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    generateBtn.click();
  }
});

// ========== 图生图相关功能 ==========

// 模式切换
const text2imageTab = document.getElementById('text2image-tab');
const image2imageTab = document.getElementById('image2image-tab');

text2imageTab.addEventListener('click', () => {
  currentMode = 'text2image';
  generateBtn.classList.remove('d-none');
  generateBtnI2I.classList.add('d-none');
  image2imageParams.classList.add('d-none');
  updateSizeOptions();
  updateVolcengineUiState();
});

image2imageTab.addEventListener('click', () => {
  currentMode = 'image2image';
  generateBtn.classList.add('d-none');
  generateBtnI2I.classList.remove('d-none');
  image2imageParams.classList.remove('d-none');
  updateSizeOptionsI2I();
  updateVolcengineUiState();
});

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
    // 如果图片尺寸已经小于 maxWidth,直接返回
    const img = new Image();
    img.onload = () => {
      // 不需要压缩
      if (img.width <= maxWidth && file.size < 2 * 1024 * 1024) {
        resolve(file);
        return;
      }

      // 计算新尺寸
      let newWidth = img.width;
      let newHeight = img.height;
      if (img.width > maxWidth) {
        newWidth = maxWidth;
        newHeight = (img.height / img.width) * maxWidth;
      }

      // 使用 canvas 压缩
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // 转换为 blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('图片压缩失败'));
            return;
          }
          // 创建新的 File 对象
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
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
  const modelSpecificSeed = provider === 'volcengine' && model === 'jimeng-inpainting'
    ? inpaintingSeedVal
    : seed;

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

  if (provider === 'volcengine') {
    localStorage.setItem(getVolcengineAkStorageKey('image2image'), (volcengineAkInputI2I.value || '').trim());
    localStorage.setItem(getVolcengineSkStorageKey('image2image'), (volcengineSkInputI2I.value || '').trim());
  } else if (apiKey) {
    localStorage.setItem(getApiKeyStorageKey('image2image', provider), apiKey);
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
  if (prompt) formData.append('prompt', prompt);
  if (provider === 'volcengine' && volcengineImageUrls) {
    const urls = volcengineImageUrls.value
      .split(/[\n,\s]+/)
      .map(v => v.trim())
      .filter(v => /^https?:\/\//i.test(v));
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
      size,
      width: volcengineWidthVal,
      height: volcengineHeightVal,
    });
    if (volcParamErr) {
      showAlert(volcParamErr);
      return;
    }
  }
  formData.append('parameters', JSON.stringify({
    n,
    size,
    width: provider === 'volcengine' ? volcengineWidthVal : undefined,
    height: provider === 'volcengine' ? volcengineHeightVal : undefined,
    seed: modelSpecificSeed,
    negative_prompt: negativePromptVal,
    prompt_extend: promptExtendVal,
    watermark: watermarkVal,
    image_strength: imageStrengthVal,
    upscale_resolution: provider === 'volcengine' && model === 'jimeng-upscale' ? upscaleResolutionVal : undefined,
    upscale_scale: provider === 'volcengine' && model === 'jimeng-upscale' ? upscaleScaleVal : undefined,
    inpainting_seed: provider === 'volcengine' && model === 'jimeng-inpainting' ? inpaintingSeedVal : undefined,
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
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          displayImages(data.imageUrls);
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
          const errorMsg = data.error?.message || data.error || '生成失败';
          throw new Error(typeof errorMsg === 'string' ? errorMsg : '未知错误');
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
    xhr.timeout = 300000; // 5 分钟超时
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
