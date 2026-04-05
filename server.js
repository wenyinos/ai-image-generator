require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';

const SYNC_MODELS = new Set([
  'wan2.7-image-pro',
  'wan2.7-image',
  'wan2.6-t2i',
  'qwen-image-2.0-pro',
  'qwen-image-2.0',
]);

const SYNC_ENDPOINT = '/services/aigc/multimodal-generation/generation';
const ASYNC_ENDPOINT = '/services/aigc/text2image/image-synthesis';
const TASK_ENDPOINT = '/tasks/';

const MODEL_CONFIG = {
  'wan2.7-image-pro': { size: '2K', type: 'wan' },
  'wan2.7-image': { size: '2K', type: 'wan' },
  'wan2.6-t2i': { size: '1280*1280', type: 'wan' },
  'wan2.5-t2i-preview': { size: '1280*1280', type: 'wan' },
  'wan2.2-t2i-flash': { size: '1024*1024', type: 'wan' },
  'wan2.2-t2i-plus': { size: '1024*1024', type: 'wan' },
  'wanx2.1-t2i-turbo': { size: '1024*1024', type: 'wan' },
  'wanx2.1-t2i-plus': { size: '1024*1024', type: 'wan' },
  'wanx2.0-t2i-turbo': { size: '1024*1024', type: 'wan' },
  'qwen-image-2.0-pro': { size: '2048*2048', type: 'qwen' },
  'qwen-image-2.0': { size: '2048*2048', type: 'qwen' },
  'qwen-image-max': { size: '1664*928', type: 'qwen' },
  'qwen-image-plus': { size: '1664*928', type: 'qwen' },
  'qwen-image': { size: '1664*928', type: 'qwen' },
  'z-image-turbo': { size: '1024*1024', type: 'wan' },
};

function isSyncModel(model) {
  return SYNC_MODELS.has(model);
}

function getModelConfig(model) {
  return MODEL_CONFIG[model] || { size: '1024*1024', type: 'wan' };
}

function extractImageUrl(data, model) {
  if (isSyncModel(model)) {
    return data.output?.choices?.[0]?.message?.content?.[0]?.image;
  }
  return data.output?.results?.[0]?.url;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/generate-image', async (req, res) => {
  const { prompt, apiKey, model } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required' });
  }

  const selectedModel = model || 'wan2.6-t2i';
  const config = getModelConfig(selectedModel);
  const authHeader = { 'Authorization': `Bearer ${apiKey}` };

  try {
    if (isSyncModel(selectedModel)) {
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
          parameters: {
            size: config.size,
            n: 1,
            prompt_extend: true,
            watermark: false,
          },
        }),
      });

      const syncData = await syncRes.json();

      if (!syncRes.ok) {
        return res.status(syncRes.status).json({ error: syncData.message || syncData });
      }

      const imageUrl = extractImageUrl(syncData, selectedModel);
      if (!imageUrl) {
        return res.status(500).json({ error: 'No image URL in response' });
      }

      return res.json({ imageUrl });
    }

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
        parameters: {
          size: config.size,
          n: 1,
        },
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

    let imageUrl = null;
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
        imageUrl = extractImageUrl(pollData, selectedModel);
        break;
      } else if (status === 'FAILED') {
        return res.status(500).json({ error: pollData.output?.message || 'Task failed' });
      }

      attempts++;
    }

    if (!imageUrl) {
      return res.status(504).json({ error: 'Task timeout' });
    }

    res.json({ imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
