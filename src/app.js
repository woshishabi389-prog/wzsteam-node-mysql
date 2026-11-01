const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const statsRoutes = require('./routes/stats');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 挂载后端 RESTful API 路由
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stats', statsRoutes);

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'ok', data: { status: 'healthy', timestamp: Date.now() } });
});

// 托管静态前端页面 (public/)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// 未匹配的 API 路由返回 404 JSON
app.use('/api/*', (req, res) => {
  res.status(404).json({ code: 404, message: `接口不存在: ${req.originalUrl}`, data: null });
});

module.exports = app;
