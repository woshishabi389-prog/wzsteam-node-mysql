const express = require('express');
const { query, hashPassword, verifyPassword } = require('../config/db');
const { COOKIE_NAME, signToken, extractUser } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * 用户注册接口
 */
router.post('/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!username || username.length < 2 || username.length > 32) {
      return res.status(400).json({
        code: 400,
        message: '用户名长度需在 2 ~ 32 个字符之间',
        data: null
      });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的邮箱地址',
        data: null
      });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({
        code: 400,
        message: '密码长度不能少于 6 位',
        data: null
      });
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({
        code: 409,
        message: '该邮箱已被注册，请直接登录或更换邮箱',
        data: null
      });
    }

    const passwordHash = hashPassword(password);
    const result = await query(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, 'admin']
    );

    const user = {
      id: result.insertId,
      username,
      email,
      role: 'admin'
    };

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });

    return res.status(201).json({
      code: 200,
      message: '注册成功',
      data: { user, token }
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: '服务器处理注册请求失败：' + err.message,
      data: null
    });
  }
});

/**
 * POST /api/auth/login
 * 用户登录接口
 */
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        code: 400,
        message: '邮箱和密码不能为空',
        data: null
      });
    }

    const rows = await query(
      'SELECT id, username, email, password_hash, role, created_at FROM users WHERE email = ?',
      [email]
    );
    if (rows.length === 0 || !verifyPassword(password, rows[0].password_hash)) {
      return res.status(401).json({
        code: 401,
        message: '邮箱或密码错误，请核对后重试',
        data: null
      });
    }

    const row = rows[0];
    const user = {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role
    };

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });

    return res.json({
      code: 200,
      message: '登录成功',
      data: { user, token }
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: '登录异常：' + err.message,
      data: null
    });
  }
});

/**
 * POST /api/auth/logout
 * 退出登录接口
 */
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  return res.json({
    code: 200,
    message: '已退出登录',
    data: null
  });
});

/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 */
router.get('/me', (req, res) => {
  const user = extractUser(req);
  if (!user) {
    return res.status(401).json({
      code: 401,
      message: '未登录',
      data: null
    });
  }
  return res.json({
    code: 200,
    message: 'ok',
    data: { user }
  });
});

module.exports = router;
