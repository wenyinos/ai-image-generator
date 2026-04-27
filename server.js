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

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 限制
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
const TASK_ENDPOINT = '/tasks/';

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

function normalizeProvider(provider) {
  return provider === 'gemini' ? 'gemini' : 'dashscope';
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
  const selectedModel = model || GEMINI_DEFAULT_MODEL;
  const requestCount = Number.isInteger(n) ? n : 1;
  const parsedImage = imageDataUrl ? parseDataUrl(imageDataUrl) : null;
  const geminiTimeoutMs = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || '180000', 10);

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
      throw new Error('Gemini response does not include image data');
    }
    imageUrls.push(generatedUrls[0]);
  }

  return imageUrls;
}

function validateIntegerInRange(name, value, min, max) {
  if (!Number.isInteger(value)) return `${name} must be an integer`;
  if (value < min || value > max) return `${name} must be between ${min} and ${max}`;
  return null;
}

function validateStringMaxLen(name, value, maxLen) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return `${name} must be a string`;
  if (value.length > maxLen) return `${name} is too long (max ${maxLen})`;
  return null;
}

function validateSize(model, size) {
  const allowed = ALLOWED_SIZES_BY_MODEL[model];
  if (!allowed) return null;
  if (!allowed.includes(size)) {
    return `Invalid size for model ${model}. Allowed: ${allowed.join(', ')}`;
  }
  return null;
}

function createRateLimiter({ windowMs, max, keyGenerator }) {
  const hits = new Map();
  const getKey = typeof keyGenerator === 'function' ? keyGenerator : (req) => req.ip;

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
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }

    return next();
  };
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

const apiRateLimitWindowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const apiRateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX || '30', 10);
if (Number.isFinite(apiRateLimitWindowMs) && Number.isFinite(apiRateLimitMax) && apiRateLimitWindowMs > 0 && apiRateLimitMax > 0) {
  app.use('/api/', createRateLimiter({ windowMs: apiRateLimitWindowMs, max: apiRateLimitMax }));
}

app.use(express.json({ limit: '50mb' })); // 增加 body 限制,因为 base64 图片 会很大
app.use(express.static(path.join(__dirname, 'public')));

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * 图片生成接口 (文生图)
 * POST /api/generate-image
 * 请求体: { prompt, apiKey, model, parameters: { n, size, seed, negative_prompt, prompt_extend, watermark } }
 * 响应: { imageUrls: string[] }
 */
app.post('/api/generate-image', async (req, res) => {
  const { prompt, apiKey, model, parameters = {}, provider } = req.body;
  const selectedProvider = normalizeProvider(provider);

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  const resolvedApiKey = getApiKey(selectedProvider, apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: 'API Key is required' });

  const selectedModel = model || (selectedProvider === 'gemini' ? GEMINI_DEFAULT_MODEL : 'wan2.6-t2i');
  const config = getModelConfig(selectedModel);
  const authHeader = { 'Authorization': `Bearer ${resolvedApiKey}` };

  // 解析生成参数
  const size = parameters.size || config.size;
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
    const seedErr = validateIntegerInRange('seed', seed, 0, 2147483647);
    if (seedErr) return res.status(400).json({ error: seedErr });
  }

  if (selectedProvider === 'dashscope') {
    const sizeErr = validateSize(selectedModel, size);
    if (sizeErr) return res.status(400).json({ error: sizeErr });
  }

  const dashscopeTimeoutMs = Number.parseInt(process.env.DASHSCOPE_TIMEOUT_MS || '120000', 10);

  try {
    if (selectedProvider === 'gemini') {
      const imageUrls = await generateWithGemini({
        apiKey: resolvedApiKey,
        model: selectedModel,
        prompt,
        n,
      });
      return res.json({ imageUrls });
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
        return res.status(syncRes.status).json({ error: syncData.message || syncData });
      }

      const imageUrls = extractImageUrls(syncData, selectedModel);
      if (!imageUrls.length) {
        return res.status(500).json({ error: 'No image URL in response' });
      }

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
      return res.status(submitRes.status).json({ error: submitData.message || submitData });
    }

    const taskId = submitData.output?.task_id;
    if (!taskId) {
      return res.status(500).json({ error: 'No task_id returned' });
    }

    // 轮询任务状态
    let imageUrls = null;
    let attempts = 0;
    const maxAttempts = 90;

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));

      const pollRes = await fetchWithTimeout(
        `${BASE_URL}${TASK_ENDPOINT}${taskId}`,
        { headers: authHeader },
        dashscopeTimeoutMs
      );

      const pollData = await pollRes.json();
      const status = pollData.output?.task_status;

      if (status === 'SUCCEEDED') {
        imageUrls = extractImageUrls(pollData, selectedModel);
        break;
      } else if (status === 'FAILED') {
        return res.status(500).json({ error: pollData.output?.message || 'Task failed' });
      }

      attempts++;
    }

    if (!imageUrls || !imageUrls.length) {
      return res.status(504).json({ error: 'Task timeout' });
    }

    res.json({ imageUrls });
  } catch (err) {
    if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
      return res.status(504).json({ error: 'Upstream request timeout' });
    }
    res.status(500).json({ error: err.message });
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

/**
 * 图生图接口
 * POST /api/image-to-image
 * 请求: multipart/form-data { image: File, prompt: string, apiKey: string, model: string, parameters: JSON }
 * 响应: { imageUrls: string[] }
 */
app.post('/api/image-to-image', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, async (req, res) => {
  const { prompt, apiKey, model, parameters, provider } = req.body;
  const selectedProvider = normalizeProvider(provider);
  const imageFile = req.file;

  if (!imageFile) {
    return res.status(400).json({ error: '参考图片是必需的' });
  }
  const resolvedApiKey = getApiKey(selectedProvider, apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: 'API Key is required' });

  const selectedModel = model || (selectedProvider === 'gemini' ? GEMINI_DEFAULT_MODEL : 'wan2.6-image');
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
  const imageBase64 = imageFile.buffer.toString('base64');
  const mimeType = imageFile.mimetype || 'image/png';
  const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

  // 解析生成参数
  let params;
  try {
    params = parameters ? JSON.parse(parameters) : {};
  } catch (e) {
    params = {};
  }

  const size = params.size;
  const n = params.n === undefined ? 1 : params.n;
  const seed = params.seed;
  const negativePrompt = params.negative_prompt;
  const promptExtend = params.prompt_extend !== undefined ? params.prompt_extend : true;
  const watermark = params.watermark || false;
  const hasImageStrength = params.image_strength !== undefined;
  const imageStrength = hasImageStrength ? params.image_strength : 0.5; // 参考图强度

  try {
    const negativeErr = validateStringMaxLen('negative_prompt', negativePrompt, 4000);
    if (negativeErr) return res.status(400).json({ error: negativeErr });
    const promptErr = validateStringMaxLen('prompt', prompt, 4000);
    if (promptErr) return res.status(400).json({ error: promptErr });

    const nErr = validateIntegerInRange('n', n, 1, 4);
    if (nErr) return res.status(400).json({ error: nErr });

    if (seed !== undefined) {
      const seedErr = validateIntegerInRange('seed', seed, 0, 2147483647);
      if (seedErr) return res.status(400).json({ error: seedErr });
    }

    if (selectedProvider === 'dashscope' && size) {
      const sizeErr = validateSize(selectedModel, size);
      if (sizeErr) return res.status(400).json({ error: sizeErr });
    }

    if (imageStrength !== undefined) {
      if (typeof imageStrength !== 'number' || Number.isNaN(imageStrength) || imageStrength < 0 || imageStrength > 1) {
        return res.status(400).json({ error: 'image_strength must be a number between 0 and 1' });
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
      return res.json({ imageUrls });
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

    // 调试日志
    if (DEBUG) {
      console.log('=== 图生图请求调试 ===');
      console.log('模型:', selectedModel);
      console.log('图片大小:', imageFile.size, '字节');
      console.log('图片类型:', imageFile.mimetype);
      console.log('Base64长度:', imageDataUrl.length);
      console.log('请求参数:', JSON.stringify(syncParams, null, 2));
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
      300000 // 5 分钟超时,适合大图片和慢网络
    );

    const syncData = await syncRes.json();

    if (!syncRes.ok) {
      console.error('❌ 图生图API错误:');
      console.error('HTTP状态码:', syncRes.status);
      if (DEBUG) console.error('错误响应:', JSON.stringify(syncData, null, 2));
      return res.status(syncRes.status).json({ error: syncData.message || syncData });
    }

    if (DEBUG) console.log('✅ 图生图API调用成功');

    const imageUrls = extractImageUrls(syncData, selectedModel);
    if (!imageUrls.length) {
      console.error('❌ API返回中未找到图片URL');
      if (DEBUG) console.log('API响应:', JSON.stringify(syncData, null, 2));
      return res.status(500).json({ error: 'No image URL in response' });
    }

    if (DEBUG) console.log('✅ 生成图片数量:', imageUrls.length);
    res.json({ imageUrls });
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
    res.status(500).json({ error: `生成失败: ${err.message}` });
  }
});
