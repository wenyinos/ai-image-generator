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

// 中间件
app.use(cors());
app.use(express.json());
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
  const { prompt, apiKey, model, parameters = {} } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  const selectedModel = model || 'wan2.6-t2i';
  const config = getModelConfig(selectedModel);
  const authHeader = { 'Authorization': `Bearer ${apiKey}` };

  // 解析生成参数
  const size = parameters.size || config.size;
  const n = parameters.n || 1;
  const seed = parameters.seed;
  const negativePrompt = parameters.negative_prompt;
  const promptExtend = parameters.prompt_extend !== undefined ? parameters.prompt_extend : true;
  const watermark = parameters.watermark || false;

  try {
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

      const syncRes = await fetch(`${BASE_URL}${SYNC_ENDPOINT}`, {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          input: {
            messages: [{ role: 'user', content: [{ text: prompt }] }],
          },
          parameters: syncParams,
        }),
      });

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

    const submitRes = await fetch(`${BASE_URL}${ASYNC_ENDPOINT}`, {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: selectedModel,
        input: { prompt },
        parameters: asyncParams,
      }),
    });

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

      const pollRes = await fetch(`${BASE_URL}${TASK_ENDPOINT}${taskId}`, {
        headers: authHeader,
      });

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
  const { prompt, apiKey, model, parameters } = req.body;
  const imageFile = req.file;

  if (!imageFile) {
    return res.status(400).json({ error: '参考图片是必需的' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  const selectedModel = model || 'wan2.6-image';
  const authHeader = { 'Authorization': `Bearer ${apiKey}` };

  // 验证模型是否支持图生图
  const I2I_SUPPORTED_MODELS = [
    'wan2.7-image-pro',
    'wan2.7-image',
    'wan2.6-image',
  ];
  
  if (!I2I_SUPPORTED_MODELS.includes(selectedModel)) {
    return res.status(400).json({ 
      error: `模型 ${selectedModel} 不支持图生图，请使用: ${I2I_SUPPORTED_MODELS.join(', ')}` 
    });
  }

  console.log('📷 图生图请求 - 使用模型:', selectedModel);

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
  const n = params.n || 1;
  const seed = params.seed;
  const negativePrompt = params.negative_prompt;
  const promptExtend = params.prompt_extend !== undefined ? params.prompt_extend : true;
  const watermark = params.watermark || false;
  const imageStrength = params.image_strength !== undefined ? params.image_strength : 0.5; // 参考图强度

  try {
    // 图生图使用同步API (多模态生成端点)
    const syncParams = {
      n,
    };
    
    // 图生图最高支持2K分辨率
    if (size) syncParams.size = size;
    if (seed !== undefined) syncParams.seed = seed;
    if (negativePrompt) syncParams.negative_prompt = negativePrompt;
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
    console.log('=== 图生图请求调试 ===');
    console.log('模型:', selectedModel);
    console.log('图片大小:', imageFile.size, '字节');
    console.log('图片类型:', imageFile.mimetype);
    console.log('Base64长度:', imageDataUrl.length);
    console.log('请求参数:', JSON.stringify(syncParams, null, 2));
    console.log('=====================');

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
      180000 // 3 分钟超时,适合大图片
    );

    const syncData = await syncRes.json();

    if (!syncRes.ok) {
      console.error('❌ 图生图API错误:');
      console.error('HTTP状态码:', syncRes.status);
      console.error('错误响应:', JSON.stringify(syncData, null, 2));
      return res.status(syncRes.status).json({ error: syncData.message || syncData });
    }

    console.log('✅ 图生图API调用成功');

    const imageUrls = extractImageUrls(syncData, selectedModel);
    if (!imageUrls.length) {
      console.error('❌ API返回中未找到图片URL');
      console.log('API响应:', JSON.stringify(syncData, null, 2));
      return res.status(500).json({ error: 'No image URL in response' });
    }

    console.log('✅ 生成图片数量:', imageUrls.length);
    res.json({ imageUrls });
  } catch (err) {
    console.error('❌ 图生图异常:', err);
    
    // 如果响应已经发送，不要再处理
    if (res.headersSent) {
      console.warn('响应已发送，跳过错误处理');
      return;
    }
    
    // 区分超时错误和其他错误
    if (err.name === 'AbortError' || err.message?.includes('abort')) {
      return res.status(504).json({ error: '请求超时,图片较大或网络较慢,请稍后重试' });
    }
    res.status(500).json({ error: err.message });
  }
});
