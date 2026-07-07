/**
 * AI 文生图 - Express 后端服务
 * 代理阿里云百炼 (DashScope) 文生图 API
 *
 * @copyright 2026 wenyinos. All rights reserved.
 * @license MIT
 * @see https://github.com/wenyinos/ai-image-generator
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');

const { PORT, DEBUG, PUBLIC_DIR, UPLOADS_DIR, UPLOAD_FILE_CLEANUP_DELAY_MS } = require('./lib/config');
const { createRateLimiter, isAccessAuthorized, setAccessCookie, clearAccessCookie, checkAccessAuthThrottle, markAccessAuthFailure, clearAccessAuthFailure } = require('./lib/middleware');
const { FRONTEND_ACCESS_CONTROL_ENABLED, FRONTEND_ACCESS_KEY } = require('./lib/config');

const app = express();

// CORS
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

// 安全头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '));
  next();
});

// API 限流
const apiRateLimitWindowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const apiRateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX || '30', 10);
if (Number.isFinite(apiRateLimitWindowMs) && Number.isFinite(apiRateLimitMax) && apiRateLimitWindowMs > 0 && apiRateLimitMax > 0) {
  app.use('/api/', createRateLimiter({ windowMs: apiRateLimitWindowMs, max: apiRateLimitMax }));
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// 访问验证页面
app.get('/unlock', (req, res) => {
  if (!FRONTEND_ACCESS_CONTROL_ENABLED || !FRONTEND_ACCESS_KEY || isAccessAuthorized(req)) {
    return res.redirect('/');
  }
  return res.status(200).send(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>访问验证 - AI 图片生成器</title>
<link rel="icon" href="favicon/favicon.ico" type="image/x-icon">
<link rel="apple-touch-icon" href="favicon/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="favicon/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon/favicon-16x16.png">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
<style>
body{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh}
.main-card{border:none;border-radius:1rem;box-shadow:0 .5rem 1rem rgba(0,0,0,.15)}
</style>
</head>
<body>
<div class="container py-5">
<div class="row justify-content-center align-items-center" style="min-height:80vh">
<div class="col-sm-10 col-md-8 col-lg-6 col-xl-5">
<div class="card main-card">
<div class="card-body p-4 p-md-5">
<form id="unlockForm" autocomplete="on">
<h3 class="fw-bold mb-2"><i class="bi bi-shield-lock"></i> 访问验证</h3>
<p class="text-muted mb-4">请输入前端访问密钥以继续使用</p>
<div class="mb-3">
<label for="accessKeyInput" class="form-label">访问密钥</label>
<div class="input-group">
<input type="password" class="form-control form-control-lg" id="accessKeyInput" name="accessKey" autocomplete="current-password" placeholder="请输入访问密钥" required />
<button class="btn btn-outline-secondary" type="button" id="toggleKeyBtn"><i class="bi bi-eye"></i></button>
</div>
</div>
<div class="alert alert-danger d-none py-2 mb-3" id="errMsg" role="alert"></div>
<div class="d-grid">
<button class="btn btn-primary btn-lg" type="submit" id="submitBtn"><i class="bi bi-box-arrow-in-right"></i> 验证并进入</button>
</div>
</form>
</div>
</div>
</div>
</div>
<footer class="text-center text-white py-4">
<small>&copy; 2026 <a href="https://github.com/wenyinos" target="_blank" class="text-white text-decoration-none">wenyinos</a>. All rights reserved.</small>
</footer>
</div>
<script>
(function(){
const form=document.getElementById('unlockForm');
const input=document.getElementById('accessKeyInput');
const errMsg=document.getElementById('errMsg');
const submitBtn=document.getElementById('submitBtn');
const toggleBtn=document.getElementById('toggleKeyBtn');
var LS_KEY='access_auth_key';
var TTL_MS=72*60*60*1000;
function showError(msg){errMsg.textContent=msg;errMsg.classList.remove('d-none');}
function hideError(){errMsg.textContent='';errMsg.classList.add('d-none');}
function setLoading(loading){submitBtn.disabled=loading;submitBtn.innerHTML=loading?'<span class="spinner-border spinner-border-sm me-2"></span>验证中...':'<i class="bi bi-box-arrow-in-right"></i> 验证并进入';}
function loadSavedKey(){try{var raw=localStorage.getItem(LS_KEY);if(!raw)return'';var obj=JSON.parse(raw);if(!obj||!obj.key||!obj.ts)return'';if(Date.now()-obj.ts>TTL_MS){localStorage.removeItem(LS_KEY);return'';}return obj.key;}catch(e){return'';}}
function saveKey(key){try{localStorage.setItem(LS_KEY,JSON.stringify({key:key,ts:Date.now()}));}catch(e){}}
toggleBtn.addEventListener('click',function(){var isPassword=input.type==='password';input.type=isPassword?'text':'password';this.querySelector('i').className=isPassword?'bi bi-eye-slash':'bi bi-eye';});
var saved=loadSavedKey();
if(saved){input.value=saved;}
form.addEventListener('submit',async function(e){
e.preventDefault();hideError();
var key=(input.value||'').trim();
if(!key){showError('请输入访问密钥');return;}
setLoading(true);
try{
var body=new URLSearchParams();body.set('accessKey',key);
var res=await fetch('/api/access-auth',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
var data=await res.json().catch(function(){return{error:'验证失败'};});
if(!res.ok){showError(data.error||'验证失败');setLoading(false);return;}
saveKey(key);
window.location.href='/';
}catch(err){showError('网络错误，请重试');setLoading(false);}
});
})();
</script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`);
});

// 访问控制 API
app.post('/api/access-auth', (req, res) => {
  if (!FRONTEND_ACCESS_CONTROL_ENABLED || !FRONTEND_ACCESS_KEY) {
    return res.json({ ok: true, enabled: false });
  }
  const throttle = checkAccessAuthThrottle(req);
  if (throttle.blocked) {
    res.setHeader('Retry-After', String(throttle.retryAfterSec));
    return res.status(429).json({ error: `尝试次数过多，请 ${throttle.retryAfterSec} 秒后再试` });
  }
  const input = typeof req.body?.accessKey === 'string' ? req.body.accessKey.trim() : '';
  if (!input || input !== FRONTEND_ACCESS_KEY) {
    const state = markAccessAuthFailure(req);
    const now = Date.now();
    if (state.lockUntil && state.lockUntil > now) {
      const retryAfterSec = Math.ceil((state.lockUntil - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: `尝试次数过多，请 ${retryAfterSec} 秒后再试` });
    }
    return res.status(401).json({ error: '访问密钥错误' });
  }
  clearAccessAuthFailure(req);
  setAccessCookie(res);
  return res.json({ ok: true });
});

app.post('/api/access-logout', (req, res) => {
  clearAccessCookie(res);
  return res.json({ ok: true });
});

// 访问控制中间件
app.use((req, res, next) => {
  if (!FRONTEND_ACCESS_CONTROL_ENABLED || !FRONTEND_ACCESS_KEY) return next();
  if (req.path === '/unlock' || req.path === '/api/access-auth' || req.path === '/api/access-logout') return next();
  if (req.path.startsWith('/uploads/')) return next();
  if (isAccessAuthorized(req)) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: '未授权：需要访问密钥' });
  }
  return res.redirect('/unlock');
});

app.use(express.static(PUBLIC_DIR));

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// 挂载路由
app.use('/api', require('./lib/routes/video'));
app.use('/api', require('./lib/routes/image'));
app.use('/api', require('./lib/routes/task'));
app.use('/api', require('./lib/routes/volcengine-tools'));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.2.0' });
});

// 启动时清理残留上传文件
async function cleanupStaleUploads() {
  try {
    const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true }).catch(() => []);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(UPLOADS_DIR, entry.name);
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > UPLOAD_FILE_CLEANUP_DELAY_MS) {
          await fs.unlink(filePath);
          if (DEBUG) console.log(`🧹 启动清理残留文件: ${filePath}`);
        }
      } catch (e) {
        if (e?.code !== 'ENOENT') console.error(`清理文件失败: ${filePath}`, e);
      }
    }
  } catch (e) {
    // uploads 目录不存在时忽略
  }
}

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await cleanupStaleUploads();
});
