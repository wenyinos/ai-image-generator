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
const crypto = require('crypto');
const fs = require('fs/promises');

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_RELATIVE_DIR = 'uploads';
const UPLOADS_DIR = path.join(PUBLIC_DIR, UPLOADS_RELATIVE_DIR);
const UPLOAD_FILE_CLEANUP_DELAY_MS = 5 * 60 * 1000;
const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
};

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
const GEMINI_MODEL_ALIASES = {
  'gemini-2.5-flash-preview-image': 'gemini-2.5-flash-image',
};
const VOLCENGINE_HOST = process.env.VOLCENGINE_HOST || 'visual.volcengineapi.com';
const VOLCENGINE_REGION = process.env.VOLCENGINE_REGION || 'cn-north-1';
const VOLCENGINE_SERVICE = process.env.VOLCENGINE_SERVICE || 'cv';
const VOLCENGINE_VERSION = '2022-08-31';
const VOLCENGINE_MODEL_ALIASES = {
  'jimeng-3.0': process.env.VOLCENGINE_JIMENG_30_REQ_KEY || 'jimeng_t2i_v30',
  'jimeng-3.1': process.env.VOLCENGINE_JIMENG_31_REQ_KEY || 'jimeng_t2i_v31',
  'jimeng-3.0-i2i': process.env.VOLCENGINE_JIMENG_I2I_30_REQ_KEY || 'jimeng_i2i_v30',
  'jimeng-4.0': process.env.VOLCENGINE_JIMENG_40_REQ_KEY || 'jimeng_t2i_v40',
  'jimeng-4.6': process.env.VOLCENGINE_JIMENG_46_REQ_KEY || 'jimeng_seedream46_cvtob',
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
  if (provider === 'gemini') return 'gemini';
  if (provider === 'volcengine') return 'volcengine';
  return 'dashscope';
}

function normalizeGeminiModel(model) {
  if (!model || typeof model !== 'string') return GEMINI_DEFAULT_MODEL;
  return GEMINI_MODEL_ALIASES[model] || model;
}

function normalizeVolcengineModel(model) {
  if (typeof model === 'string' && model.trim()) {
    const mapped = VOLCENGINE_MODEL_ALIASES[model.trim()];
    if (mapped) return mapped;
    return model.trim();
  }
  return VOLCENGINE_MODEL_ALIASES['jimeng-4.0'];
}

function parseVolcengineCredentials(providedValue) {
  const raw = typeof providedValue === 'string' ? providedValue.trim() : '';
  if (raw) {
    const splitByColon = raw.split(':');
    if ((splitByColon.length === 2 || splitByColon.length === 3) && splitByColon[0].trim() && splitByColon[1].trim()) {
      return {
        accessKey: splitByColon[0].trim(),
        secretKey: splitByColon[1].trim(),
        sessionToken: splitByColon[2] ? splitByColon[2].trim() : '',
      };
    }
    const splitByLine = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (splitByLine.length >= 2) {
      return {
        accessKey: splitByLine[0],
        secretKey: splitByLine[1],
        sessionToken: splitByLine[2] || '',
      };
    }
  }

  const accessKey = typeof process.env.VOLCENGINE_ACCESS_KEY === 'string' ? process.env.VOLCENGINE_ACCESS_KEY.trim() : '';
  const secretKey = typeof process.env.VOLCENGINE_SECRET_KEY === 'string' ? process.env.VOLCENGINE_SECRET_KEY.trim() : '';
  const sessionToken = typeof process.env.VOLCENGINE_SESSION_TOKEN === 'string' ? process.env.VOLCENGINE_SESSION_TOKEN.trim() : '';
  if (accessKey && secretKey) {
    return { accessKey, secretKey, sessionToken };
  }
  return null;
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
  const selectedModel = normalizeGeminiModel(model);
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

function extractVolcengineImageUrls(data) {
  const urls = [];
  const imageUrls = Array.isArray(data?.data?.image_urls) ? data.data.image_urls : [];
  imageUrls.forEach((url) => {
    if (typeof url === 'string' && url.trim()) urls.push(url.trim());
  });

  const base64Images = Array.isArray(data?.data?.binary_data_base64) ? data.data.binary_data_base64 : [];
  base64Images.forEach((b64) => {
    if (typeof b64 === 'string' && b64.trim()) urls.push(`data:image/png;base64,${b64.trim()}`);
  });

  if (!urls.length && typeof data?.url === 'string') urls.push(data.url);
  return urls;
}

function sha256Hex(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function hmacSha256(key, content, encoding) {
  const hmac = crypto.createHmac('sha256', key).update(content);
  return encoding ? hmac.digest(encoding) : hmac.digest();
}

function volcengineCanonicalQuery(params) {
  return Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
}

function volcengineSign({ accessKey, secretKey, sessionToken, bodyText, queryParams, method = 'POST', pathname = '/', host, service, region }) {
  const xDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const shortXDate = xDate.slice(0, 8);
  const bodyHash = sha256Hex(bodyText || '');

  // SDK 只签 x-content-sha256 和 x-date，不签 host 和 content-type
  const headers = {
    'x-content-sha256': bodyHash,
    'x-date': xDate,
  };
  if (sessionToken) {
    headers['x-security-token'] = sessionToken;
  }

  const signedHeaders = sessionToken
    ? 'x-content-sha256;x-date;x-security-token'
    : 'x-content-sha256;x-date';

  const canonicalHeadersStr = Object.keys(headers).sort()
    .map(k => `${k}:${headers[k]}`)
    .join('\n');

  const canonicalRequest = [
    method,
    pathname,
    volcengineCanonicalQuery(queryParams),
    canonicalHeadersStr + '\n',
    signedHeaders,
    bodyHash,
  ].join('\n');

  const hashedCanonical = sha256Hex(canonicalRequest);
  const credentialScope = `${shortXDate}/${region}/${service}/request`;
  const stringToSign = ['HMAC-SHA256', xDate, credentialScope, hashedCanonical].join('\n');

  // kDate 无 VOLC 前缀（与官方 SDK 一致）
  const kDate = hmacSha256(secretKey, shortXDate);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'request');
  const signature = hmacSha256(kSigning, stringToSign, 'hex');

  const authHeader = `HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestHeaders = {
    'Host': host,
    'Content-Type': 'application/json',
    'X-Content-Sha256': bodyHash,
    'X-Date': xDate,
    'Authorization': authHeader,
  };
  if (sessionToken) {
    requestHeaders['X-Security-Token'] = sessionToken;
  }

  return { headers: requestHeaders };
}

async function generateWithVolcengine({
  credentials,
  model,
  prompt,
  n,
  size,
  width,
  height,
  watermark,
  imageUrls,
  scale,
  usePreLlm,
  seed,
}) {
  if (!credentials?.accessKey || !credentials?.secretKey) {
    throw new Error('Volcengine credentials are required. Use AK:SK or VOLCENGINE_ACCESS_KEY/VOLCENGINE_SECRET_KEY');
  }

  const reqKey = normalizeVolcengineModel(model);
  const isJimengT2IV3 = reqKey === 'jimeng_t2i_v30' || reqKey === 'jimeng_t2i_v31';
  const isJimengI2IV30 = reqKey === 'jimeng_i2i_v30';
  const promptText = (prompt && prompt.trim()) ? prompt.trim() : 'Generate an image';
  const maxAttempts = Number.parseInt(process.env.VOLCENGINE_MAX_POLL_ATTEMPTS || '90', 10);
  const pollIntervalMs = Number.parseInt(process.env.VOLCENGINE_POLL_INTERVAL_MS || '2000', 10);
  const volcengineTimeoutMs = Number.parseInt(process.env.VOLCENGINE_TIMEOUT_MS || '120000', 10);

  const submitBody = {
    req_key: reqKey,
    prompt: promptText,
  };
  if (isJimengI2IV30) {
    if (!Array.isArray(imageUrls) || imageUrls.length !== 1) {
      throw new Error('jimeng_i2i_v30 requires exactly 1 image URL');
    }
    submitBody.image_urls = [imageUrls[0]];
  } else if (Array.isArray(imageUrls) && imageUrls.length) {
    submitBody.image_urls = imageUrls;
  }

  if (Number.isInteger(seed)) {
    submitBody.seed = seed;
  }
  if (isJimengT2IV3 && typeof usePreLlm === 'boolean') {
    submitBody.use_pre_llm = usePreLlm;
  }

  if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0) {
    submitBody.width = width;
    submitBody.height = height;
  } else if (!isJimengT2IV3 && typeof size === 'number' && Number.isFinite(size)) {
    submitBody.size = size;
  }
  if (typeof scale === 'number' && Number.isFinite(scale)) submitBody.scale = scale;
  if (watermark === true) {
    submitBody.logo_info = JSON.stringify({ add_logo: true, position: 0, language: 0, opacity: 1 });
  }

  const baseUrl = `https://${VOLCENGINE_HOST}`;
  const submitQuery = { Action: 'CVSync2AsyncSubmitTask', Version: VOLCENGINE_VERSION };
  const submitBodyText = JSON.stringify(submitBody);

  const submitAuth = volcengineSign({
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
    sessionToken: credentials.sessionToken || '',
    bodyText: submitBodyText,
    queryParams: submitQuery,
    host: VOLCENGINE_HOST,
    service: VOLCENGINE_SERVICE,
    region: VOLCENGINE_REGION,
  });

  const submitQueryString = volcengineCanonicalQuery(submitQuery);
  const submitRes = await fetchWithTimeout(
    `${baseUrl}/?${submitQueryString}`,
    { method: 'POST', headers: submitAuth.headers, body: submitBodyText },
    volcengineTimeoutMs
  );
  const submitText = await submitRes.text().catch(() => '');
  let submitData;
  try {
    submitData = submitText ? JSON.parse(submitText) : {};
  } catch (e) {
    submitData = {};
  }

  if (submitData?.code !== 10000) {
    if (submitRes.status === 401 || submitData?.ResponseMetadata?.Error?.Code === 'SignatureDoesNotMatch') {
      const err = submitData?.ResponseMetadata?.Error || {};
      const requestId = submitData?.request_id || submitData?.ResponseMetadata?.RequestId || '';
      throw new Error(
        `Volcengine 鉴权失败(401): ${err.Message || 'Sign error'}` +
        `${requestId ? `, request_id=${requestId}` : ''}` +
        '。请确认使用的是火山引擎 AccessKey/SecretKey（不是 Ark API Key）；若为临时凭证还需携带 SessionToken。并检查账号权限、VOLCENGINE_REGION/VOLCENGINE_SERVICE 及服务器时间。'
      );
    }
    throw new Error(submitData?.message || submitData?.ResponseMetadata?.Error?.Message || `Volcengine submit failed (${submitRes.status})`);
  }
  const taskId = submitData?.data?.task_id;
  if (!taskId) throw new Error('Volcengine submit success but task_id is missing');

  const getResultQuery = { Action: 'CVSync2AsyncGetResult', Version: VOLCENGINE_VERSION };
  const getResultBody = {
    req_key: reqKey,
    task_id: taskId,
    req_json: JSON.stringify({ return_url: true }),
  };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

    const getResultBodyText = JSON.stringify(getResultBody);
    const getResultAuth = volcengineSign({
      accessKey: credentials.accessKey,
      secretKey: credentials.secretKey,
      sessionToken: credentials.sessionToken || '',
      bodyText: getResultBodyText,
      queryParams: getResultQuery,
      host: VOLCENGINE_HOST,
      service: VOLCENGINE_SERVICE,
      region: VOLCENGINE_REGION,
    });
    const getResultQueryString = volcengineCanonicalQuery(getResultQuery);

    const resultRes = await fetchWithTimeout(
      `${baseUrl}/?${getResultQueryString}`,
      { method: 'POST', headers: getResultAuth.headers, body: getResultBodyText },
      volcengineTimeoutMs
    );
    const resultData = await resultRes.json();

    if (!resultRes.ok || resultData?.code !== 10000) {
      throw new Error(resultData?.message || resultData?.ResponseMetadata?.Error?.Message || `Volcengine get result failed (${resultRes.status})`);
    }

    const status = resultData?.data?.status;
    if (status === 'done') {
      const urls = extractVolcengineImageUrls(resultData);
      if (!urls.length) throw new Error('Volcengine task done but no image_urls returned');
      return urls;
    }

    if (status === 'failed') {
      throw new Error(resultData?.data?.msg || resultData?.message || 'Volcengine task failed');
    }
  }

  throw new Error('Volcengine task polling timed out');
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

function parseSizeToArea(size) {
  if (size === undefined || size === null) return undefined;
  if (typeof size === 'number' && Number.isInteger(size) && size > 0) return size;
  if (typeof size !== 'string') return undefined;
  const normalized = size.trim().toUpperCase();
  const preset = {
    '1K': 1024 * 1024,
    '2K': 2048 * 2048,
    '4K': 4096 * 4096,
  };
  if (preset[normalized]) return preset[normalized];
  const matched = normalized.match(/^(\d+)\*(\d+)$/);
  if (!matched) return undefined;
  const width = Number.parseInt(matched[1], 10);
  const height = Number.parseInt(matched[2], 10);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  return width * height;
}

function parseImageUrlsInput(rawValue) {
  const isAllowedImageRef = (value) => /^https?:\/\//i.test(value);

  if (Array.isArray(rawValue)) {
    return rawValue
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(v => isAllowedImageRef(v));
  }
  if (typeof rawValue !== 'string') return [];
  return rawValue
    .split(/[\n,\s]+/)
    .map(v => v.trim())
    .filter(v => isAllowedImageRef(v));
}

function buildBaseUrl(req) {
  const configuredBaseUrl = typeof process.env.PUBLIC_BASE_URL === 'string'
    ? process.env.PUBLIC_BASE_URL.trim()
    : '';
  if (configuredBaseUrl) {
    const normalizedBaseUrl = configuredBaseUrl.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(normalizedBaseUrl)) {
      throw new Error('PUBLIC_BASE_URL must start with http:// or https://');
    }
    return normalizedBaseUrl;
  }

  const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto'].split(',')[0].trim()
    : '';
  const protocol = forwardedProto || req.protocol || 'http';

  const forwardedHostHeader = typeof req.headers['x-forwarded-host'] === 'string'
    ? req.headers['x-forwarded-host'].split(',')[0].trim()
    : '';
  const forwardedHeader = typeof req.headers.forwarded === 'string'
    ? req.headers.forwarded
    : '';
  const forwardedHostMatch = forwardedHeader.match(/host=([^;,\s]+)/i);
  const forwardedHost = forwardedHostMatch ? forwardedHostMatch[1].replace(/^"|"$/g, '') : '';
  const host = forwardedHostHeader || forwardedHost || req.get('host');
  if (!host) {
    throw new Error('Cannot determine request host for public image URL');
  }
  const hostName = host.split(':')[0].toLowerCase();
  const isPrivateHost = (
    hostName === 'localhost' ||
    hostName === '127.0.0.1' ||
    hostName === '::1' ||
    hostName.endsWith('.local') ||
    /^10\./.test(hostName) ||
    /^192\.168\./.test(hostName) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostName)
  );
  if (isPrivateHost) {
    throw new Error('当前服务地址是本地/内网地址，火山引擎无法访问。请配置 PUBLIC_BASE_URL 为公网可访问地址。');
  }
  return `${protocol}://${host}`;
}

async function saveUploadedImageAsPublicUrl(req, imageFile) {
  if (!imageFile?.buffer || !Buffer.isBuffer(imageFile.buffer)) {
    return { publicUrl: '', filePath: '' };
  }
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const fileExt = MIME_EXTENSION_MAP[imageFile.mimetype] || '.png';
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${fileExt}`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  await fs.writeFile(filePath, imageFile.buffer);
  return {
    publicUrl: `${buildBaseUrl(req)}/${UPLOADS_RELATIVE_DIR}/${fileName}`,
    filePath,
  };
}

function scheduleUploadedFileCleanup(filePath, delayMs = UPLOAD_FILE_CLEANUP_DELAY_MS) {
  if (!filePath || typeof filePath !== 'string') return;
  const resolvedPath = path.resolve(filePath);
  const uploadsRoot = path.resolve(UPLOADS_DIR) + path.sep;
  if (!resolvedPath.startsWith(uploadsRoot)) return;

  const timer = setTimeout(async () => {
    try {
      await fs.unlink(resolvedPath);
      if (DEBUG) console.log(`🧹 已清理上传文件: ${resolvedPath}`);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.error(`清理上传文件失败: ${resolvedPath}`, error);
      }
    }
  }, delayMs);
  if (typeof timer.unref === 'function') timer.unref();
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
app.use(express.static(PUBLIC_DIR));

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
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
  const volcengineCredentials = selectedProvider === 'volcengine'
    ? parseVolcengineCredentials(apiKey)
    : null;
  if (selectedProvider === 'volcengine' && apiKey && !volcengineCredentials) {
    return res.status(400).json({ error: 'Volcengine credentials format invalid. Please use AK:SK' });
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  const resolvedApiKey = selectedProvider === 'volcengine'
    ? (volcengineCredentials ? `${volcengineCredentials.accessKey}:***` : '')
    : getApiKey(selectedProvider, apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: 'API Key is required' });

  const selectedModel = selectedProvider === 'gemini'
    ? normalizeGeminiModel(model)
    : (selectedProvider === 'volcengine'
      ? normalizeVolcengineModel(model)
      : (model || 'wan2.6-t2i'));
  const config = getModelConfig(selectedModel);
  const authHeader = { 'Authorization': `Bearer ${resolvedApiKey}` };

  // 解析生成参数
  const size = parameters.size || config.size;
  const width = Number.isInteger(parameters.width) ? parameters.width : undefined;
  const height = Number.isInteger(parameters.height) ? parameters.height : undefined;
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
    const seedMin = selectedProvider === 'volcengine' ? -1 : 0;
    const seedErr = validateIntegerInRange('seed', seed, seedMin, 2147483647);
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

    if (selectedProvider === 'volcengine') {
      const imageUrls = await generateWithVolcengine({
        credentials: volcengineCredentials,
        model: selectedModel,
        prompt,
        n,
        size: parseSizeToArea(size),
        width,
        height,
        watermark,
        usePreLlm: promptExtend,
        seed,
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
  const { prompt, apiKey, model, parameters, provider, imageUrls } = req.body;
  const selectedProvider = normalizeProvider(provider);
  const volcengineCredentials = selectedProvider === 'volcengine'
    ? parseVolcengineCredentials(apiKey)
    : null;
  if (selectedProvider === 'volcengine' && apiKey && !volcengineCredentials) {
    return res.status(400).json({ error: 'Volcengine credentials format invalid. Please use AK:SK' });
  }
  const imageFile = req.file;

  if (selectedProvider !== 'volcengine' && !imageFile) {
    return res.status(400).json({ error: '参考图片是必需的' });
  }
  const resolvedApiKey = selectedProvider === 'volcengine'
    ? (volcengineCredentials ? `${volcengineCredentials.accessKey}:***` : '')
    : getApiKey(selectedProvider, apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: 'API Key is required' });

  const selectedModel = selectedProvider === 'gemini'
    ? normalizeGeminiModel(model)
    : (selectedProvider === 'volcengine'
      ? normalizeVolcengineModel(model)
      : (model || 'wan2.6-image'));
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
  const imageBase64 = imageFile && selectedProvider !== 'volcengine'
    ? imageFile.buffer.toString('base64')
    : '';
  const mimeType = imageFile?.mimetype || 'image/png';
  const imageDataUrl = imageBase64 ? `data:${mimeType};base64,${imageBase64}` : '';

  // 解析生成参数
  let params;
  try {
    params = parameters ? JSON.parse(parameters) : {};
  } catch (e) {
    params = {};
  }

  const size = params.size;
  const width = Number.isInteger(params.width) ? params.width : undefined;
  const height = Number.isInteger(params.height) ? params.height : undefined;
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
      const seedMin = selectedProvider === 'volcengine' ? -1 : 0;
      const seedErr = validateIntegerInRange('seed', seed, seedMin, 2147483647);
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

    if (selectedProvider === 'volcengine') {
      const uploadedImageMeta = imageFile
        ? await saveUploadedImageAsPublicUrl(req, imageFile)
        : { publicUrl: '', filePath: '' };
      let parsedImageUrls = [];
      if (imageUrls) {
        try {
          const urlInput = typeof imageUrls === 'string' ? JSON.parse(imageUrls) : imageUrls;
          parsedImageUrls = parseImageUrlsInput(urlInput);
        } catch (e) {
          parsedImageUrls = parseImageUrlsInput(imageUrls);
        }
      }
      if (uploadedImageMeta.publicUrl) {
        parsedImageUrls.unshift(uploadedImageMeta.publicUrl);
      }
      if (selectedModel === 'jimeng_i2i_v30') {
        // 文档要求图生图3.0仅允许1张参考图：优先本地上传，其次远程URL首张
        if (uploadedImageMeta.publicUrl) {
          parsedImageUrls = [uploadedImageMeta.publicUrl];
        } else if (parsedImageUrls.length > 0) {
          parsedImageUrls = [parsedImageUrls[0]];
        } else {
          return res.status(400).json({ error: 'jimeng-3.0-i2i 需要且仅支持 1 张参考图（本地上传或1条HTTP URL）' });
        }
      }
      const volcengineImageUrls = await generateWithVolcengine({
        credentials: volcengineCredentials,
        model: selectedModel,
        prompt,
        n,
        size: parseSizeToArea(size),
        width,
        height,
        watermark,
        imageUrls: parsedImageUrls,
        scale: selectedModel === 'jimeng_seedream46_cvtob'
          ? Math.max(1, Math.min(100, Math.round(imageStrength * 100)))
          : imageStrength,
        usePreLlm: promptExtend,
        seed,
      });
      if (uploadedImageMeta.filePath) {
        scheduleUploadedFileCleanup(uploadedImageMeta.filePath);
      }
      return res.json({ imageUrls: volcengineImageUrls });
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

    const syncImageUrls = extractImageUrls(syncData, selectedModel);
    if (!syncImageUrls.length) {
      console.error('❌ API返回中未找到图片URL');
      if (DEBUG) console.log('API响应:', JSON.stringify(syncData, null, 2));
      return res.status(500).json({ error: 'No image URL in response' });
    }

    if (DEBUG) console.log('✅ 生成图片数量:', syncImageUrls.length);
    res.json({ imageUrls: syncImageUrls });
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
