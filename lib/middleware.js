/**
 * Express 中间件、访问控制、限流
 */

const crypto = require('crypto');
const multer = require('multer');
const {
  UPLOAD_FILE_MAX_SIZE,
  MOTION_FILE_MAX_SIZE,
  FRONTEND_ACCESS_CONTROL_ENABLED,
  FRONTEND_ACCESS_KEY,
  ACCESS_COOKIE_NAME,
  ACCESS_COOKIE_SECRET_PATH,
  ACCESS_AUTH_WINDOW_MS,
  ACCESS_AUTH_MAX_ATTEMPTS,
  ACCESS_AUTH_LOCK_MS,
  UPLOADS_RELATIVE_DIR,
} = require('./config');
const { getClientIp } = require('./utils');

// ---- ACCESS_COOKIE_SECRET 初始化 ----
const fsSync = require('fs');
const path = require('path');

const ACCESS_COOKIE_SECRET = (() => {
  const envSecret = typeof process.env.ACCESS_COOKIE_SECRET === 'string' ? process.env.ACCESS_COOKIE_SECRET.trim() : '';
  if (envSecret) return envSecret;
  try {
    fsSync.mkdirSync(path.dirname(ACCESS_COOKIE_SECRET_PATH), { recursive: true });
    if (fsSync.existsSync(ACCESS_COOKIE_SECRET_PATH)) {
      const savedSecret = fsSync.readFileSync(ACCESS_COOKIE_SECRET_PATH, 'utf8').trim();
      if (savedSecret) return savedSecret;
    }
    const generatedSecret = crypto.randomBytes(32).toString('hex');
    fsSync.writeFileSync(ACCESS_COOKIE_SECRET_PATH, `${generatedSecret}\n`, { mode: 0o600 });
    return generatedSecret;
  } catch (err) {
    console.error(`⚠️ 无法保存 ACCESS_COOKIE_SECRET 到 ${ACCESS_COOKIE_SECRET_PATH}: ${err.message}`);
    process.exit(1);
  }
})();

// ---- multer 配置 ----

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_FILE_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'), false);
    }
  },
});

const uploadMotion = multer({
  storage,
  limits: { fileSize: MOTION_FILE_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片和视频文件'), false);
    }
  },
});

function handleMulterError(err, req, res, next) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '图片文件过大，最大支持 10MB' });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `文件上传错误: ${err.message}` });
  }
  next(err);
}

// ---- 限流 ----

function createRateLimiter({ windowMs, max, keyGenerator }) {
  const hits = new Map();
  const getKey = typeof keyGenerator === 'function' ? keyGenerator : (req) => getClientIp(req);
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs * 2);
  if (typeof cleanupInterval.unref === 'function') cleanupInterval.unref();

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
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }
    return next();
  };
}

// ---- 访问控制 ----

function parseCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader || typeof cookieHeader !== 'string') return {};
  return cookieHeader.split(';').reduce((acc, item) => {
    const [rawKey, ...rest] = item.split('=');
    const key = rawKey ? rawKey.trim() : '';
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=').trim());
    return acc;
  }, {});
}

function buildAccessCookieValue() {
  return crypto
    .createHmac('sha256', ACCESS_COOKIE_SECRET)
    .update(`frontend-access:${FRONTEND_ACCESS_KEY}`)
    .digest('hex');
}

function isAccessAuthorized(req) {
  if (!FRONTEND_ACCESS_CONTROL_ENABLED) return true;
  if (!FRONTEND_ACCESS_KEY) return true;
  const cookies = parseCookies(req);
  return cookies[ACCESS_COOKIE_NAME] === buildAccessCookieValue();
}

function setAccessCookie(res) {
  const maxAge = 7 * 24 * 60 * 60;
  const secureAttr = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${ACCESS_COOKIE_NAME}=${buildAccessCookieValue()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureAttr}`);
}

function clearAccessCookie(res) {
  const secureAttr = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${ACCESS_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureAttr}`);
}

const accessAuthHits = new Map();
const accessAuthCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of accessAuthHits) {
    if (entry.lockUntil <= now && entry.resetAt <= now) accessAuthHits.delete(key);
  }
}, ACCESS_AUTH_WINDOW_MS * 2);
if (typeof accessAuthCleanupInterval.unref === 'function') accessAuthCleanupInterval.unref();

function checkAccessAuthThrottle(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const current = accessAuthHits.get(ip);
  if (!current) {
    const initial = { count: 0, resetAt: now + ACCESS_AUTH_WINDOW_MS, lockUntil: 0 };
    accessAuthHits.set(ip, initial);
    return { blocked: false, state: initial };
  }
  if (current.lockUntil && current.lockUntil > now) {
    return { blocked: true, retryAfterSec: Math.ceil((current.lockUntil - now) / 1000), state: current };
  }
  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + ACCESS_AUTH_WINDOW_MS;
    current.lockUntil = 0;
  }
  return { blocked: false, state: current };
}

function markAccessAuthFailure(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const current = accessAuthHits.get(ip) || { count: 0, resetAt: now + ACCESS_AUTH_WINDOW_MS, lockUntil: 0 };
  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + ACCESS_AUTH_WINDOW_MS;
    current.lockUntil = 0;
  }
  current.count += 1;
  if (current.count >= ACCESS_AUTH_MAX_ATTEMPTS) {
    current.lockUntil = now + ACCESS_AUTH_LOCK_MS;
    current.count = 0;
    current.resetAt = now + ACCESS_AUTH_WINDOW_MS;
  }
  accessAuthHits.set(ip, current);
  return current;
}

function clearAccessAuthFailure(req) {
  const ip = getClientIp(req);
  accessAuthHits.delete(ip);
}

module.exports = {
  upload,
  uploadMotion,
  handleMulterError,
  createRateLimiter,
  isAccessAuthorized,
  setAccessCookie,
  clearAccessCookie,
  checkAccessAuthThrottle,
  markAccessAuthFailure,
  clearAccessAuthFailure,
};
