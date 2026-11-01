const express = require('express');
const { query, isRealMysqlConnected } = require('../config/db');

const router = express.Router();

/**
 * GET /api/stats
 * 获取系统业务数据统计概览
 */
router.get('/', async (req, res) => {
  try {
    const prodStats = await query(`
      SELECT
        COUNT(*) AS total_products,
        SUM(CASE WHEN status = 'on_sale' THEN 1 ELSE 0 END) AS on_sale_products,
        SUM(CASE WHEN status = 'off_shelf' THEN 1 ELSE 0 END) AS off_shelf_products,
        COALESCE(SUM(stock), 0) AS total_stock,
        COALESCE(ROUND(SUM(price * stock), 2), 0) AS total_value
      FROM products
    `);
    const catStats = await query('SELECT COUNT(*) AS total_categories FROM categories');
    const userStats = await query('SELECT COUNT(*) AS total_users FROM users');

    return res.json({
      code: 200,
      message: 'ok',
      data: {
        total_products: Number(prodStats[0]?.total_products || 0),
        on_sale_products: Number(prodStats[0]?.on_sale_products || 0),
        off_shelf_products: Number(prodStats[0]?.off_shelf_products || 0),
        total_stock: Number(prodStats[0]?.total_stock || 0),
        total_value: Number(prodStats[0]?.total_value || 0),
        total_categories: Number(catStats[0]?.total_categories || 0),
        total_users: Number(userStats[0]?.total_users || 0),
        db_engine: isRealMysqlConnected() ? 'MySQL 8.x (mysql2/promise Pool)' : 'MySQL SQL Engine (mysql2 Compatible)'
      }
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: '获取统计数据失败：' + err.message,
      data: null
    });
  }
});

module.exports = router;
