/**
 * 图片生成相关路由
 */

const express = require('express');
const router = express.Router();
const {
  DEBUG,
  GENERATION_REQUEST_TIMEOUT_MS,
  UPLOAD_FILE_CLEANUP_DELAY_MS,
  DASHSCOPE_MAX_POLL_ATTEMPTS,
  DASHSCOPE_POLL_INTERVAL_MS,
  BASE_URL,
  SYNC_ENDPOINT,
  ASYNC_ENDPOINT,
  TASK_ENDPOINT,
  ALLOWED_PROVIDERS,
  ALLOWED_MODELS,
} = require('../config');
const {
  getApiKey,
  parseVolcengineCredentials,
  normalizeProvider,
  normalizeGeminiModel,
  normalizeVolcengineModel,
  isSyncModel,
  getModelConfig,
  extractImageUrls,
  parseSizeToArea,
  parseImageUrlsInput,
  validateIntegerInRange,
  validateStringMaxLen,
  validateSize,
  generateWithGemini,
  generateWithVolcengine,
  generateWithAgnes,
  fetchWithTimeout,
  formatUpstreamError,
  saveUploadedImageAsPublicUrl,
  scheduleUploadedFileCleanup,
  saveImageTaskRecord,
} = require('../utils');
const { upload, handleMulterError } = require('../middleware');

// 文生图
router.post('/generate-image', async (req, res) => {
  const { prompt, apiKey, model, parameters = {}, provider, progressMode } = req.body;
  const wantsProgress = progressMode === true || progressMode === 'true';

  const selectedProvider = normalizeProvider(provider);
  if (!ALLOWED_PROVIDERS.includes(selectedProvider)) {
    return res.status(400).json({ error: '无效的 provider' });
  }

  const volcengineCredentials = selectedProvider === 'volcengine'
    ? parseVolcengineCredentials(apiKey)
    : null;
  if (selectedProvider === 'volcengine' && apiKey && !volcengineCredentials) {
    return res.status(400).json({ error: 'Volcengine 凭证格式无效，请使用 AK:SK 格式' });
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: '请输入图片描述' });
  }
  const resolvedApiKey = selectedProvider === 'volcengine'
    ? (volcengineCredentials ? `${volcengineCredentials.accessKey}:***` : '')
    : getApiKey(selectedProvider, apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: '请提供 API Key' });

  const selectedModel = selectedProvider === 'gemini'
    ? normalizeGeminiModel(model)
    : (selectedProvider === 'volcengine'
      ? normalizeVolcengineModel(model)
      : (model || 'wan2.6-t2i'));

  if (selectedProvider === 'dashscope' && !ALLOWED_MODELS.includes(selectedModel)) {
    return res.status(400).json({ error: '无效的模型' });
  }

  const config = getModelConfig(selectedModel);
  const authHeader = { 'Authorization': `Bearer ${resolvedApiKey}` };

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

  const dashscopeTimeoutMs = Number.parseInt(process.env.DASHSCOPE_TIMEOUT_MS || String(GENERATION_REQUEST_TIMEOUT_MS), 10);

  try {
    if (selectedProvider === 'gemini') {
      const imageUrls = await generateWithGemini({
        apiKey: resolvedApiKey, model: selectedModel, prompt, n,
      });
      saveImageTaskRecord({ mode: 'text2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls });
      return res.json({ imageUrls });
    }

    if (selectedProvider === 'agnes') {
      const imageUrls = await generateWithAgnes({
        apiKey: resolvedApiKey, model: selectedModel, prompt, n, size,
      });
      saveImageTaskRecord({ mode: 'text2image', provider: 'agnes', model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls });
      return res.json({ imageUrls });
    }

    if (selectedProvider === 'volcengine') {
      const volcengineResult = await generateWithVolcengine({
        credentials: volcengineCredentials, model: selectedModel, prompt, n,
        size: parseSizeToArea(size), width, height, watermark,
        usePreLlm: promptExtend, seed, returnTask: wantsProgress,
      });
      if (wantsProgress) {
        saveImageTaskRecord({
          id: volcengineResult.taskId, taskId: volcengineResult.taskId,
          mode: 'text2image', provider: 'volcengine', model: selectedModel,
          status: volcengineResult.taskStatus, prompt,
        });
        return res.json({
          provider: 'volcengine', resultType: 'image',
          taskId: volcengineResult.taskId, taskStatus: volcengineResult.taskStatus, model: selectedModel,
        });
      }
      saveImageTaskRecord({ mode: 'text2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls: volcengineResult });
      return res.json({ imageUrls: volcengineResult });
    }

    // 同步模型
    if (isSyncModel(selectedModel)) {
      const syncParams = { size, n, prompt_extend: promptExtend, watermark };
      if (seed !== undefined) syncParams.seed = seed;
      if (negativePrompt) syncParams.negative_prompt = negativePrompt;
      const syncRes = await fetchWithTimeout(
        `${BASE_URL}${SYNC_ENDPOINT}`,
        {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            input: { messages: [{ role: 'user', content: [{ text: prompt.trim() }] }] },
            parameters: syncParams,
          }),
        },
        dashscopeTimeoutMs
      );
      const syncData = await syncRes.json();
      if (!syncRes.ok) return res.status(syncRes.status).json({ error: formatUpstreamError(syncData) });
      const imageUrls = extractImageUrls(syncData, selectedModel);
      if (!imageUrls.length) return res.status(500).json({ error: '响应中未包含图片 URL' });
      saveImageTaskRecord({ mode: 'text2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls });
      return res.json({ imageUrls });
    }

    // 异步模型
    const asyncParams = { size, n };
    if (seed !== undefined) asyncParams.seed = seed;
    if (negativePrompt) asyncParams.negative_prompt = negativePrompt;
    if (promptExtend) asyncParams.prompt_extend = promptExtend;
    if (watermark) asyncParams.watermark = watermark;

    const submitRes = await fetchWithTimeout(
      `${BASE_URL}${ASYNC_ENDPOINT}`,
      {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' },
        body: JSON.stringify({ model: selectedModel, input: { prompt: prompt.trim() }, parameters: asyncParams }),
      },
      dashscopeTimeoutMs
    );
    const submitData = await submitRes.json();
    if (!submitRes.ok) return res.status(submitRes.status).json({ error: formatUpstreamError(submitData) });
    const taskId = submitData.output?.task_id;
    if (!taskId) return res.status(500).json({ error: '未返回 task_id' });

    if (wantsProgress) {
      saveImageTaskRecord({
        id: taskId, taskId, mode: 'text2image', provider: 'dashscope',
        model: selectedModel, status: submitData.output?.task_status || 'PENDING', prompt,
      });
      return res.json({
        provider: 'dashscope', resultType: 'image', taskId,
        taskStatus: submitData.output?.task_status || 'PENDING', model: selectedModel,
      });
    }

    let imageUrls = null;
    let attempts = 0;
    while (attempts < DASHSCOPE_MAX_POLL_ATTEMPTS) {
      await new Promise(r => setTimeout(r, DASHSCOPE_POLL_INTERVAL_MS));
      const pollRes = await fetchWithTimeout(
        `${BASE_URL}${TASK_ENDPOINT}${taskId}`,
        { headers: authHeader },
        dashscopeTimeoutMs
      );
      const pollData = await pollRes.json();
      const status = pollData.output?.task_status;
      if (status === 'SUCCEEDED') {
        imageUrls = extractImageUrls(pollData, selectedModel);
        saveImageTaskRecord({ id: taskId, taskId, mode: 'text2image', provider: 'dashscope', model: selectedModel, status, prompt, imageUrls, usage: pollData.usage || null });
        break;
      } else if (status === 'FAILED') {
        const errorMessage = formatUpstreamError(pollData, 'Task failed');
        saveImageTaskRecord({ id: taskId, taskId, mode: 'text2image', provider: 'dashscope', model: selectedModel, status, prompt, message: errorMessage });
        return res.status(500).json({ error: errorMessage });
      }
      attempts++;
    }
    if (!imageUrls || !imageUrls.length) return res.status(504).json({ error: '任务超时' });
    res.json({ imageUrls });
  } catch (err) {
    if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
      return res.status(504).json({ error: '上游请求超时' });
    }
    res.status(500).json({ error: formatUpstreamError(err.message) });
  }
});

// 图生图
router.post('/image-to-image', (req, res, next) => {
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'imageMask', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  const { prompt, apiKey, model, parameters, provider, imageUrls } = req.body;
  const progressMode = req.body.progressMode === true || req.body.progressMode === 'true';

  const selectedProvider = normalizeProvider(provider);
  if (!ALLOWED_PROVIDERS.includes(selectedProvider)) {
    return res.status(400).json({ error: '无效的 provider' });
  }

  const volcengineCredentials = selectedProvider === 'volcengine'
    ? parseVolcengineCredentials(apiKey)
    : null;
  if (selectedProvider === 'volcengine' && apiKey && !volcengineCredentials) {
    return res.status(400).json({ error: 'Volcengine 凭证格式无效，请使用 AK:SK 格式' });
  }
  const imageFile = req.files?.image?.[0];
  const imageMaskFile = req.files?.imageMask?.[0];

  if (selectedProvider !== 'volcengine' && !imageFile) {
    return res.status(400).json({ error: '参考图片是必需的' });
  }
  const resolvedApiKey = selectedProvider === 'volcengine'
    ? (volcengineCredentials ? `${volcengineCredentials.accessKey}:***` : '')
    : getApiKey(selectedProvider, apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: '请提供 API Key' });

  const selectedModel = selectedProvider === 'gemini'
    ? normalizeGeminiModel(model)
    : (selectedProvider === 'volcengine'
      ? normalizeVolcengineModel(model)
      : (model || 'wan2.6-image'));

  if (selectedProvider === 'dashscope' && !ALLOWED_MODELS.includes(selectedModel)) {
    return res.status(400).json({ error: '无效的模型' });
  }

  const authHeader = { 'Authorization': `Bearer ${resolvedApiKey}` };

  const I2I_SUPPORTED_MODELS = ['wan2.7-image-pro', 'wan2.7-image', 'wan2.6-image'];
  if (selectedProvider === 'dashscope' && !I2I_SUPPORTED_MODELS.includes(selectedModel)) {
    return res.status(400).json({
      error: `模型 ${selectedModel} 不支持图生图，请使用: ${I2I_SUPPORTED_MODELS.join(', ')}`,
    });
  }

  if (DEBUG) console.log('📷 图生图请求 - 使用模型:', selectedModel);

  const imageBase64 = imageFile && selectedProvider !== 'volcengine'
    ? imageFile.buffer.toString('base64')
    : '';
  const mimeType = imageFile?.mimetype || 'image/png';
  const imageDataUrl = imageBase64 ? `data:${mimeType};base64,${imageBase64}` : '';

  let params;
  try { params = parameters ? JSON.parse(parameters) : {}; } catch (e) { params = {}; }

  const size = params.size;
  const width = Number.isInteger(params.width) ? params.width : undefined;
  const height = Number.isInteger(params.height) ? params.height : undefined;
  const n = params.n === undefined ? 1 : params.n;
  const seed = params.seed;
  const negativePrompt = params.negative_prompt;
  const promptExtend = params.prompt_extend !== undefined ? params.prompt_extend : true;
  const watermark = params.watermark || false;
  const hasImageStrength = params.image_strength !== undefined;
  const imageStrength = hasImageStrength ? params.image_strength : 0.5;
  const upscaleResolution = typeof params.upscale_resolution === 'string' ? params.upscale_resolution : undefined;
  const upscaleScale = params.upscale_scale;
  const inpaintingSeed = params.inpainting_seed;
  const imageEditPrompt = typeof params.image_edit_prompt === 'string'
    ? params.image_edit_prompt
    : (typeof params.edit_prompt === 'string' ? params.edit_prompt : prompt);
  const loraWeight = typeof params.lora_weight === 'number' ? params.lora_weight : undefined;

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
        return res.status(400).json({ error: 'image_strength 必须是 0 到 1 之间的数字' });
      }
    }

    if (selectedProvider === 'gemini') {
      const imageUrls = await generateWithGemini({
        apiKey: resolvedApiKey, model: selectedModel, prompt, n, imageDataUrl,
      });
      saveImageTaskRecord({ mode: 'image2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls });
      return res.json({ imageUrls });
    }

    if (selectedProvider === 'agnes') {
      const agnesImageUrls = [];
      if (imageFile) {
        const meta = await saveUploadedImageAsPublicUrl(req, imageFile);
        scheduleUploadedFileCleanup(meta.filePath, GENERATION_REQUEST_TIMEOUT_MS + UPLOAD_FILE_CLEANUP_DELAY_MS);
        agnesImageUrls.push(meta.publicUrl);
      }
      const agnesResult = await generateWithAgnes({
        apiKey: resolvedApiKey, model: selectedModel, prompt, n, size, imageUrls: agnesImageUrls,
      });
      saveImageTaskRecord({ mode: 'image2image', provider: 'agnes', model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls: agnesResult });
      return res.json({ imageUrls: agnesResult });
    }

    if (selectedProvider === 'volcengine') {
      const uploadedImageMeta = imageFile
        ? await saveUploadedImageAsPublicUrl(req, imageFile)
        : { publicUrl: '', filePath: '' };
      const uploadedMaskMeta = imageMaskFile
        ? await saveUploadedImageAsPublicUrl(req, imageMaskFile)
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
      if (uploadedImageMeta.publicUrl) parsedImageUrls.unshift(uploadedImageMeta.publicUrl);
      if (selectedModel === 'jimeng_i2i_v30') {
        if (uploadedImageMeta.publicUrl) {
          parsedImageUrls = [uploadedImageMeta.publicUrl];
        } else if (parsedImageUrls.length > 0) {
          parsedImageUrls = [parsedImageUrls[0]];
        } else {
          return res.status(400).json({ error: 'jimeng-3.0-i2i 需要且仅支持 1 张参考图（本地上传或1条HTTP URL）' });
        }
      } else if (selectedModel === 'jimeng_i2i_seed3_tilesr_cvtob') {
        if (uploadedImageMeta.publicUrl) {
          parsedImageUrls = [uploadedImageMeta.publicUrl];
        } else if (parsedImageUrls.length > 0) {
          parsedImageUrls = [parsedImageUrls[0]];
        } else {
          return res.status(400).json({ error: 'jimeng-upscale 需要且仅支持 1 张参考图（本地上传或1条HTTP URL）' });
        }
      } else if (selectedModel === 'jimeng_image2image_dream_inpaint') {
        if (uploadedImageMeta.publicUrl && uploadedMaskMeta.publicUrl) {
          parsedImageUrls = [uploadedImageMeta.publicUrl, uploadedMaskMeta.publicUrl];
        } else {
          if (uploadedImageMeta.publicUrl) parsedImageUrls = [uploadedImageMeta.publicUrl, ...parsedImageUrls];
          if (uploadedMaskMeta.publicUrl) parsedImageUrls = [parsedImageUrls[0], uploadedMaskMeta.publicUrl].filter(Boolean);
        }
        if (parsedImageUrls.length < 2) {
          return res.status(400).json({ error: 'jimeng-inpainting 需要 2 张参考图（原图+mask）。请上传原图与Mask图，或补足URL。' });
        }
        parsedImageUrls = parsedImageUrls.slice(0, 2);
      } else if (selectedModel === 'i2i_material_extraction' || selectedModel === 'jimeng_i2i_extract_tiled_images') {
        if (uploadedImageMeta.publicUrl) {
          parsedImageUrls = [uploadedImageMeta.publicUrl];
        } else if (parsedImageUrls.length > 0) {
          parsedImageUrls = [parsedImageUrls[0]];
        } else {
          return res.status(400).json({ error: `${selectedModel} 需要且仅支持 1 张参考图（本地上传或1条HTTP URL）` });
        }
      }
      const volcengineScale = selectedModel === 'jimeng_seedream46_cvtob'
        ? Math.max(1, Math.min(100, Math.round(imageStrength * 100)))
        : (selectedModel === 'jimeng_i2i_seed3_tilesr_cvtob'
          ? Math.max(0, Math.min(100, Number.isFinite(upscaleScale) ? Math.round(upscaleScale) : Math.round(imageStrength * 100)))
          : (selectedModel === 'jimeng_i2i_v30' ? imageStrength : undefined));
      const volcengineSeed = selectedModel === 'jimeng_image2image_dream_inpaint'
        ? (Number.isInteger(inpaintingSeed) ? inpaintingSeed : seed)
        : seed;
      const volcengineResult = await generateWithVolcengine({
        credentials: volcengineCredentials, model: selectedModel, prompt, n,
        size: parseSizeToArea(size), width, height, watermark,
        imageUrls: parsedImageUrls, scale: volcengineScale,
        usePreLlm: promptExtend, seed: volcengineSeed,
        resolution: selectedModel === 'jimeng_i2i_seed3_tilesr_cvtob' ? upscaleResolution : undefined,
        imageEditPrompt, loraWeight, returnTask: progressMode,
      });
      if (progressMode) {
        const cleanupDelayMs = GENERATION_REQUEST_TIMEOUT_MS + UPLOAD_FILE_CLEANUP_DELAY_MS;
        if (uploadedImageMeta.filePath) scheduleUploadedFileCleanup(uploadedImageMeta.filePath, cleanupDelayMs);
        if (uploadedMaskMeta.filePath) scheduleUploadedFileCleanup(uploadedMaskMeta.filePath, cleanupDelayMs);
        saveImageTaskRecord({
          id: volcengineResult.taskId, taskId: volcengineResult.taskId,
          mode: 'image2image', provider: 'volcengine', model: selectedModel,
          status: volcengineResult.taskStatus, prompt,
        });
        return res.json({
          provider: 'volcengine', resultType: 'image',
          taskId: volcengineResult.taskId, taskStatus: volcengineResult.taskStatus, model: selectedModel,
        });
      }
      if (uploadedImageMeta.filePath) scheduleUploadedFileCleanup(uploadedImageMeta.filePath);
      if (uploadedMaskMeta.filePath) scheduleUploadedFileCleanup(uploadedMaskMeta.filePath);
      saveImageTaskRecord({ mode: 'image2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls: volcengineResult });
      return res.json({ imageUrls: volcengineResult });
    }

    // DashScope 图生图同步API
    const syncParams = { n };
    if (size) syncParams.size = size;
    if (seed !== undefined) syncParams.seed = seed;
    if (negativePrompt) syncParams.negative_prompt = negativePrompt;
    if (hasImageStrength) syncParams.image_strength = imageStrength;
    if (promptExtend === true) syncParams.prompt_extend = true;
    if (watermark === true) syncParams.watermark = true;

    const content = [{ image: imageDataUrl }];
    if (prompt) content.push({ text: prompt });

    const requestBody = {
      model: selectedModel,
      input: { messages: [{ role: 'user', content }] },
      parameters: syncParams,
    };

    if (DEBUG) {
      console.log('=== 图生图请求调试 ===');
      console.log('模型:', selectedModel);
      console.log('图片大小:', imageFile.size, '字节');
      console.log('图片类型:', imageFile.mimetype);
      console.log('参数数量:', Object.keys(syncParams).length);
      console.log('=====================');
    }

    const syncRes = await fetchWithTimeout(
      `${BASE_URL}${SYNC_ENDPOINT}`,
      {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      GENERATION_REQUEST_TIMEOUT_MS
    );
    const syncData = await syncRes.json();

    if (!syncRes.ok) {
      console.error('❌ 图生图API错误:');
      console.error('HTTP状态码:', syncRes.status);
      const errorMessage = formatUpstreamError(syncData);
      if (DEBUG) console.error('错误消息:', errorMessage);
      return res.status(syncRes.status).json({ error: errorMessage });
    }

    if (DEBUG) console.log('✅ 图生图API调用成功');

    const syncImageUrls = extractImageUrls(syncData, selectedModel);
    if (!syncImageUrls.length) {
      console.error('❌ API返回中未找到图片URL');
      return res.status(500).json({ error: '响应中未包含图片 URL' });
    }

    if (DEBUG) console.log('✅ 生成图片数量:', syncImageUrls.length);
    saveImageTaskRecord({ mode: 'image2image', provider: selectedProvider, model: selectedModel, status: 'SUCCEEDED', prompt, imageUrls: syncImageUrls });
    res.json({ imageUrls: syncImageUrls });
  } catch (err) {
    console.error('❌ 图生图异常:', err);
    if (res.headersSent) {
      console.warn('响应已发送，跳过错误处理');
      return;
    }
    if (err.name === 'AbortError' || err.message?.includes('abort')) {
      return res.status(504).json({ error: '请求超时,图片较大或网络较慢,请稍后重试' });
    }
    if (err.message?.includes('fetch failed') || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.error('🌐 网络错误详情:', { message: err.message, code: err.code, cause: err.cause?.message });
      return res.status(502).json({ error: '网络错误,无法连接到 AI 服务,请检查网络或稍后重试' });
    }
    const errorMessage = formatUpstreamError(err.message);
    res.status(500).json({ error: errorMessage });
  }
});

module.exports = router;
