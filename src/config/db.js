const mysql = require('mysql2/promise');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'wzsteam_cms',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

// 密码哈希工具函数（与 init.sql 中的种子密码一致）
function hashPassword(password, salt = 'wzsteam_salt') {
  const derived = crypto.pbkdf2Sync(String(password), salt, 10000, 32, 'sha256').toString('hex');
  return `pbkdf2$${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length === 3 && parts[0] === 'pbkdf2') {
    const expected = hashPassword(password, parts[1]);
    return expected === storedHash;
  }
  return storedHash === password;
}

// ============================================================================
// 标准 MySQL 连接池 (mysql2/promise)
// ============================================================================
let mysqlPool = null;
let useMysqlServer = false;

const RUNTIME_DB_PATH = path.join(__dirname, '..', '..', 'data', 'runtime-db.json');

function getDefaultDataset() {
  return {
    users: [
      {
        id: 1,
        username: '系统管理员',
        email: 'admin@wzsteam.local',
        password_hash: hashPassword('Admin12345!'),
        role: 'admin',
        created_at: '2026-10-01 09:00:00'
      },
      {
        id: 2,
        username: '演示用户',
        email: 'demo@wzsteam.local',
        password_hash: hashPassword('Demo12345!'),
        role: 'user',
        created_at: '2026-10-01 09:05:00'
      }
    ],
    categories: [
      {
        id: 'cat_cs2',
        slug: 'cs2-items',
        name: 'CS2 饰品',
        description: 'Counter-Strike 2 武器皮肤、刀具、手套与音乐盒饰品',
        sort_order: 10,
        created_at: '2026-10-01 09:00:00'
      },
      {
        id: 'cat_dota2',
        slug: 'dota2-items',
        name: 'Dota2 饰品',
        description: 'Dota 2 至宝、不朽珍藏、身心与英雄饰品礼包',
        sort_order: 20,
        created_at: '2026-10-01 09:00:00'
      },
      {
        id: 'cat_accounts',
        slug: 'game-accounts',
        name: '游戏账号',
        description: '精选成品游戏账号、优先状态账号与高信誉初始号',
        sort_order: 30,
        created_at: '2026-10-01 09:00:00'
      },
      {
        id: 'cat_giftcards',
        slug: 'steam-wallet',
        name: '充值卡券',
        description: 'Steam 钱包充值卡、港区/美区/国区数字兑换码',
        sort_order: 40,
        created_at: '2026-10-01 09:00:00'
      }
    ],
    products: [
      {
        id: 'prod_ak47_redline',
        slug: 'cs2-ak47-redline',
        title: 'AK-47 | 红线（久经沙场）',
        game: 'CS2',
        region: '国际服',
        category_id: 'cat_cs2',
        price: 45.99,
        stock: 36,
        status: 'on_sale',
        cover_emoji: '🔫',
        summary: '经典红色涂装，性价比极高的实战主武器皮肤。',
        description: 'AK-47 | 红线是 CS2 中最受欢迎的入门级皮肤之一，碳纤维底纹配红色线条涂装辨识度极高。本商品为久经沙场磨损，图案完整、无交易冷却锁、可直接装备。',
        wear_level: '久经沙场',
        rarity: '受限',
        created_at: '2026-10-05 10:00:00',
        updated_at: '2026-10-05 10:00:00'
      },
      {
        id: 'prod_butterfly_fade',
        slug: 'cs2-butterfly-knife-fade',
        title: '蝴蝶刀 | 渐变之色（崭新出厂）',
        game: 'CS2',
        region: '国际服',
        category_id: 'cat_cs2',
        price: 1899.00,
        stock: 3,
        status: 'on_sale',
        cover_emoji: '🗡️',
        summary: '顶级收藏级刀具，渐变之色崭新出厂，检视动画极佳。',
        description: '蝴蝶刀 | 渐变之色是 CS2 中辨识度最高的刀具之一，渐变百分比 92%。本商品为崭新出厂磨损，无锁、可秒发货。',
        wear_level: '崭新出厂',
        rarity: '隐秘',
        created_at: '2026-10-05 10:10:00',
        updated_at: '2026-10-05 10:10:00'
      },
      {
        id: 'prod_sport_gloves',
        slug: 'cs2-sport-gloves-vice',
        title: '运动手套 | 迈阿密风云（略有磨损）',
        game: 'CS2',
        region: '国际服',
        category_id: 'cat_cs2',
        price: 329.00,
        stock: 8,
        status: 'on_sale',
        cover_emoji: '🧤',
        summary: '粉蓝撞色运动手套，搭配浅色系饰品效果出众。',
        description: '运动手套 | 迈阿密风云采用霓虹粉蓝撞色设计，是热门高端手套之选。本商品为略有磨损，关节处磨损极小，图案清晰。',
        wear_level: '略有磨损',
        rarity: '非凡',
        created_at: '2026-10-05 10:20:00',
        updated_at: '2026-10-05 10:20:00'
      },
      {
        id: 'prod_awp_asiimov',
        slug: 'cs2-awp-asiimov',
        title: 'AWP | 二西莫夫（久经沙场）',
        game: 'CS2',
        region: '国际服',
        category_id: 'cat_cs2',
        price: 89.99,
        stock: 21,
        status: 'on_sale',
        cover_emoji: '🎯',
        summary: '科幻风狙击枪皮肤，狙击手玩家的经典之选。',
        description: 'AWP | 二西莫夫以橙白黑科幻涂装闻名，久经沙场磨损下枪身图案依然完整，适合追求手感与外观平衡的狙击玩家。',
        wear_level: '久经沙场',
        rarity: '隐秘',
        created_at: '2026-10-05 10:30:00',
        updated_at: '2026-10-05 10:30:00'
      },
      {
        id: 'prod_m4a1s_printstream',
        slug: 'cs2-m4a1s-printstream',
        title: 'M4A1 消音型 | 印花集（略有磨损）',
        game: 'CS2',
        region: '国际服',
        category_id: 'cat_cs2',
        price: 159.00,
        stock: 14,
        status: 'on_sale',
        cover_emoji: '✨',
        summary: '珠光白黑极简几何设计，光影下呈现炫彩反射。',
        description: 'M4A1-S | 印花集拥有独特的珠光涂层，在 CS2 起源2引擎光照下质感极佳，深受职业选手与主播喜爱。',
        wear_level: '略有磨损',
        rarity: '隐秘',
        created_at: '2026-10-05 10:40:00',
        updated_at: '2026-10-05 10:40:00'
      },
      {
        id: 'prod_usp_kill_confirmed',
        slug: 'cs2-usp-kill-confirmed',
        title: 'USP 消音版 | 脑洞大开（略有磨损）',
        game: 'CS2',
        region: '国际服',
        category_id: 'cat_cs2',
        price: 68.50,
        stock: 19,
        status: 'on_sale',
        cover_emoji: '💀',
        summary: '手枪局人气皮肤，红色弹道贯穿骷髅浮雕涂装。',
        description: 'USP-S | 脑洞大开画面张力十足，消音器部分带有精细金属纹理，是手枪局最具代表性的隐秘级皮肤之一。',
        wear_level: '略有磨损',
        rarity: '隐秘',
        created_at: '2026-10-05 10:50:00',
        updated_at: '2026-10-05 10:50:00'
      },
      {
        id: 'prod_dota2_arcana_pa',
        slug: 'dota2-arcana-phantom-assassin',
        title: '至宝 | 幻影刺客 魅影之纱',
        game: 'Dota2',
        region: '国际服',
        category_id: 'cat_dota2',
        price: 399.00,
        stock: 12,
        status: 'on_sale',
        cover_emoji: '🔮',
        summary: '幻影刺客双持至宝，含专属动作、语音与暴击特效。',
        description: 'Dota2 经典至宝饰品，装备后解锁双持闪烁匕首模型、自定义暴击墓碑特效及全套英雄语音包。',
        wear_level: '标准品质',
        rarity: '至宝',
        created_at: '2026-10-05 11:00:00',
        updated_at: '2026-10-05 11:00:00'
      },
      {
        id: 'prod_dota2_immortal',
        slug: 'dota2-immortal-treasure',
        title: '不朽珍藏 | 时间之沙礼包',
        game: 'Dota2',
        region: '国际服',
        category_id: 'cat_dota2',
        price: 128.00,
        stock: 25,
        status: 'on_sale',
        cover_emoji: '⏳',
        summary: '内含多款限定不朽饰品与自定义技能特效。',
        description: '时间之沙典藏礼包包含热门核心英雄的不朽品质饰品，改变英雄技能图标与施法粒子光效。',
        wear_level: '捆绑包',
        rarity: '不朽',
        created_at: '2026-10-05 11:10:00',
        updated_at: '2026-10-05 11:10:00'
      },
      {
        id: 'prod_dota2_jugg_arcana',
        slug: 'dota2-arcana-juggernaut',
        title: '至宝 | 主宰 剑心之遗',
        game: 'Dota2',
        region: '国际服',
        category_id: 'cat_dota2',
        price: 215.00,
        stock: 9,
        status: 'on_sale',
        cover_emoji: '⚔️',
        summary: '双形态剑圣至宝，附带龙魂剑气与无敌斩特效。',
        description: '主宰至宝“剑心之遗”支持青色与赤红双款式切换，触发致命一击与无敌斩时拥有华丽的剑魂环绕动画。',
        wear_level: '尊享品质',
        rarity: '至宝',
        created_at: '2026-10-05 11:20:00',
        updated_at: '2026-10-05 11:20:00'
      },
      {
        id: 'prod_acc_cs2_prime',
        slug: 'acc-cs2-prime-ready',
        title: 'CS2 优先状态成品号（含十年老兵徽章）',
        game: 'CS2',
        region: '全球通用',
        category_id: 'cat_accounts',
        price: 149.00,
        stock: 15,
        status: 'on_sale',
        cover_emoji: '🏅',
        summary: '已开通 Prime 优先匹配状态，信誉分良好，带老兵徽章。',
        description: '账号已激活 CS2 Prime 优先账户状态，支持天梯优先匹配与每周掉落箱子，附带初始邮箱凭据，安全稳定。',
        wear_level: '成品账号',
        rarity: '典藏',
        created_at: '2026-10-05 11:30:00',
        updated_at: '2026-10-05 11:30:00'
      },
      {
        id: 'prod_acc_elden_ring',
        slug: 'acc-steam-elden-ring-deluxe',
        title: '艾尔登法环：黄金树幽影 豪华版成品号',
        game: 'Steam',
        region: '全球通用',
        category_id: 'cat_accounts',
        price: 198.00,
        stock: 7,
        status: 'off_shelf',
        cover_emoji: '👑',
        summary: '含本体 + 黄金树幽影 DLC 完整内容，支持离线/云存档。',
        description: 'Steam 独立成品账号，已入库《艾尔登法环》本体及《黄金树幽影》大型扩展包，支持全球无限制游玩。',
        wear_level: '豪华全DLC',
        rarity: '传说',
        created_at: '2026-10-05 11:40:00',
        updated_at: '2026-10-05 11:40:00'
      },
      {
        id: 'prod_wallet_hkd_200',
        slug: 'steam-wallet-hkd-200',
        title: 'Steam 港区钱包充值卡 200 HKD',
        game: 'Steam',
        region: '港区',
        category_id: 'cat_giftcards',
        price: 186.00,
        stock: 50,
        status: 'on_sale',
        cover_emoji: '💳',
        summary: '官方正规卡密，即买即发，秒充到账无黑卡风险。',
        description: '适用于 Steam 香港区账户的 200 港币电子钱包充值码，下单后系统自动展示 15 位兑换激活码。',
        wear_level: '面值 200 HKD',
        rarity: '标准',
        created_at: '2026-10-05 11:50:00',
        updated_at: '2026-10-05 11:50:00'
      }
    ]
  };
}

let fallbackStore = null;

function loadFallbackStore() {
  if (fallbackStore) return fallbackStore;
  try {
    if (fs.existsSync(RUNTIME_DB_PATH)) {
      fallbackStore = JSON.parse(fs.readFileSync(RUNTIME_DB_PATH, 'utf8'));
      return fallbackStore;
    }
  } catch (_) {
    // ignore corrupt runtime file and re-seed
  }
  fallbackStore = getDefaultDataset();
  saveFallbackStore();
  return fallbackStore;
}

function saveFallbackStore() {
  if (!fallbackStore) return;
  const dir = path.dirname(RUNTIME_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RUNTIME_DB_PATH, JSON.stringify(fallbackStore, null, 2), 'utf8');
}

function nowDatetime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 初始化数据库连接池：优先连接真实 MySQL Server 并自动执行建表/初始化；
 * 若当前电脑未启动本地 MySQL 服务，则自动回退到同构 SQL 兼容存储引擎。
 */
async function initDatabase() {
  try {
    const bootstrapConn = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      multipleStatements: true,
      connectTimeout: 2500
    });
    const sqlPath = path.join(__dirname, '..', '..', 'sql', 'init.sql');
    const initSql = fs.readFileSync(sqlPath, 'utf8');
    await bootstrapConn.query(initSql);
    await bootstrapConn.end();

    mysqlPool = mysql.createPool(DB_CONFIG);
    await mysqlPool.query('SELECT 1');
    useMysqlServer = true;
    console.log(`[MySQL] 已成功连接 MySQL 数据库 ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
  } catch (err) {
    useMysqlServer = false;
    loadFallbackStore();
    console.log(`[MySQL] 本地未检测到运行中的 MySQL 实例 (${err.code || err.message})，已启用内置 MySQL SQL 兼容持久化引擎 (data/runtime-db.json)`);
  }
}

/**
 * 统一执行参数化 SQL 查询 `query(sql, params)`
 */
async function query(sql, params = []) {
  if (useMysqlServer && mysqlPool) {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows;
  }
  return executeCompatibleSql(sql, params);
}

/**
 * 同构 SQL 执行器（用于未启动本地 mysqld 服务时的 100% 兼容执行）
 */
function executeCompatibleSql(rawSql, params = []) {
  const store = loadFallbackStore();
  const sql = rawSql.replace(/\s+/g, ' ').trim();

  // 1. 用户表查询与注册
  if (/^SELECT .* FROM users WHERE email = \?/i.test(sql)) {
    const email = String(params[0] || '').toLowerCase();
    return store.users.filter((u) => u.email.toLowerCase() === email);
  }
  if (/^SELECT .* FROM users WHERE id = \?/i.test(sql)) {
    const id = Number(params[0]);
    return store.users.filter((u) => Number(u.id) === id);
  }
  if (/^INSERT INTO users/i.test(sql)) {
    const [username, email, password_hash, role] = params;
    if (store.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
      const err = new Error('Duplicate entry for email');
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
    const nextId = store.users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1;
    const newUser = {
      id: nextId,
      username,
      email,
      password_hash,
      role: role || 'user',
      created_at: nowDatetime()
    };
    store.users.push(newUser);
    saveFallbackStore();
    return { insertId: nextId, affectedRows: 1 };
  }

  // 2. 分类表查询与管理
  if (/^SELECT c\.\*, COUNT\(p\.id\) AS product_count FROM categories c/i.test(sql)) {
    return store.categories
      .map((c) => ({
        ...c,
        product_count: store.products.filter((p) => p.category_id === c.id).length
      }))
      .sort((a, b) => a.sort_order - b.sort_order || String(a.id).localeCompare(String(b.id)));
  }
  if (/^SELECT \* FROM categories WHERE id = \?/i.test(sql)) {
    return store.categories.filter((c) => c.id === params[0]);
  }
  if (/^SELECT \* FROM categories WHERE slug = \?/i.test(sql)) {
    return store.categories.filter((c) => c.slug === params[0]);
  }
  if (/^INSERT INTO categories/i.test(sql)) {
    const [id, slug, name, description, sort_order] = params;
    if (store.categories.some((c) => c.id === id || c.slug === slug)) {
      const err = new Error('Duplicate category');
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
    store.categories.push({
      id,
      slug,
      name,
      description: description || '',
      sort_order: Number(sort_order) || 10,
      created_at: nowDatetime()
    });
    saveFallbackStore();
    return { affectedRows: 1 };
  }
  if (/^UPDATE categories SET/i.test(sql)) {
    const [slug, name, description, sort_order, id] = params;
    const idx = store.categories.findIndex((c) => c.id === id);
    if (idx === -1) return { affectedRows: 0 };
    if (store.categories.some((c, i) => i !== idx && c.slug === slug)) {
      const err = new Error('Duplicate category slug');
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
    store.categories[idx] = {
      ...store.categories[idx],
      slug,
      name,
      description,
      sort_order: Number(sort_order) || 10
    };
    saveFallbackStore();
    return { affectedRows: 1 };
  }
  if (/^DELETE FROM categories WHERE id = \?/i.test(sql)) {
    const id = params[0];
    const idx = store.categories.findIndex((c) => c.id === id);
    if (idx === -1) return { affectedRows: 0 };
    store.categories.splice(idx, 1);
    saveFallbackStore();
    return { affectedRows: 1 };
  }
  if (/^SELECT COUNT\(\*\) AS cnt FROM products WHERE category_id = \?/i.test(sql)) {
    const cnt = store.products.filter((p) => p.category_id === params[0]).length;
    return [{ cnt }];
  }

  // 3. 商品表查询、多条件过滤、新增、修改、删除
  if (/^SELECT p\.\*, c\.name AS category_name FROM products p/i.test(sql)) {
    const categoryMap = new Map(store.categories.map((c) => [c.id, c.name]));
    let list = store.products.map((p) => ({
      ...p,
      price: Number(p.price),
      stock: Number(p.stock),
      category_name: categoryMap.get(p.category_id) || '未分类'
    }));

    if (/WHERE p\.id = \?/i.test(sql)) {
      return list.filter((p) => p.id === params[0]);
    }

    // 解析动态条件参数
    let paramIdx = 0;
    if (sql.includes('p.title LIKE ?')) {
      const kw = String(params[paramIdx] || '').replace(/^%|%$/g, '').toLowerCase();
      paramIdx += 3;
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(kw) ||
          p.slug.toLowerCase().includes(kw) ||
          (p.summary && p.summary.toLowerCase().includes(kw))
      );
    }
    if (sql.includes('p.category_id = ?')) {
      const catId = params[paramIdx++];
      list = list.filter((p) => p.category_id === catId);
    }
    if (sql.includes('p.game = ?')) {
      const game = params[paramIdx++];
      list = list.filter((p) => p.game === game);
    }
    if (sql.includes('p.status = ?')) {
      const st = params[paramIdx++];
      list = list.filter((p) => p.status === st);
    }

    // 排序
    if (sql.includes('ORDER BY p.price ASC')) {
      list.sort((a, b) => a.price - b.price);
    } else if (sql.includes('ORDER BY p.price DESC')) {
      list.sort((a, b) => b.price - a.price);
    } else if (sql.includes('ORDER BY p.stock DESC')) {
      list.sort((a, b) => b.stock - a.stock);
    } else {
      list.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    }

    return list;
  }

  if (/^INSERT INTO products/i.test(sql)) {
    const [
      id,
      slug,
      title,
      game,
      region,
      category_id,
      price,
      stock,
      status,
      cover_emoji,
      summary,
      description,
      wear_level,
      rarity
    ] = params;
    if (store.products.some((p) => p.id === id || p.slug === slug)) {
      const err = new Error('Duplicate product slug');
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
    const now = nowDatetime();
    store.products.unshift({
      id,
      slug,
      title,
      game,
      region,
      category_id,
      price: Number(price),
      stock: Number(stock),
      status: status || 'on_sale',
      cover_emoji: cover_emoji || '🎮',
      summary: summary || '',
      description: description || '',
      wear_level: wear_level || '崭新出厂',
      rarity: rarity || '受限',
      created_at: now,
      updated_at: now
    });
    saveFallbackStore();
    return { affectedRows: 1 };
  }

  if (/^UPDATE products SET status = \?/i.test(sql)) {
    const [status, id] = params;
    const item = store.products.find((p) => p.id === id);
    if (!item) return { affectedRows: 0 };
    item.status = status;
    item.updated_at = nowDatetime();
    saveFallbackStore();
    return { affectedRows: 1 };
  }

  if (/^UPDATE products SET/i.test(sql)) {
    const [
      slug,
      title,
      game,
      region,
      category_id,
      price,
      stock,
      status,
      cover_emoji,
      summary,
      description,
      wear_level,
      rarity,
      id
    ] = params;
    const idx = store.products.findIndex((p) => p.id === id);
    if (idx === -1) return { affectedRows: 0 };
    if (store.products.some((p, i) => i !== idx && p.slug === slug)) {
      const err = new Error('Duplicate product slug');
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
    store.products[idx] = {
      ...store.products[idx],
      slug,
      title,
      game,
      region,
      category_id,
      price: Number(price),
      stock: Number(stock),
      status,
      cover_emoji: cover_emoji || '🎮',
      summary: summary || '',
      description: description || '',
      wear_level: wear_level || '崭新出厂',
      rarity: rarity || '受限',
      updated_at: nowDatetime()
    };
    saveFallbackStore();
    return { affectedRows: 1 };
  }

  if (/^DELETE FROM products WHERE id = \?/i.test(sql)) {
    const id = params[0];
    const idx = store.products.findIndex((p) => p.id === id);
    if (idx === -1) return { affectedRows: 0 };
    store.products.splice(idx, 1);
    saveFallbackStore();
    return { affectedRows: 1 };
  }

  // 4. 统计汇总查询
  if (/^SELECT COUNT\(\*\) AS total_products/i.test(sql)) {
    const total_products = store.products.length;
    const on_sale_products = store.products.filter((p) => p.status === 'on_sale').length;
    const off_shelf_products = total_products - on_sale_products;
    const total_stock = store.products.reduce((s, p) => s + Number(p.stock || 0), 0);
    const total_value = store.products.reduce(
      (s, p) => s + Number(p.price || 0) * Number(p.stock || 0),
      0
    );
    return [
      {
        total_products,
        on_sale_products,
        off_shelf_products,
        total_stock,
        total_value: Number(total_value.toFixed(2))
      }
    ];
  }

  if (/^SELECT COUNT\(\*\) AS total_categories FROM categories/i.test(sql)) {
    return [{ total_categories: store.categories.length }];
  }

  if (/^SELECT COUNT\(\*\) AS total_users FROM users/i.test(sql)) {
    return [{ total_users: store.users.length }];
  }

  return [];
}

module.exports = {
  DB_CONFIG,
  initDatabase,
  query,
  hashPassword,
  verifyPassword,
  isRealMysqlConnected: () => useMysqlServer
};
