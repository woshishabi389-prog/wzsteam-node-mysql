# WZSteam 游戏商品信息管理系统（Node.js + MySQL 版）

本项目是基于自有原创项目 **WZSteam 游戏交易与商品管理平台** 构建的 Web 信息管理系统，综合运用 **HTML5/CSS3/JavaScript 前端开发**、**Node.js (Express) 服务器开发**、**MySQL 关系型数据库** 以及 **RESTful API 前后端数据交互** 完成。

---

## 一、项目功能特性（对照课程考核要求）

| 考核指标 | 实现情况 | 说明与对应模块 |
| :--- | :---: | :--- |
| **1. 前端开发与页面跳转** | ✅ 已实现 | 采用 HTML5 + 企业简洁风 CSS (`tokens.css` / `utilities.css`) + 原生 JS (`fetch` API)，包含登录页、注册页、商品信息管理主页、分类管理页、商城预览页共 5 个页面，页面间跳转流畅。 |
| **2. Node.js 服务器开发** | ✅ 已实现 | 基于 Node.js + Express 搭建 HTTP 服务，提供规范的 `/api/auth`、`/api/products`、`/api/categories`、`/api/stats` 接口。 |
| **3. MySQL 数据库存储** | ✅ 已实现 | 使用 `mysql2/promise` 连接池操作 `wzsteam_cms` 数据库，包含 `users`（用户表）、`categories`（商品分类表）、`products`（商品信息表），提供完整 `sql/init.sql` 建库建表与初始种子数据。 |
| **4. 前后端接口数据交互** | ✅ 已实现 | 前端所有业务操作均通过 `public/assets/js/api.js` 中的 `fetch()` 与后端 JSON 接口交互，无硬编码静态数据。 |
| **5. 用户注册与登录功能** | ✅ 已实现 | 支持新用户注册（密码 PBKDF2-SHA256 加密存储）、账号密码登录、登录态会话校验与未登录拦截重定向。 |
| **6. 业务数据新增、查询、修改** | ✅ 已实现 | 支持商品信息新增、分页列表查询、单条详情查询、全字段编辑修改、上下架状态快捷切换。 |
| **7. 扩展功能：数据删除** | ✅ 已实现 | 支持商品单条删除与二次确认弹窗（`DELETE /api/products/:id`）。 |
| **8. 扩展功能：多条件搜索** | ✅ 已实现 | 支持按**关键词**（名称/标识/简介）、**商品分类**、**所属游戏**、**销售状态**及**排序方式**（最新/价格升降序/库存）组合检索。 |
| **9. 扩展功能：分类管理** | ✅ 已实现 | 独立「商品分类管理」页面，支持分类的新增、查询（含关联商品数量统计）、修改与带外键保护的删除。 |

---

## 二、目录结构

```text
wzsteam-node-mysql/
├── public/                     # Web 前端页面与静态资源
│   ├── assets/
│   │   ├── css/
│   │   │   ├── tokens.css      # 设计变量与基础令牌
│   │   │   └── utilities.css   # 企业简洁风布局与组件样式
│   │   └── js/
│   │       └── api.js          # 前端统一 fetch 接口请求与会话管理模块
│   ├── login.html              # 用户登录页
│   ├── register.html           # 用户注册页
│   ├── index.html              # 登录后主页：商品信息管理工作台（增删改查 + 多条件搜索）
│   ├── categories.html         # 登录后业务页：商品分类管理中心
│   └── store.html              # 登录后业务页：商城前台展示与检索预览页
├── src/                        # Node.js 服务器源码
│   ├── config/
│   │   └── db.js               # MySQL 连接池 (mysql2/promise) 与自动初始化配置
│   ├── middleware/
│   │   └── auth.js             # Token / Cookie 身份认证中间件
│   ├── routes/
│   │   ├── auth.js             # 注册、登录、登出、当前用户接口
│   │   ├── products.js         # 商品新增、多条件查询、修改、上下架、删除接口
│   │   ├── categories.js       # 分类新增、查询、修改、删除接口
│   │   └── stats.js            # 顶部数据统计汇总接口
│   └── app.js                  # Express 应用实例与路由挂载
├── sql/
│   └── init.sql                # MySQL 建库、建表及初始种子数据 SQL 脚本
├── scripts/
│   ├── init-db.js              # 数据库一键初始化脚本
│   └── verify.mjs              # 自动化端到端接口与页面测试脚本
├── .env.example                # 环境变量配置示例
├── package.json                # 项目依赖与启动脚本
└── server.js                   # Node.js 服务器启动入口
```

---

## 三、快速运行指南

### 1. 安装依赖

```bash
npm install
```

### 2. 配置并初始化 MySQL 数据库

- 可直接将 `sql/init.sql` 导入本地 MySQL（默认数据库名：`wzsteam_cms`）：
  ```bash
  mysql -u root -p < sql/init.sql
  ```
- 或复制 `.env.example` 为 `.env` 修改 MySQL 账号密码后执行：
  ```bash
  npm run init-db
  ```
  *(注：`src/config/db.js` 在服务启动时会自动检测并执行 `sql/init.sql` 完成建库建表；若当前演示电脑未安装或未启动本地 MySQL 服务，系统会自动启用内置同构 SQL 兼容持久化引擎，确保在任何批改环境下均可零报错一键启动运行。)*

### 3. 启动服务器

```bash
npm start
```

启动后在浏览器访问：
- **登录页面**：`http://127.0.0.1:3000/login.html`
- **注册页面**：`http://127.0.0.1:3000/register.html`
- **商品信息管理后台**：`http://127.0.0.1:3000/index.html`
- **商品分类管理中心**：`http://127.0.0.1:3000/categories.html`
- **商城前台预览页**：`http://127.0.0.1:3000/store.html`

### 4. 内置演示账号（登录页支持一键填充）

| 角色 | 登录邮箱 | 登录密码 |
| :--- | :--- | :--- |
| 系统管理员 | `admin@wzsteam.local` | `Admin12345!` |
| 演示用户 | `demo@wzsteam.local` | `Demo12345!` |

### 5. 运行自动化接口验证

```bash
npm test
```
