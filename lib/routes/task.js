/**
 * 任务记录和状态查询路由
 */

const express = require('express');
const router = express.Router();
const {
  BASE_URL,
  TASK_ENDPOINT,
  GENERATION_REQUEST_TIMEOUT_MS,
} = require('../config');
const {
  getApiKey,
  parseVolcengineCredentials,
  normalizeVolcengineTaskStatus,
  fetchVolcengineTaskResult,
  extractImageUrls,
  extractVideoUrl,
  extractVolcengineImageUrls,
  extractVolcengineVideoUrl,
  fetchWithTimeout,
  formatUpstreamError,
  saveVideoTaskRecord,
  saveImageTaskRecord,
  fetchAgnesVideoResult,
} = require('../utils');
const { videoTaskDb, mapVideoTaskRecord, mapImageTaskRecord } = require('../database');

// 视频任务记录
router.get('/video-task-records', (req, res) => {
  const limit = Math.max(1, Math.min(200, Number.parseInt(req.query.limit || '100', 10) || 100));
  const rows = videoTaskDb
    .prepare('SELECT * FROM video_tasks ORDER BY created_at DESC LIMIT ?')
    .all(limit);
  res.json({ records: rows.map(mapVideoTaskRecord) });
});

router.delete('/video-task-records', (req, res) => {
  videoTaskDb.prepare('DELETE FROM video_tasks').run();
  res.json({ ok: true });
});

router.post('/video-task-records/import', (req, res) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  let imported = 0;
  records.slice(0, 200).forEach((record) => {
    if (!record?.taskId || typeof record.taskId !== 'string') return;
    saveVideoTaskRecord({
      taskId: record.taskId,
      provider: record.provider || 'dashscope',
      model: record.model || '',
      mode: record.mode || '',
      status: record.status || 'PENDING',
      prompt: record.prompt || '',
      duration: Number.isInteger(record.duration) ? record.duration : null,
      resolution: record.resolution || '',
      ratio: record.ratio || '',
      videoUrl: record.videoUrl || '',
      usage: record.usage || null,
      errorMessage: record.error || '',
      createdAt: Number.isInteger(record.createdAt) ? record.createdAt : Date.now(),
    });
    imported += 1;
  });
  res.json({ imported });
});

// 图片任务记录
router.get('/image-task-records', (req, res) => {
  const limit = Math.max(1, Math.min(200, Number.parseInt(req.query.limit || '100', 10) || 100));
  const mode = req.query.mode === 'image2image' ? 'image2image' : 'text2image';
  const rows = videoTaskDb
    .prepare('SELECT * FROM image_tasks WHERE mode = ? ORDER BY created_at DESC LIMIT ?')
    .all(mode, limit);
  res.json({ records: rows.map(mapImageTaskRecord) });
});

// DashScope 任务状态查询
router.post('/dashscope-task-status', async (req, res) => {
  const { apiKey, taskId, model, resultType } = req.body || {};
  const resolvedApiKey = getApiKey('dashscope', apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: '请提供 DashScope API Key' });
  if (!taskId || typeof taskId !== 'string') return res.status(400).json({ error: '缺少 taskId' });

  try {
    const pollRes = await fetchWithTimeout(`${BASE_URL}${TASK_ENDPOINT}${taskId}`, {
      headers: { Authorization: `Bearer ${resolvedApiKey}` },
    }, GENERATION_REQUEST_TIMEOUT_MS);
    const pollData = await pollRes.json();
    if (!pollRes.ok) return res.status(pollRes.status).json({ error: formatUpstreamError(pollData, '查询任务失败') });

    const output = pollData.output || {};
    const status = output.task_status || 'UNKNOWN';
    const isTaskFailure = status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN';
    const message = isTaskFailure
      ? formatUpstreamError(pollData, output.message || `任务状态异常：${status}`)
      : (output.message || '');
    const payload = {
      provider: 'dashscope', taskId, taskStatus: status,
      requestId: pollData.request_id || '',
      submitTime: output.submit_time || '',
      scheduledTime: output.scheduled_time || '',
      endTime: output.end_time || '',
      message, usage: pollData.usage || null,
    };
    if (status === 'SUCCEEDED') {
      if (resultType === 'video') {
        payload.videoUrl = extractVideoUrl(pollData);
      } else {
        payload.imageUrls = extractImageUrls(pollData, model);
      }
    }
    if (resultType === 'video') {
      saveVideoTaskRecord({
        taskId, provider: 'dashscope', model, status,
        videoUrl: payload.videoUrl, usage: payload.usage, message,
      });
    } else {
      saveImageTaskRecord({
        id: taskId, taskId, mode: req.body?.mode || 'text2image',
        provider: 'dashscope', model, status,
        imageUrls: payload.imageUrls, usage: payload.usage, message,
      });
    }
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: formatUpstreamError(err.message) });
  }
});

// Volcengine 任务状态查询
router.post('/volcengine-task-status', async (req, res) => {
  const { apiKey, taskId, model, resultType, queryAction } = req.body || {};
  const credentials = parseVolcengineCredentials(apiKey);
  if (apiKey && !credentials) return res.status(400).json({ error: 'Volcengine 凭证格式无效，请使用 AK:SK 格式' });
  if (!credentials) return res.status(400).json({ error: '请提供 Volcengine AK/SK' });

  try {
    const { resultData } = await fetchVolcengineTaskResult({ credentials, model, taskId, queryAction });
    const rawStatus = resultData?.data?.status || '';
    const taskStatus = normalizeVolcengineTaskStatus(rawStatus);
    const payload = {
      provider: 'volcengine', taskId, taskStatus, rawStatus,
      requestId: resultData?.request_id || resultData?.ResponseMetadata?.RequestId || '',
      message: resultData?.data?.msg || resultData?.message || '',
    };
    if (taskStatus === 'SUCCEEDED') {
      if (resultType === 'video') {
        payload.videoUrl = extractVolcengineVideoUrl(resultData);
      } else {
        payload.imageUrls = extractVolcengineImageUrls(resultData);
      }
    }
    if (resultType === 'video') {
      saveVideoTaskRecord({
        taskId, provider: 'volcengine', model, status: taskStatus,
        videoUrl: payload.videoUrl, message: payload.message,
      });
    } else {
      saveImageTaskRecord({
        id: taskId, taskId, mode: req.body?.mode || 'text2image',
        provider: 'volcengine', model, status: taskStatus,
        imageUrls: payload.imageUrls, message: payload.message,
      });
    }
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: formatUpstreamError(err.message) });
  }
});

// Agnes 视频任务状态查询
router.post('/agnes-task-status', async (req, res) => {
  const { apiKey, taskId, model } = req.body || {};
  const resolvedApiKey = getApiKey('agnes', apiKey);
  if (!resolvedApiKey) return res.status(400).json({ error: '请提供 Agnes API Key' });
  if (!taskId) return res.status(400).json({ error: '缺少 taskId' });

  try {
    const result = await fetchAgnesVideoResult({ apiKey: resolvedApiKey, taskId });
    const status = result.status === 'completed' ? 'SUCCEEDED'
      : result.status === 'failed' ? 'FAILED'
      : result.status === 'processing' ? 'RUNNING'
      : 'PENDING';
    const payload = {
      provider: 'agnes', taskId, taskStatus: status,
      rawStatus: result.status,
      message: result.error || '',
    };
    if (status === 'SUCCEEDED') {
      payload.videoUrl = result.remixed_from_video_id || result.video_url || '';
    }
    saveVideoTaskRecord({
      taskId, provider: 'agnes', model: model || '', status,
      videoUrl: payload.videoUrl || '', message: payload.message,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
