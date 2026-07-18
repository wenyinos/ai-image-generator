/**
 * 火山引擎新功能路由：视频翻译、图片换装、智能绘图、图像特效、人像融合、智能变美、图像修复
 */
const express = require('express');
const router = express.Router();
const { upload, uploadMotion, handleMulterError } = require('../middleware');
const { parseVolcengineCredentials, submitVolcengineTask, callVolcengineSync, saveUploadedImageAsPublicUrl, extractVolcengineImageUrls } = require('../utils');

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
router.post('/volcengine-dressing', upload.array('images', 2), handleMulterError, async (req, res) => {
  try {
    const { apiKey, garmentType } = req.body || {};
    const credentials = parseCredentials(apiKey);

    const files = req.files || [];
    if (files.length < 2) return res.status(400).json({ error: '请上传模特图和服装图' });

    const modelMeta = await saveUploadedImageAsPublicUrl(req, files[0]);
    const garmentMeta = await saveUploadedImageAsPublicUrl(req, files[1]);

    const { taskId } = await submitVolcengineTask({
      credentials,
      submitAction: 'CVSubmitTask',
      body: {
        req_key: 'dressing_diffusionV2',
        model: { url: modelMeta.publicUrl },
        garment: { data: [{ type: garmentType || 'full', url: garmentMeta.publicUrl }] },
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
      const meta = await saveUploadedImageAsPublicUrl(req, req.file);
      finalImageUrl = meta.publicUrl;
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
      const meta = await saveUploadedImageAsPublicUrl(req, req.file);
      finalImageUrl = meta.publicUrl;
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

// 人像融合（同步）
router.post('/volcengine-faceswap', upload.array('images', 4), handleMulterError, async (req, res) => {
  try {
    const { apiKey, model, faceType, sourceSimilarity, imageUrls } = req.body || {};
    const credentials = parseCredentials(apiKey);
    const reqKey = model === 'jimeng-faceswap-ai' ? 'faceswap_ai' : 'face_swap3_6';

    let urls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const meta = await saveUploadedImageAsPublicUrl(req, file);
        urls.push(meta.publicUrl);
      }
    } else if (imageUrls) {
      urls = Array.isArray(imageUrls) ? imageUrls : JSON.parse(imageUrls);
    }
    if (urls.length < 2) return res.status(400).json({ error: '请上传至少2张图片（素材图 + 模板图）' });

    const body = { req_key: reqKey, image_urls: urls, return_url: true };
    if (faceType) body.face_type = faceType;
    if (sourceSimilarity !== undefined) body.source_similarity = String(sourceSimilarity);

    const data = await callVolcengineSync({ credentials, body });
    const resultUrls = data?.data?.image_urls || [];
    res.json({ imageUrls: resultUrls, provider: 'volcengine', model: reqKey === 'faceswap_ai' ? 'jimeng-faceswap-ai' : 'jimeng-faceswap' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 智能变美（同步）
router.post('/volcengine-facepretty', upload.single('image'), handleMulterError, async (req, res) => {
  try {
    const { apiKey, beautyLevel, multiFace, imageUrl } = req.body || {};
    const credentials = parseCredentials(apiKey);

    let imageBase64 = '';
    let finalImageUrl = imageUrl;
    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
    }
    if (!imageBase64 && !finalImageUrl) return res.status(400).json({ error: '请上传或提供图片 URL' });

    const body = {
      req_key: 'face_pretty',
      beauty_level: parseFloat(beautyLevel) || 1.0,
    };
    if (imageBase64) {
      body.image_base64 = imageBase64;
    } else {
      body.image_url = finalImageUrl;
    }
    if (multiFace === '1' || multiFace === true) body.multi_face = '1';

    const data = await callVolcengineSync({ credentials, body, action: 'FacePretty', version: '2020-08-26' });
    const resultBase64 = data?.data?.image || '';
    if (!resultBase64) return res.status(500).json({ error: '未返回处理结果' });
    res.json({ imageData: resultBase64, provider: 'volcengine', model: 'jimeng-facepretty' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 图像修复与增强（同步）
router.post('/volcengine-restoration', upload.single('image'), handleMulterError, async (req, res) => {
  try {
    const { apiKey, model, imageUrl, resolutionBoundary, enableHdr, enableWb, hdrStrength } = req.body || {};
    const credentials = parseCredentials(apiKey);
    const reqKey = model === 'jimeng-nnsr2' ? 'lens_nnsr2_pic_common' : 'lens_lqir';

    let finalImageUrl = imageUrl;
    if (req.file) {
      const meta = await saveUploadedImageAsPublicUrl(req, req.file);
      finalImageUrl = meta.publicUrl;
    }
    if (!finalImageUrl) return res.status(400).json({ error: '请上传或提供图片 URL' });

    const body = {
      req_key: reqKey,
      image_urls: [finalImageUrl],
      return_url: true,
    };
    if (reqKey === 'lens_lqir') {
      if (resolutionBoundary) body.resolution_boundary = resolutionBoundary;
      if (enableHdr !== undefined) body.enable_hdr = enableHdr === 'true' || enableHdr === true;
      if (enableWb !== undefined) body.enable_wb = enableWb === 'true' || enableWb === true;
      if (hdrStrength !== undefined) body.hdr_strength = parseFloat(hdrStrength);
    }
    if (reqKey === 'lens_nnsr2_pic_common') {
      const mq = req.body?.modelQuality || 'MQ';
      body.model_quality = mq;
    }

    const data = await callVolcengineSync({ credentials, body });
    const resultUrls = data?.data?.image_urls || [];
    res.json({ imageUrls: resultUrls, provider: 'volcengine', model: reqKey === 'lens_nnsr2_pic_common' ? 'jimeng-nnsr2' : 'jimeng-lqir' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
