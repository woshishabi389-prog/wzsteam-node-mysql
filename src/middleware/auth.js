const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'wzsteam-secret-key-2026';
const COOKIE_NAME = 'wzsteam_token';

/**
 * 生成带 HMAC-SHA256 签名的会话令牌
 */
function signToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role || 'user',
    exp: Date.now() + 7 * 24 * 3600 * 1000
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `${base64Payload}.${signature}`;
}

/**
 * 校验并解析会话令牌
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [base64Payload, signature] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', SECRET)
    .update(base64Payload)
    .digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

/**
 * 提取请求中的登录用户（支持 Cookie 与 Authorization: Bearer 头）
 */
function extractUser(req) {
  let token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    }
  }
  return verifyToken(token);
}

/**
 * 登录鉴权中间件：保护需要登录后才能操作的业务接口
 */
function requireAuth(req, res, next) {
  const user = extractUser(req);
  if (!user) {
    return res.status(401).json({
      code: 401,
      message: '未登录或登录已过期，请先登录系统',
      data: null
    });
  }
  req.user = user;
  next();
}

module.exports = {
  COOKIE_NAME,
  signToken,
  verifyToken,
  extractUser,
  requireAuth
};
