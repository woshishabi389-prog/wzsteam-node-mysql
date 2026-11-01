const express = require('express');
const crypto = require('crypto');
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/categories
 * 获取全部商品分类及各分类下的商品数量
 */
router.get('/', async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.*, COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.id ASC
    `);
    return res.json({
      code: 200,
      message: 'ok',
      data: rows
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: '获取分类列表失败：' + err.message,
      data: null
    });
  }
});

/**
 * POST /api/categories
 * 新增商品分类（需登录）
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const slug = String(req.body.slug || '')
      .trim()
      .toLowerCase();
    const description = String(req.body.description || '').trim();
    const sort_order = parseInt(req.body.sort_order, 10) || 10;

    if (!name || !slug) {
      return res.status(400).json({
        code: 400,
        message: '分类名称和分类标识(slug)不能为空',
        data: null
      });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({
        code: 400,
        message: '分类标识仅支持小写字母、数字与连字符(-)',
        data: null
      });
    }

    const id = 'cat_' + crypto.randomBytes(4).toString('hex');
    await query(
      'INSERT INTO categories (id, slug, name, description, sort_order) VALUES (?, ?, ?, ?, ?)',
      [id, slug, name, description, sort_order]
    );

    const created = await query('SELECT * FROM categories WHERE id = ?', [id]);
    return res.status(201).json({
      code: 200,
      message: '商品分类创建成功',
      data: { ...created[0], product_count: 0 }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        code: 409,
        message: '该分类标识 (slug) 已存在',
        data: null
      });
    }
    return res.status(500).json({
      code: 500,
      message: '新增分类失败：' + err.message,
      data: null
    });
  }
});

/**
 * PUT /api/categories/:id
 * 修改商品分类信息（需登录）
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const name = String(req.body.name || '').trim();
    const slug = String(req.body.slug || '')
      .trim()
      .toLowerCase();
    const description = String(req.body.description || '').trim();
    const sort_order = parseInt(req.body.sort_order, 10) || 10;

    if (!name || !slug) {
      return res.status(400).json({
        code: 400,
        message: '分类名称与标识不能为空',
        data: null
      });
    }

    const result = await query(
      'UPDATE categories SET slug = ?, name = ?, description = ?, sort_order = ? WHERE id = ?',
      [slug, name, description, sort_order, id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ code: 404, message: '未找到该分类', data: null });
    }

    const updated = await query('SELECT * FROM categories WHERE id = ?', [id]);
    return res.json({
      code: 200,
      message: '分类修改成功',
      data: updated[0]
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        code: 409,
        message: '分类标识与其他分类重复',
        data: null
      });
    }
    return res.status(500).json({
      code: 500,
      message: '修改分类失败：' + err.message,
      data: null
    });
  }
});

/**
 * DELETE /api/categories/:id
 * 删除商品分类（需登录，含关联商品外键保护检查）
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const countRows = await query('SELECT COUNT(*) AS cnt FROM products WHERE category_id = ?', [id]);
    const cnt = Number(countRows[0]?.cnt || 0);
    if (cnt > 0) {
      return res.status(400).json({
        code: 400,
        message: `该分类下仍有关联的 ${cnt} 件商品，请先转移或删除相关商品后再删除分类`,
        data: null
      });
    }

    const result = await query('DELETE FROM categories WHERE id = ?', [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ code: 404, message: '要删除的分类不存在', data: null });
    }

    return res.json({
      code: 200,
      message: '分类已成功删除',
      data: { id }
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: '删除分类失败：' + err.message,
      data: null
    });
  }
});

module.exports = router;
