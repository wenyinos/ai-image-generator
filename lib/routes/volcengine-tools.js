/**
 * 火山引擎新功能路由：视频翻译、图片换装、智能绘图、图像特效
 */
const express = require('express');
const router = express.Router();
const { upload, uploadMotion, handleMulterError } = require('../middleware');
const { parseVolcengineCredentials, submitVolcengineTask, saveUploadedImageAsPublicUrl } = require('../utils');

function parseCredentials(apiKey) {
  const credentials = parseVolcengineCredentials(apiKey);
  if (apiKey && !credentials) throw new Error('Volcengine 凭证格式无效，请使用 AK:SK 格式');
  if (!credentials) throw new Error('请提供 Volcengine AK/SK');
  return credentials;
}

// 视频翻译
router.post('/volcengine-video-translate', express.json(), async (req, res) => {
  try {
    const { apiKey, videoUrl, srcLanguage, targetLanguage } = req.body || {};
    const credentials = parseCredentials(apiKey);
    if (!videoUrl) return res.status(400).json({ error: '请提供视频 URL' });
    if (!srcLanguage) return res.status(400).json({ error: '请选择原始语种' });
    if (!targetLanguage) return res.status(400).json({ error: '请选择目标语种' });

    const { taskId } = await submitVolcengineTask({
      credentials,
      body: {
        req_key: 'video_translate_v2_cvtob',
        video_url: videoUrl,
        src_language: srcLanguage,
        target_language: targetLanguage,
      },
    });
    res.json({ taskId, taskStatus: 'PENDING', provider: 'volcengine', model: 'jimeng-video-translate', queryAction: 'CVSync2AsyncGetResult', resultType: 'video' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 图片换装 (V2: dressing_diffusionV2, CVSubmitTask)
router.post('/volcengine-dressing', express.json(), async (req, res) => {
  try {
    const { apiKey, modelUrl, garmentData } = req.body || {};
    const credentials = parseCredentials(apiKey);
    if (!modelUrl) return res.status(400).json({ error: '请提供模特图 URL' });
    if (!Array.isArray(garmentData) || garmentData.length === 0) {
      return res.status(400).json({ error: '请提供至少一件服装信息' });
    }
    for (const g of garmentData) {
      if (!g.url || !g.type) return res.status(400).json({ error: '服装信息缺少 url 或 type（upper/bottom/full）' });
    }

    const { taskId } = await submitVolcengineTask({
      credentials,
      submitAction: 'CVSubmitTask',
      body: {
        req_key: 'dressing_diffusionV2',
        model: { url: modelUrl },
        garment: { data: garmentData.map(g => ({ type: g.type, url: g.url })) },
      },
    });
    res.json({ taskId, taskStatus: 'PENDING', provider: 'volcengine', model: 'jimeng-dressing', queryAction: 'CVGetResult', resultType: 'image' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 智能绘图（图生图 SeedEdit 3.0）
router.post('/volcengine-seededit', upload.single('image'), handleMulterError, async (req, res) => {
  try {
    const { apiKey, prompt, scale, seed, imageUrl } = req.body || {};
    const credentials = parseCredentials(apiKey);
    if (!prompt) return res.status(400).json({ error: '请提供编辑指令' });

    let finalImageUrl = imageUrl;
    if (req.file) {
      finalImageUrl = await saveUploadedImageAsPublicUrl(req, req.file);
    }
    if (!finalImageUrl) return res.status(400).json({ error: '请上传或提供图片 URL' });

    const body = {
      req_key: 'seededit_v3.0',
      image_urls: [finalImageUrl],
      prompt: prompt.trim(),
    };
    const parsedScale = parseFloat(scale);
    if (!isNaN(parsedScale) && parsedScale >= 0 && parsedScale <= 1) body.scale = parsedScale;
    const parsedSeed = parseInt(seed, 10);
    if (!isNaN(parsedSeed)) body.seed = parsedSeed;

    const { taskId } = await submitVolcengineTask({ credentials, body });
    res.json({ taskId, taskStatus: 'PENDING', provider: 'volcengine', model: 'jimeng-seededit', queryAction: 'CVSync2AsyncGetResult', resultType: 'image' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 图像特效
router.post('/volcengine-effect', upload.single('image'), handleMulterError, async (req, res) => {
  try {
    const { apiKey, templateId, imageUrl, width, height } = req.body || {};
    const credentials = parseCredentials(apiKey);
    if (!templateId) return res.status(400).json({ error: '请选择特效模板' });

    let finalImageUrl = imageUrl;
    if (req.file) {
      finalImageUrl = await saveUploadedImageAsPublicUrl(req, req.file);
    }
    if (!finalImageUrl) return res.status(400).json({ error: '请上传或提供图片 URL' });

    const body = {
      req_key: 'i2i_multi_style_zx2x',
      image_input1: finalImageUrl,
      template_id: templateId,
    };
    const parsedW = parseInt(width, 10);
    const parsedH = parseInt(height, 10);
    if (parsedW >= 512 && parsedW <= 2048) body.width = parsedW;
    if (parsedH >= 512 && parsedH <= 2048) body.height = parsedH;

    const { taskId } = await submitVolcengineTask({ credentials, body });
    res.json({ taskId, taskStatus: 'PENDING', provider: 'volcengine', model: 'jimeng-effect', queryAction: 'CVSync2AsyncGetResult', resultType: 'image' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
