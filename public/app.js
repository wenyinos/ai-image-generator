const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
const modelSelect = document.getElementById('modelSelect');
const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const alertContainer = document.getElementById('alertContainer');
const placeholder = document.getElementById('placeholder');
const loading = document.getElementById('loading');
const resultImage = document.getElementById('resultImage');
const downloadBtn = document.getElementById('downloadBtn');
const downloadLink = document.getElementById('downloadLink');

if (localStorage.getItem('apiKey')) {
  apiKeyInput.value = localStorage.getItem('apiKey');
}
if (localStorage.getItem('model')) {
  modelSelect.value = localStorage.getItem('model');
}

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
  resultImage.classList.toggle('d-none', isLoading);
}

generateBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const prompt = promptInput.value.trim();

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

  alertContainer.innerHTML = '';
  setLoading(true);
  downloadBtn.classList.add('d-none');

  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model, prompt }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.error?.message || data.error || '生成失败';
      throw new Error(typeof errorMsg === 'string' ? errorMsg : '未知错误');
    }

    resultImage.src = data.imageUrl;
    resultImage.onload = () => {
      setLoading(false);
      resultImage.classList.remove('d-none');
      downloadBtn.classList.remove('d-none');
      downloadLink.href = data.imageUrl;
    };
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
