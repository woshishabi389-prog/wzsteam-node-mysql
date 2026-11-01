-- ============================================================================
-- WZSteam 游戏商品信息管理系统 - MySQL 数据库初始化脚本
-- 数据库名: wzsteam_cms
-- 字符集: utf8mb4
-- 执行方式: mysql -u root -p < sql/init.sql 或 npm run init-db
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `wzsteam_cms`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `wzsteam_cms`;

-- ----------------------------------------------------------------------------
-- 1. 用户表 (users)：支撑用户注册、登录与身份验证
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户主键ID',
  `username` VARCHAR(64) NOT NULL COMMENT '用户名/昵称',
  `email` VARCHAR(128) NOT NULL COMMENT '登录邮箱（唯一）',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'PBKDF2/SHA256 加密密码哈希',
  `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user' COMMENT '角色：admin-管理员, user-普通用户',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`),
  KEY `idx_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统用户表';

-- ----------------------------------------------------------------------------
-- 2. 商品分类表 (categories)：支撑分类管理扩展功能
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(32) NOT NULL COMMENT '分类编码ID (如 cat_cs2)',
  `slug` VARCHAR(64) NOT NULL COMMENT '分类URL标识（唯一）',
  `name` VARCHAR(64) NOT NULL COMMENT '分类名称',
  `description` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '分类描述说明',
  `sort_order` INT NOT NULL DEFAULT 10 COMMENT '排序权重（越小越靠前）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categories_slug` (`slug`),
  KEY `idx_categories_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏商品分类表';

-- ----------------------------------------------------------------------------
-- 3. 商品信息表 (products)：核心业务数据表（新增、查询、修改、删除、多条件搜索）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(48) NOT NULL COMMENT '商品主键ID',
  `slug` VARCHAR(96) NOT NULL COMMENT '商品唯一标识码',
  `title` VARCHAR(128) NOT NULL COMMENT '商品名称/标题',
  `game` VARCHAR(64) NOT NULL DEFAULT 'CS2' COMMENT '所属游戏 (CS2 / Dota2 / Steam)',
  `region` VARCHAR(64) NOT NULL DEFAULT '国际服' COMMENT '适用区服 (国际服 / 国服 / 全球通用)',
  `category_id` VARCHAR(32) NOT NULL COMMENT '所属分类ID',
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '商品单价（元）',
  `stock` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当前库存数量',
  `status` ENUM('on_sale', 'off_shelf') NOT NULL DEFAULT 'on_sale' COMMENT '状态：on_sale-在售, off_shelf-下架',
  `cover_emoji` VARCHAR(16) NOT NULL DEFAULT '🎮' COMMENT '商品展示图标',
  `summary` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '一句话简介',
  `description` TEXT NOT NULL COMMENT '商品详细描述与发货说明',
  `wear_level` VARCHAR(64) NOT NULL DEFAULT '崭新出厂' COMMENT '饰品磨损/规格属性',
  `rarity` VARCHAR(64) NOT NULL DEFAULT '受限' COMMENT '稀有度/品质等级',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_products_slug` (`slug`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_game_status` (`game`, `status`),
  KEY `idx_products_price` (`price`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏商品信息表';

-- ============================================================================
-- 初始种子数据 (Seed Data)
-- 默认账号：
--   管理员: admin@wzsteam.local / Admin12345!
--   普通用户: demo@wzsteam.local  / Demo12345!
-- ============================================================================

INSERT IGNORE INTO `users` (`id`, `username`, `email`, `password_hash`, `role`, `created_at`) VALUES
(1, '系统管理员', 'admin@wzsteam.local', 'pbkdf2$wzsteam_salt$8b3d17f01c875447f5d2218499890b96e0566b0267f000a557128301577a6e82', 'admin', '2026-10-01 09:00:00'),
(2, '演示用户', 'demo@wzsteam.local', 'pbkdf2$wzsteam_salt$038b7f5d9a15d3932e8a05936910324f274e53839a3e5a8d431a5780910b712a', 'user', '2026-10-01 09:05:00');

INSERT IGNORE INTO `categories` (`id`, `slug`, `name`, `description`, `sort_order`, `created_at`) VALUES
('cat_cs2', 'cs2-items', 'CS2 饰品', 'Counter-Strike 2 武器皮肤、刀具、手套与音乐盒饰品', 10, '2026-10-01 09:00:00'),
('cat_dota2', 'dota2-items', 'Dota2 饰品', 'Dota 2 至宝、不朽珍藏、身心与英雄饰品礼包', 20, '2026-10-01 09:00:00'),
('cat_accounts', 'game-accounts', '游戏账号', '精选成品游戏账号、优先状态账号与高信誉初始号', 30, '2026-10-01 09:00:00'),
('cat_giftcards', 'steam-wallet', '充值卡券', 'Steam 钱包充值卡、港区/美区/国区数字兑换码', 40, '2026-10-01 09:00:00');

INSERT IGNORE INTO `products` (`id`, `slug`, `title`, `game`, `region`, `category_id`, `price`, `stock`, `status`, `cover_emoji`, `summary`, `description`, `wear_level`, `rarity`, `created_at`, `updated_at`) VALUES
('prod_ak47_redline', 'cs2-ak47-redline', 'AK-47 | 红线（久经沙场）', 'CS2', '国际服', 'cat_cs2', 45.99, 36, 'on_sale', '🔫', '经典红色涂装，性价比极高的实战主武器皮肤。', 'AK-47 | 红线是 CS2 中最受欢迎的入门级皮肤之一，碳纤维底纹配红色线条涂装辨识度极高。本商品为久经沙场磨损，图案完整、无交易冷却锁、可直接装备。', '久经沙场', '受限', '2026-10-05 10:00:00', '2026-10-05 10:00:00'),
('prod_butterfly_fade', 'cs2-butterfly-knife-fade', '蝴蝶刀 | 渐变之色（崭新出厂）', 'CS2', '国际服', 'cat_cs2', 1899.00, 3, 'on_sale', '🗡️', '顶级收藏级刀具，渐变之色崭新出厂，检视动画极佳。', '蝴蝶刀 | 渐变之色是 CS2 中辨识度最高的刀具之一，渐变百分比 92%。本商品为崭新出厂磨损，无锁、可秒发货。', '崭新出厂', '隐秘', '2026-10-05 10:10:00', '2026-10-05 10:10:00'),
('prod_sport_gloves', 'cs2-sport-gloves-vice', '运动手套 | 迈阿密风云（略有磨损）', 'CS2', '国际服', 'cat_cs2', 329.00, 8, 'on_sale', '🧤', '粉蓝撞色运动手套，搭配浅色系饰品效果出众。', '运动手套 | 迈阿密风云采用霓虹粉蓝撞色设计，是热门高端手套之选。本商品为略有磨损，关节处磨损极小，图案清晰。', '略有磨损', '非凡', '2026-10-05 10:20:00', '2026-10-05 10:20:00'),
('prod_awp_asiimov', 'cs2-awp-asiimov', 'AWP | 二西莫夫（久经沙场）', 'CS2', '国际服', 'cat_cs2', 89.99, 21, 'on_sale', '🎯', '科幻风狙击枪皮肤，狙击手玩家的经典之选。', 'AWP | 二西莫夫以橙白黑科幻涂装闻名，久经沙场磨损下枪身图案依然完整，适合追求手感与外观平衡的狙击玩家。', '久经沙场', '隐秘', '2026-10-05 10:30:00', '2026-10-05 10:30:00'),
('prod_m4a1s_printstream', 'cs2-m4a1s-printstream', 'M4A1 消音型 | 印花集（略有磨损）', 'CS2', '国际服', 'cat_cs2', 159.00, 14, 'on_sale', '✨', '珠光白黑极简几何设计，光影下呈现炫彩反射。', 'M4A1-S | 印花集拥有独特的珠光涂层，在 CS2 起源2引擎光照下质感极佳，深受职业选手与主播喜爱。', '略有磨损', '隐秘', '2026-10-05 10:40:00', '2026-10-05 10:40:00'),
('prod_usp_kill_confirmed', 'cs2-usp-kill-confirmed', 'USP 消音版 | 脑洞大开（略有磨损）', 'CS2', '国际服', 'cat_cs2', 68.50, 19, 'on_sale', '💀', '手枪局人气皮肤，红色弹道贯穿骷髅浮雕涂装。', 'USP-S | 脑洞大开画面张力十足，消音器部分带有精细金属纹理，是手枪局最具代表性的隐秘级皮肤之一。', '略有磨损', '隐秘', '2026-10-05 10:50:00', '2026-10-05 10:50:00'),
('prod_dota2_arcana_pa', 'dota2-arcana-phantom-assassin', '至宝 | 幻影刺客 魅影之纱', 'Dota2', '国际服', 'cat_dota2', 399.00, 12, 'on_sale', '🔮', '幻影刺客双持至宝，含专属动作、语音与暴击特效。', 'Dota2 经典至宝饰品，装备后解锁双持闪烁匕首模型、自定义暴击墓碑特效及全套英雄语音包。', '标准品质', '至宝', '2026-10-05 11:00:00', '2026-10-05 11:00:00'),
('prod_dota2_immortal', 'dota2-immortal-treasure', '不朽珍藏 | 时间之沙礼包', 'Dota2', '国际服', 'cat_dota2', 128.00, 25, 'on_sale', '⏳', '内含多款限定不朽饰品与自定义技能特效。', '时间之沙典藏礼包包含热门核心英雄的不朽品质饰品，改变英雄技能图标与施法粒子光效。', '捆绑包', '不朽', '2026-10-05 11:10:00', '2026-10-05 11:10:00'),
('prod_dota2_jugg_arcana', 'dota2-arcana-juggernaut', '至宝 | 主宰 剑心之遗', 'Dota2', '国际服', 'cat_dota2', 215.00, 9, 'on_sale', '⚔️', '双形态剑圣至宝，附带龙魂剑气与无敌斩特效。', '主宰至宝“剑心之遗”支持青色与赤红双款式切换，触发致命一击与无敌斩时拥有华丽的剑魂环绕动画。', '尊享品质', '至宝', '2026-10-05 11:20:00', '2026-10-05 11:20:00'),
('prod_acc_cs2_prime', 'acc-cs2-prime-ready', 'CS2 优先状态成品号（含十年老兵徽章）', 'CS2', '全球通用', 'cat_accounts', 149.00, 15, 'on_sale', '🏅', '已开通 Prime 优先匹配状态，信誉分良好，带老兵徽章。', '账号已激活 CS2 Prime 优先账户状态，支持天梯优先匹配与每周掉落箱子，附带初始邮箱凭据，安全稳定。', '成品账号', '典藏', '2026-10-05 11:30:00', '2026-10-05 11:30:00'),
('prod_acc_elden_ring', 'acc-steam-elden-ring-deluxe', '艾尔登法环：黄金树幽影 豪华版成品号', 'Steam', '全球通用', 'cat_accounts', 198.00, 7, 'off_shelf', '👑', '含本体 + 黄金树幽影 DLC 完整内容，支持离线/云存档。', 'Steam 独立成品账号，已入库《艾尔登法环》本体及《黄金树幽影》大型扩展包，支持全球无限制游玩。', '豪华全DLC', '传说', '2026-10-05 11:40:00', '2026-10-05 11:40:00'),
('prod_wallet_hkd_200', 'steam-wallet-hkd-200', 'Steam 港区钱包充值卡 200 HKD', 'Steam', '港区', 'cat_giftcards', 186.00, 50, 'on_sale', '💳', '官方正规卡密，即买即发，秒充到账无黑卡风险。', '适用于 Steam 香港区账户的 200 港币电子钱包充值码，下单后系统自动展示 15 位兑换激活码。', '面值 200 HKD', '标准', '2026-10-05 11:50:00', '2026-10-05 11:50:00');
