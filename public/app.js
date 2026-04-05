const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
const modelSelect = document.getElementById('modelSelect');
const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
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

const MODEL_SIZES = {
  'wan2.7-image-pro': ['1K', '2K', '4K'],
  'wan2.7-image': ['1K', '2K', '4K'],
  'wan2.6-t2i': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.5-t2i-preview': ['1024*1024', '1280*1280', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.2-t2i-flash': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wan2.2-t2i-plus': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wanx2.1-t2i-turbo': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wanx2.1-t2i-plus': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'wanx2.0-t2i-turbo': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
  'qwen-image-2.0-pro': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-2.0': ['1024*1024', '2048*2048', '1664*928', '928*1664', '1472*1104', '1104*1472'],
  'qwen-image-max': ['1664*928', '928*1664', '1472*1104', '1104*1472', '1024*1024'],
  'qwen-image-plus': ['1664*928', '928*1664', '1472*1104', '1104*1472', '1024*1024'],
  'qwen-image': ['1664*928', '928*1664', '1472*1104', '1104*1472', '1024*1024'],
  'z-image-turbo': ['1024*1024', '1024*768', '768*1024', '1280*720', '720*1280'],
};

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

updateSizeOptions();

modelSelect.addEventListener('change', () => {
  updateSizeOptions();
  localStorage.setItem('model', modelSelect.value);
});

imageCount.addEventListener('change', () => {
  localStorage.setItem('imageCount', imageCount.value);
});

promptExtend.addEventListener('change', () => {
  localStorage.setItem('promptExtend', promptExtend.checked);
});

watermarkToggle.addEventListener('change', () => {
  localStorage.setItem('watermark', watermarkToggle.checked);
});

toggleApiKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleApiKeyBtn.innerHTML = `<i class="bi bi-eye${isPassword ? '-slash' : ''}"></i>`;
});

function showAlert(message, type = 'danger') {
  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
}

function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  placeholder.classList.toggle('d-none', isLoading);
  loading.classList.toggle('d-none', !isLoading);
  resultImages.classList.toggle('d-none', isLoading);
}

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

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    generateBtn.click();
  }
});
