/**
 * 视频生成相关路由
 */

const express = require('express');
const router = express.Router();
const {
  VIDEO_MODELS,
  VOLCENGINE_HOST,
  VOLCENGINE_VERSION,
  VOLCENGINE_SERVICE,
  VOLCENGINE_REGION,
  VIDEO_GENERATION_REQUEST_TIMEOUT_MS,
  UPLOAD_FILE_CLEANUP_DELAY_MS,
  DASHSCOPE_VIDEO_MAX_POLL_ATTEMPTS,
  DASHSCOPE_VIDEO_POLL_INTERVAL_MS,
  BASE_URL,
  VIDEO_ENDPOINT,
  TASK_ENDPOINT,
} = require('../config');
const {
  getApiKey,
  parseVolcengineCredentials,
  normalizeVolcengineModel,
  volcengineSign,
  volcengineCanonicalQuery,
  fetchWithTimeout,
  formatUpstreamError,
  validateStringMaxLen,
  validateIntegerInRange,
  extractVideoUrl,
  saveUploadedImageAsPublicUrl,
  scheduleUploadedFileCleanup,
  getDashscopeVideoModels,
  saveVideoTaskRecord,
} = require('../utils');
const { upload, uploadMotion, handleMulterError } = require('../middleware');

// 获取可用视频模型列表
router.post('/video-models', async (req, res) => {
  const models = await getDashscopeVideoModels(req.body?.apiKey);
  res.json(models);
});

// DashScope 视频生成
router.post('/generate-video', (req, res, next) => {
  uploadMotion.fields([
    { name: 'firstFrame', maxCount: 1 },
    { name: 'lastFrame', maxCount: 1 },
    { name: 'videoFile', maxCount: 1 },
    { name: 'refImage', maxCount: 1 },
    { name: 'r2vFiles', maxCount: 9 },
  ])(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  const { apiKey, model, mode, prompt, parameters } = req.body;
  const progressMode = req.body.progressMode === true || req.body.progressMode === 'true';
  const selectedMode = mode === 'videoedit' ? 'videoedit' : (mode === 'r2v' ? 'r2v' : (mode === 'image2video' ? 'image2video' : 'text2video'));
  const selectedModel = typeof model === 'string' && model.trim()
    ? model.trim()
    : (VIDEO_MODELS[selectedMode] ? VIDEO_MODELS[selectedMode][0].value : 'wan2.7-videoedit');
  const resolvedApiKey = getApiKey('dashscope', apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: '请提供 DashScope API Key' });
  if ((selectedMode === 'text2video' || selectedMode === 'videoedit') && (!prompt || !prompt.trim())) {
    return res.status(400).json({ error: selectedMode === 'videoedit' ? '请输入视频编辑指令' : '请输入视频描述' });
  }

  let params;
  try { params = parameters ? JSON.parse(parameters) : {}; } catch (e) { params = {}; }

  const promptErr = validateStringMaxLen('prompt', prompt, 5000);
  if (promptErr) return res.status(400).json({ error: promptErr });
  const negativeErr = selectedMode !== 'videoedit' ? validateStringMaxLen('negative_prompt', params.negative_prompt, 500) : null;
  if (negativeErr) return res.status(400).json({ error: negativeErr });
  const duration = params.duration === undefined ? 5 : params.duration;
  const minDuration = selectedModel.startsWith('happyhorse-1.0-') ? 3 : 2;
  const durationErr = selectedMode !== 'videoedit' ? validateIntegerInRange('duration', duration, minDuration, 15) : null;
  if (durationErr) return res.status(400).json({ error: durationErr });
  if (params.seed !== undefined) {
    const seedErr = validateIntegerInRange('seed', params.seed, 0, 2147483647);
    if (seedErr) return res.status(400).json({ error: seedErr });
  }

  const firstFrame = req.files?.firstFrame?.[0];
  const lastFrame = req.files?.lastFrame?.[0];
  const imageDataUrl = firstFrame ? `data:${firstFrame.mimetype};base64,${firstFrame.buffer.toString('base64')}` : '';
  const lastFrameDataUrl = lastFrame ? `data:${lastFrame.mimetype};base64,${lastFrame.buffer.toString('base64')}` : '';
  if (selectedMode === 'image2video' && !imageDataUrl) {
    return res.status(400).json({ error: '图生视频需要上传首帧图片' });
  }

  const input = {};
  if (prompt && prompt.trim()) input.prompt = prompt.trim();
  if (params.negative_prompt) input.negative_prompt = params.negative_prompt;

  // r2v 参考生视频：上传多个参考文件，构建 media 数组
  const r2vFiles = req.files?.r2vFiles || [];
  if (selectedMode === 'r2v' && r2vFiles.length > 0) {
    try {
      const mediaItems = [];
      for (const file of r2vFiles) {
        const meta = await saveUploadedImageAsPublicUrl(req, file);
        scheduleUploadedFileCleanup(meta.filePath, VIDEO_GENERATION_REQUEST_TIMEOUT_MS + UPLOAD_FILE_CLEANUP_DELAY_MS);
        const mediaType = file.mimetype.startsWith('video/') ? 'reference_video' : 'reference_image';
        mediaItems.push({ type: mediaType, url: meta.publicUrl });
      }
      input.media = mediaItems;
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  } else if (selectedMode === 'image2video' && selectedModel === 'happyhorse-1.0-i2v') {
    let uploadedVideoFrameMeta = null;
    try {
      uploadedVideoFrameMeta = await saveUploadedImageAsPublicUrl(req, firstFrame);
      if (uploadedVideoFrameMeta.filePath) {
        scheduleUploadedFileCleanup(uploadedVideoFrameMeta.filePath, VIDEO_GENERATION_REQUEST_TIMEOUT_MS + UPLOAD_FILE_CLEANUP_DELAY_MS);
      }
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    input.media = [{ type: 'first_frame', url: uploadedVideoFrameMeta.publicUrl }];
  } else if (selectedMode === 'image2video' && selectedModel.startsWith('wan2.7-i2v')) {
    input.media = [{ type: 'first_frame', url: imageDataUrl }];
    if (lastFrameDataUrl) input.media.push({ type: 'last_frame', url: lastFrameDataUrl });
  } else if (selectedMode === 'image2video') {
    input.img_url = imageDataUrl;
  }

  // 视频编辑：media 包含 video + 可选 reference_image
  if (selectedMode === 'videoedit') {
    const videoFile = req.files?.videoFile?.[0];
    const refImageFile = req.files?.refImage?.[0];
    if (!videoFile) return res.status(400).json({ error: '请上传待编辑的视频' });
    try {
      const videoMeta = await saveUploadedImageAsPublicUrl(req, videoFile);
      scheduleUploadedFileCleanup(videoMeta.filePath, VIDEO_GENERATION_REQUEST_TIMEOUT_MS + UPLOAD_FILE_CLEANUP_DELAY_MS);
      input.media = [{ type: 'video', url: videoMeta.publicUrl }];
      if (refImageFile) {
        const refMeta = await saveUploadedImageAsPublicUrl(req, refImageFile);
        scheduleUploadedFileCleanup(refMeta.filePath, VIDEO_GENERATION_REQUEST_TIMEOUT_MS + UPLOAD_FILE_CLEANUP_DELAY_MS);
        input.media.push({ type: 'reference_image', url: refMeta.publicUrl });
      }
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  const requestParams = {
    resolution: params.resolution || '720P',
    prompt_extend: params.prompt_extend !== false,
    watermark: params.watermark === true,
  };
  if (selectedMode !== 'videoedit') {
    requestParams.duration = duration;
  }
  if (selectedMode === 'text2video' && params.ratio) {
    if (selectedModel.startsWith('wan2.7-t2v') || selectedModel === 'happyhorse-1.0-t2v') {
      requestParams.ratio = params.ratio;
    } else {
      const sizes = {
        '720P': { '16:9': '1280*720', '9:16': '720*1280', '1:1': '960*960', '4:3': '1088*832', '3:4': '832*1088' },
        '1080P': { '16:9': '1920*1080', '9:16': '1080*1920', '1:1': '1440*1440', '4:3': '1632*1248', '3:4': '1248*1632' },
      };
      requestParams.size = sizes[requestParams.resolution]?.[params.ratio] || '1280*720';
      delete requestParams.resolution;
    }
  }
  if (params.seed !== undefined) requestParams.seed = params.seed;

  try {
    const submitRes = await fetchWithTimeout(
      `${BASE_URL}${VIDEO_ENDPOINT}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedApiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({ model: selectedModel, input, parameters: requestParams }),
      },
      VIDEO_GENERATION_REQUEST_TIMEOUT_MS
    );
    const submitData = await submitRes.json();
    if (!submitRes.ok) return res.status(submitRes.status).json({ error: formatUpstreamError(submitData) });
    const taskId = submitData.output?.task_id;
    if (!taskId) return res.status(500).json({ error: '未返回 task_id' });
    saveVideoTaskRecord({
      taskId, provider: 'dashscope', model: selectedModel, mode: selectedMode,
      status: submitData.output?.task_status || 'PENDING', prompt: prompt?.trim() || '',
      duration, resolution: requestParams.resolution || params.resolution || '',
      ratio: requestParams.ratio || params.ratio || '',
    });
    if (progressMode) {
      return res.json({
        provider: 'dashscope', resultType: 'video', taskId,
        taskStatus: submitData.output?.task_status || 'PENDING', model: selectedModel,
      });
    }

    for (let attempt = 0; attempt < DASHSCOPE_VIDEO_MAX_POLL_ATTEMPTS; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, DASHSCOPE_VIDEO_POLL_INTERVAL_MS));
      const pollRes = await fetchWithTimeout(`${BASE_URL}${TASK_ENDPOINT}${taskId}`, {
        headers: { Authorization: `Bearer ${resolvedApiKey}` },
      }, VIDEO_GENERATION_REQUEST_TIMEOUT_MS);
      const pollData = await pollRes.json();
      const status = pollData.output?.task_status;
      if (status === 'SUCCEEDED') {
        const videoUrl = extractVideoUrl(pollData);
        if (!videoUrl) return res.status(500).json({ error: '响应中未包含视频 URL' });
        saveVideoTaskRecord({ taskId, status, videoUrl, usage: pollData.usage || null });
        return res.json({ videoUrl, taskId, usage: pollData.usage || null });
      }
      if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
        const errorMessage = formatUpstreamError(pollData, `视频任务失败：${status}`);
        saveVideoTaskRecord({ taskId, status, message: errorMessage });
        return res.status(500).json({ error: errorMessage });
      }
    }
    return res.status(504).json({ error: '视频任务超时' });
  } catch (err) {
    if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
      return res.status(504).json({ error: '上游请求超时' });
    }
    return res.status(500).json({ error: formatUpstreamError(err.message) });
  }
});

// 即梦视频生成 (Volcengine)
router.post('/jimeng-video', (req, res, next) => {
  upload.fields([
    { name: 'firstFrame', maxCount: 1 },
    { name: 'lastFrame', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  const { apiKey, model, prompt, parameters } = req.body;
  const credentials = parseVolcengineCredentials(apiKey);
  if (apiKey && !credentials) return res.status(400).json({ error: 'Volcengine 凭证格式无效，请使用 AK:SK 格式' });
  if (!credentials) return res.status(400).json({ error: '请提供 Volcengine AK/SK' });
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: '请输入视频描述' });

  const reqKey = normalizeVolcengineModel(model);
  let params;
  try { params = parameters ? JSON.parse(parameters) : {}; } catch (e) { params = {}; }

  const firstFrame = req.files?.firstFrame?.[0];
  const lastFrame = req.files?.lastFrame?.[0];

  const submitBody = { req_key: reqKey, prompt: prompt.trim() };
  if (Number.isInteger(params.seed)) submitBody.seed = params.seed;
  if (Number.isInteger(params.frames)) submitBody.frames = params.frames;
  if (params.aspect_ratio) submitBody.aspect_ratio = params.aspect_ratio;

  if (reqKey === 'jimeng_i2v_first_v30_1080' || reqKey === 'jimeng_i2v_first_tail_v30_1080' || reqKey === 'jimeng_ti2v_v30_pro') {
    if (firstFrame) {
      submitBody.binary_data_base64 = [firstFrame.buffer.toString('base64')];
      if (lastFrame && reqKey === 'jimeng_i2v_first_tail_v30_1080') {
        submitBody.binary_data_base64.push(lastFrame.buffer.toString('base64'));
      }
    }
  }

  try {
    const baseUrl = `https://${VOLCENGINE_HOST}`;
    const submitQuery = { Action: 'CVSync2AsyncSubmitTask', Version: VOLCENGINE_VERSION };
    const submitBodyText = JSON.stringify(submitBody);
    const submitAuth = volcengineSign({
      accessKey: credentials.accessKey, secretKey: credentials.secretKey,
      sessionToken: credentials.sessionToken || '', bodyText: submitBodyText,
      queryParams: submitQuery, host: VOLCENGINE_HOST, service: VOLCENGINE_SERVICE, region: VOLCENGINE_REGION,
    });
    const submitRes = await fetchWithTimeout(`${baseUrl}/?${volcengineCanonicalQuery(submitQuery)}`, {
      method: 'POST', headers: submitAuth.headers, body: submitBodyText,
    }, VIDEO_GENERATION_REQUEST_TIMEOUT_MS);
    const submitData = await submitRes.json();
    if (submitData?.code !== 10000) throw new Error(submitData?.message || `Volcengine submit failed (${submitRes.status})`);
    const taskId = submitData?.data?.task_id;
    if (!taskId) throw new Error('Volcengine 提交成功但未返回 task_id');

    saveVideoTaskRecord({ taskId, provider: 'volcengine', model: reqKey, mode: 'text2video', status: 'PENDING', prompt: prompt.trim() });
    return res.json({ provider: 'volcengine', resultType: 'video', taskId, taskStatus: 'PENDING', model: reqKey });
  } catch (err) {
    return res.status(500).json({ error: formatUpstreamError(err.message) });
  }
});

// 即梦动作模仿
router.post('/jimeng-motion', uploadMotion.fields([
  { name: 'motionImage', maxCount: 1 },
  { name: 'motionVideo', maxCount: 1 },
]), async (req, res) => {
  const { apiKey, model } = req.body;
  const credentials = parseVolcengineCredentials(apiKey);
  if (apiKey && !credentials) return res.status(400).json({ error: 'Volcengine 凭证格式无效，请使用 AK:SK 格式' });
  if (!credentials) return res.status(400).json({ error: '请提供 Volcengine AK/SK' });

  const imageFile = req.files?.motionImage?.[0];
  const videoFile = req.files?.motionVideo?.[0];
  if (!imageFile) return res.status(400).json({ error: '请上传人物图片' });
  if (!videoFile) return res.status(400).json({ error: '请上传模板视频' });

  const reqKey = normalizeVolcengineModel(model);

  try {
    const imageMeta = await saveUploadedImageAsPublicUrl(req, imageFile);
    const videoMeta = await saveUploadedImageAsPublicUrl(req, videoFile);
    const cleanupDelay = VIDEO_GENERATION_REQUEST_TIMEOUT_MS + UPLOAD_FILE_CLEANUP_DELAY_MS;
    if (imageMeta.filePath) scheduleUploadedFileCleanup(imageMeta.filePath, cleanupDelay);
    if (videoMeta.filePath) scheduleUploadedFileCleanup(videoMeta.filePath, cleanupDelay);

    const submitBody = { req_key: reqKey };
    if (reqKey === 'jimeng_dreamactor_m20_gen_video') {
      submitBody.binary_data_base64 = [imageFile.buffer.toString('base64')];
      submitBody.video_url = videoMeta.publicUrl;
    } else {
      submitBody.image_url = imageMeta.publicUrl;
      submitBody.video_url = videoMeta.publicUrl;
    }

    const baseUrl = `https://${VOLCENGINE_HOST}`;
    const submitQuery = { Action: 'CVSync2AsyncSubmitTask', Version: VOLCENGINE_VERSION };
    const submitBodyText = JSON.stringify(submitBody);
    const submitAuth = volcengineSign({
      accessKey: credentials.accessKey, secretKey: credentials.secretKey,
      sessionToken: credentials.sessionToken || '', bodyText: submitBodyText,
      queryParams: submitQuery, host: VOLCENGINE_HOST, service: VOLCENGINE_SERVICE, region: VOLCENGINE_REGION,
    });
    const submitRes = await fetchWithTimeout(`${baseUrl}/?${volcengineCanonicalQuery(submitQuery)}`, {
      method: 'POST', headers: submitAuth.headers, body: submitBodyText,
    }, VIDEO_GENERATION_REQUEST_TIMEOUT_MS);
    const submitData = await submitRes.json();
    if (submitData?.code !== 10000) throw new Error(submitData?.message || `Volcengine submit failed (${submitRes.status})`);
    const taskId = submitData?.data?.task_id;
    if (!taskId) throw new Error('Volcengine 提交成功但未返回 task_id');

    saveVideoTaskRecord({ taskId, provider: 'volcengine', model: reqKey, mode: 'motion', status: 'PENDING', prompt: '动作模仿' });
    return res.json({ provider: 'volcengine', resultType: 'video', taskId, taskStatus: 'PENDING', model: reqKey });
  } catch (err) {
    return res.status(500).json({ error: formatUpstreamError(err.message) });
  }
});

module.exports = router;
