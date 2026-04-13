/**
 * AI 图片生成器 - 前端交互逻辑
 * 支持文生图和图生图两种模式
 *
 * @copyright 2026 wenyinos. All rights reserved.
 * @license MIT
 * @see https://github.com/wenyinos/ai-image-generator
 */

// DOM 元素引用
const apiKeyInput = document.getElementById('apiKeyInput');
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
const seedInput = document.getElementById('seedInput');
const negativePrompt = document.getElementById('negativePrompt');
const promptExtend = document.getElementById('promptExtend');
const watermarkToggle = document.getElementById('watermarkToggle');
const imageStrength = document.getElementById('imageStrength');
const strengthValue = document.getElementById('strengthValue');
const image2imageParams = document.getElementById('image2imageParams');

// 图生图相关元素
const apiKeyInputI2I = document.getElementById('apiKeyInputI2I');
const toggleApiKeyBtnI2I = document.getElementById('toggleApiKeyBtnI2I');
const modelSelectI2I = document.getElementById('modelSelectI2I');
const promptInputI2I = document.getElementById('promptInputI2I');
const uploadArea = document.getElementById('uploadArea');
const imageUpload = document.getElementById('imageUpload');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');
const removeImageBtn = document.getElementById('removeImageBtn');

// 当前模式
let currentMode = 'text2image'; // 'text2image' 或 'image2image'
let uploadedImageFile = null;

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
};

/**
 * 根据当前选择的模型更新尺寸选项
 */
function updateSizeOptions() {
  const model = modelSelect.value;
  const sizes = MODEL_SIZES[model] || ['1024*1024'];
  imageSize.innerHTML = '<option value="auto">自动 (模型默认)</option>';
  sizes.forEach(size => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    imageSize.appendChild(option);
  });
}

// 从 localStorage 恢复用户设置
if (localStorage.getItem('apiKey')) {
  apiKeyInput.value = localStorage.getItem('apiKey');
}
if (localStorage.getItem('model')) {
  modelSelect.value = localStorage.getItem('model');
}
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

// 初始化尺寸选项
updateSizeOptions();

// 模型切换时更新尺寸选项并保存
modelSelect.addEventListener('change', () => {
  updateSizeOptions();
  localStorage.setItem('model', modelSelect.value);
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
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const prompt = promptInput.value.trim();
  const n = parseInt(imageCount.value);
  const size = imageSize.value === 'auto' ? undefined : imageSize.value;
  const seed = seedInput.value ? parseInt(seedInput.value) : undefined;
  const negativePromptVal = negativePrompt.value.trim() || undefined;
  const promptExtendVal = promptExtend.checked;
  const watermarkVal = watermarkToggle.checked;

  if (!apiKey) {
    showAlert('请输入 API Key');
    return;
  }
  if (!prompt) {
    showAlert('请输入图片描述');
    return;
  }

  localStorage.setItem('apiKey', apiKey);
  localStorage.setItem('model', model);
  if (size) localStorage.setItem('imageSize', imageSize.value);

  alertContainer.innerHTML = '';
  setLoading(true);
  downloadBtn.classList.add('d-none');

  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        model,
        prompt,
        parameters: {
          n,
          size,
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
});

image2imageTab.addEventListener('click', () => {
  currentMode = 'image2image';
  generateBtn.classList.add('d-none');
  generateBtnI2I.classList.remove('d-none');
  image2imageParams.classList.remove('d-none');
  updateSizeOptionsI2I();
});

// 图生图模型尺寸选项（仅支持多模态模型，不支持 t2i 文生图模型）
const MODEL_SIZES_I2I = {
  'wan2.7-image-pro': ['1K', '2K'],
  'wan2.7-image': ['1K', '2K'],
  'wan2.6-image': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
};

function updateSizeOptionsI2I() {
  const model = modelSelectI2I.value;
  const sizes = MODEL_SIZES_I2I[model] || ['1024*1024'];
  imageSize.innerHTML = '<option value="auto">自动 (模型默认)</option>';
  sizes.forEach(size => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    imageSize.appendChild(option);
  });
}

// 图生图 API Key 切换
if (toggleApiKeyBtnI2I) {
  toggleApiKeyBtnI2I.addEventListener('click', () => {
    const isPassword = apiKeyInputI2I.type === 'password';
    apiKeyInputI2I.type = isPassword ? 'text' : 'password';
    toggleApiKeyBtnI2I.innerHTML = `<i class="bi bi-eye${isPassword ? '-slash' : ''}"></i>`;
  });
}

// 参考图强度滑块
if (imageStrength) {
  imageStrength.addEventListener('input', () => {
    strengthValue.textContent = imageStrength.value;
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
 * @param {number} maxWidth - 最大宽度 (默认 2048)
 * @param {number} quality - JPEG 质量 (默认 0.85)
 * @returns {Promise<File>} - 压缩后的图片文件
 */
function compressImage(file, maxWidth = 2048, quality = 0.85) {
  return new Promise((resolve, reject) => {
    // 如果图片尺寸已经小于 maxWidth,直接返回
    const img = new Image();
    img.onload = () => {
      // 不需要压缩
      if (img.width <= maxWidth && file.size < 5 * 1024 * 1024) {
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
    // 对于大于 2MB 的图片,先压缩再上传
    if (file.size > 2 * 1024 * 1024) {
      console.log(`图片较大 (${(file.size / 1024 / 1024).toFixed(2)}MB),正在压缩...`);
      uploadedImageFile = await compressImage(file, 2048, 0.85);
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

// 移除图片
if (removeImageBtn) {
  removeImageBtn.addEventListener('click', () => {
    uploadedImageFile = null;
    imageUpload.value = '';
    imagePreview.classList.add('d-none');
    uploadArea.classList.remove('d-none');
  });
}

// 图生图生成按钮点击
generateBtnI2I.addEventListener('click', async () => {
  const apiKey = apiKeyInputI2I.value.trim() || apiKeyInput.value.trim();
  const model = modelSelectI2I.value;
  const prompt = promptInputI2I.value.trim();
  const n = parseInt(imageCount.value);
  const size = imageSize.value === 'auto' ? undefined : imageSize.value;
  const seed = seedInput.value ? parseInt(seedInput.value) : undefined;
  const negativePromptVal = negativePrompt.value.trim() || undefined;
  const promptExtendVal = promptExtend.checked;
  const watermarkVal = watermarkToggle.checked;
  const imageStrengthVal = parseFloat(imageStrength.value);

  if (!uploadedImageFile) {
    showAlert('请上传参考图片');
    return;
  }
  if (!apiKey) {
    showAlert('请输入 API Key');
    return;
  }

  localStorage.setItem('apiKey', apiKey);
  localStorage.setItem('apiKeyI2I', apiKey);

  alertContainer.innerHTML = '';
  setLoading(true, '正在上传图片，请稍候...');
  downloadBtn.classList.add('d-none');

  // 构建表单数据
  const formData = new FormData();
  formData.append('image', uploadedImageFile);
  formData.append('apiKey', apiKey);
  formData.append('model', model);
  if (prompt) formData.append('prompt', prompt);
  formData.append('parameters', JSON.stringify({
    n,
    size,
    seed,
    negative_prompt: negativePromptVal,
    prompt_extend: promptExtendVal,
    watermark: watermarkVal,
    image_strength: imageStrengthVal,
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

// 从 localStorage 恢复图生图 API Key
if (localStorage.getItem('apiKeyI2I')) {
  apiKeyInputI2I.value = localStorage.getItem('apiKeyI2I');
}
