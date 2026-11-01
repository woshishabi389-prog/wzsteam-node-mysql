const express = require('express');
const crypto = require('crypto');
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/products
 * 商品列表查询与多条件组合搜索接口
 * 支持查询参数：
 *   - keyword: 关键词模糊搜索（匹配名称、标识、简介）
 *   - category_id: 按分类ID筛选
 *   - game: 按所属游戏筛选
 *   - status: 按上下架状态筛选 (on_sale | off_shelf)
 *   - sort: 排序方式 (newest | price_asc | price_desc | stock_desc)
 *   - page: 页码（默认 1）
 *   - pageSize: 每页条数（默认 8）
 */
router.get('/', async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    const categoryId = String(req.query.category_id || '').trim();
    const game = String(req.query.game || '').trim();
    const status = String(req.query.status || '').trim();
    const sort = String(req.query.sort || 'newest').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 8));

    const whereClauses = ['1=1'];
    const params = [];

    if (keyword) {
      whereClauses.push('(p.title LIKE ? OR p.slug LIKE ? OR p.summary LIKE ?)');
      const likeKw = `%${keyword}%`;
      params.push(likeKw, likeKw, likeKw);
    }
    if (categoryId) {
      whereClauses.push('p.category_id = ?');
      params.push(categoryId);
    }
    if (game) {
      whereClauses.push('p.game = ?');
      params.push(game);
    }
    if (status === 'on_sale' || status === 'off_shelf') {
      whereClauses.push('p.status = ?');
      params.push(status);
    }

    let orderBy = 'ORDER BY p.updated_at DESC';
    if (sort === 'price_asc') {
      orderBy = 'ORDER BY p.price ASC';
    } else if (sort === 'price_desc') {
      orderBy = 'ORDER BY p.price DESC';
    } else if (sort === 'stock_desc') {
      orderBy = 'ORDER BY p.stock DESC';
    }

    const sql = `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereClauses.join(' AND ')}
      ${orderBy}
    `;

    const allMatched = await query(sql, params);
    const total = allMatched.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;
    const items = allMatched.slice(offset, offset + pageSize);

    return res.json({
      code: 200,
      message: 'ok',
      data: {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        }
      }
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: '查询商品列表失败：' + err.message,
      data: null
    });
  }
});

/**
 * GET /api/products/:id
 * 查询单个商品详情
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const rows = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '未找到对应的商品记录',
        data: null
      });
    }
    return res.json({
      code: 200,
      message: 'ok',
      data: rows[0]
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: '查询商品详情失败：' + err.message,
      data: null
    });
  }
});

/**
 * POST /api/products
 * 新增商品信息（需登录）
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const slug = String(req.body.slug || '')
      .trim()
      .toLowerCase();
    const game = String(req.body.game || 'CS2').trim();
    const region = String(req.body.region || '国际服').trim();
    const category_id = String(req.body.category_id || '').trim();
    const price = Number(req.body.price);
    const stock = parseInt(req.body.stock, 10);
    const status = req.body.status === 'off_shelf' ? 'off_shelf' : 'on_sale';
    const cover_emoji = String(req.body.cover_emoji || '🎮').trim();
    const summary = String(req.body.summary || '').trim();
    const description = String(req.body.description || '').trim();
    const wear_level = String(req.body.wear_level || '崭新出厂').trim();
    const rarity = String(req.body.rarity || '受限').trim();

    if (!title) {
      return res.status(400).json({ code: 400, message: '商品名称不能为空', data: null });
    }
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({
        code: 400,
        message: '商品标识(slug)不能为空，且仅允许小写字母、数字和连字符(-)',
        data: null
      });
    }
    if (!category_id) {
      return res.status(400).json({ code: 400, message: '请选择所属商品分类', data: null });
    }
    if (Number.isNaN(price) || price < 0) {
      return res.status(400).json({ code: 400, message: '商品价格必须为非负数字', data: null });
    }
    if (Number.isNaN(stock) || stock < 0) {
      return res.status(400).json({ code: 400, message: '库存数量必须为非负整数', data: null });
    }

    const id = 'prod_' + crypto.randomBytes(5).toString('hex');
    await query(
      `INSERT INTO products
       (id, slug, title, game, region, category_id, price, stock, status, cover_emoji, summary, description, wear_level, rarity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        slug,
        title,
        game,
        region,
        category_id,
        price.toFixed(2),
        stock,
        status,
        cover_emoji,
        summary || title,
        description || summary || title,
        wear_level,
        rarity
      ]
    );

    const created = await query(
      `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [id]
    );

    return res.status(201).json({
      code: 200,
      message: '商品新增成功',
      data: created[0]
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        code: 409,
        message: '该商品唯一标识 (slug) 已存在，请更换标识',
        data: null
      });
    }
    return res.status(500).json({
      code: 500,
      message: '新增商品失败：' + err.message,
      data: null
    });
  }
});

/**
 * PUT /api/products/:id
 * 修改商品完整信息（需登录）
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const title = String(req.body.title || '').trim();
    const slug = String(req.body.slug || '')
      .trim()
      .toLowerCase();
    const game = String(req.body.game || 'CS2').trim();
    const region = String(req.body.region || '国际服').trim();
    const category_id = String(req.body.category_id || '').trim();
    const price = Number(req.body.price);
    const stock = parseInt(req.body.stock, 10);
    const status = req.body.status === 'off_shelf' ? 'off_shelf' : 'on_sale';
    const cover_emoji = String(req.body.cover_emoji || '🎮').trim();
    const summary = String(req.body.summary || '').trim();
    const description = String(req.body.description || '').trim();
    const wear_level = String(req.body.wear_level || '崭新出厂').trim();
    const rarity = String(req.body.rarity || '受限').trim();

    if (!title || !slug || !category_id) {
      return res.status(400).json({
        code: 400,
        message: '商品名称、唯一标识和所属分类均不能为空',
        data: null
      });
    }
    if (Number.isNaN(price) || price < 0 || Number.isNaN(stock) || stock < 0) {
      return res.status(400).json({
        code: 400,
        message: '价格或库存数值不合法',
        data: null
      });
    }

    const result = await query(
      `UPDATE products SET
         slug = ?, title = ?, game = ?, region = ?, category_id = ?,
         price = ?, stock = ?, status = ?, cover_emoji = ?,
         summary = ?, description = ?, wear_level = ?, rarity = ?
       WHERE id = ?`,
      [
        slug,
        title,
        game,
        region,
        category_id,
        price.toFixed(2),
        stock,
        status,
        cover_emoji,
        summary || title,
        description || summary || title,
        wear_level,
        rarity,
        id
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        code: 404,
        message: '未找到要修改的商品',
        data: null
      });
    }

    const updated = await query(
      `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [id]
    );

    return res.json({
      code: 200,
      message: '商品信息修改成功',
      data: updated[0]
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        code: 409,
        message: '商品标识 (slug) 与其他商品冲突',
        data: null
      });
    }
    return res.status(500).json({
      code: 500,
      message: '修改商品失败：' + err.message,
      data: null
    });
  }
});

/**
 * PATCH /api/products/:id/status
 * 快捷切换商品上下架状态（需登录）
 */
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const status = req.body.status === 'off_shelf' ? 'off_shelf' : 'on_sale';

    const result = await query('UPDATE products SET status = ? WHERE id = ?', [status, id]);
    if (!result.affectedRows) {
      return res.status(404).json({ code: 404, message: '商品不存在', data: null });
    }
    return res.json({
      code: 200,
      message: status === 'on_sale' ? '商品已上架' : '商品已下架',
      data: { id, status }
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: '切换状态失败：' + err.message,
      data: null
    });
  }
});

/**
 * DELETE /api/products/:id
 * 删除商品记录（需登录）
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await query('DELETE FROM products WHERE id = ?', [id]);
    if (!result.affectedRows) {
      return res.status(404).json({
        code: 404,
        message: '要删除的商品不存在',
        data: null
      });
    }
    return res.json({
      code: 200,
      message: '商品已成功删除',
      data: { id }
    });
  } catch (err) {
    return res.status(500).json({
      code: 500,
      message: '删除商品失败：' + err.message,
      data: null
    });
  }
});

module.exports = router;
