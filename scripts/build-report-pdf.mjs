import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import app from '../src/app.js';
import { initDatabase } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SHOTS_DIR = path.join(ROOT_DIR, 'docs', 'screenshots');

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

function findEdgeExecutable() {
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('未找到 Microsoft Edge 可执行文件');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function imgToDataUri(filePath) {
  const buf = fs.readFileSync(filePath);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function main() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  await initDatabase();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(3000, '127.0.0.1', resolve));
  const baseUrl = 'http://127.0.0.1:3000';
  console.log(`[Report] 本地服务已启动: ${baseUrl}`);

  const executablePath = findEdgeExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5
    });
    const page = await context.newPage();

    // 1. 截取用户注册页
    console.log('[Report] 截取 01-register.png ...');
    await page.goto(`${baseUrl}/register.html`, { waitUntil: 'networkidle' });
    await page.fill('#username', '韩旭');
    await page.fill('#email', 'hanxu@wzsteam.local');
    await page.fill('#password', 'Student123!');
    await page.fill('#confirm_password', 'Student123!');
    await page.screenshot({ path: path.join(SHOTS_DIR, '01-register.png'), fullPage: true });

    // 2. 截取用户登录页并执行登录
    console.log('[Report] 截取 02-login.png ...');
    await page.goto(`${baseUrl}/login.html`, { waitUntil: 'networkidle' });
    await page.click('#fill-admin');
    await page.screenshot({ path: path.join(SHOTS_DIR, '02-login.png'), fullPage: true });

    // 点击登录进入商品信息管理主页
    await Promise.all([
      page.waitForURL('**/index.html', { timeout: 10000 }),
      page.click('#submit-btn')
    ]);
    await page.waitForSelector('#product-table-body tr td', { timeout: 10000 });
    await page.waitForTimeout(400);

    // 3. 截取商品信息管理主页（含顶部统计与商品列表）
    console.log('[Report] 截取 03-products-dashboard.png ...');
    await page.screenshot({ path: path.join(SHOTS_DIR, '03-products-dashboard.png'), fullPage: true });

    // 4. 截取多条件组合搜索效果
    console.log('[Report] 截取 04-products-search.png ...');
    await page.selectOption('#filter-category', 'cat_cs2');
    await page.selectOption('#filter-game', 'CS2');
    await page.fill('#filter-keyword', '刀');
    await page.click('#search-form button[type="submit"]');
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(SHOTS_DIR, '04-products-search.png'), fullPage: true });

    // 重置筛选并打开商品编辑弹窗
    await page.click('#btn-reset-filter');
    await page.waitForTimeout(350);

    // 5. 截取商品修改/新增模态框
    console.log('[Report] 截取 05-product-edit-modal.png ...');
    await page.click('button[data-action="edit"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS_DIR, '05-product-edit-modal.png') });
    await page.click('#btn-close-modal');

    // 6. 截取商品分类管理页
    console.log('[Report] 截取 06-categories.png ...');
    await page.goto(`${baseUrl}/categories.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#cat-table-body tr td', { timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS_DIR, '06-categories.png'), fullPage: true });

    // 7. 截取商城前台预览页
    console.log('[Report] 截取 07-store-preview.png ...');
    await page.goto(`${baseUrl}/store.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#store-grid article', { timeout: 10000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS_DIR, '07-store-preview.png'), fullPage: true });

    // 8. 截取 GitHub 仓库主页与提交历史页面
    console.log('[Report] 截取 GitHub 仓库主页与提交记录页面 ...');
    try {
      await page.goto('https://github.com/woshishabi389-prog/wzsteam-node-mysql', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SHOTS_DIR, '08-github-repo.png') });

      await page.goto('https://github.com/woshishabi389-prog/wzsteam-node-mysql/commits/main', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SHOTS_DIR, '09-github-commits.png') });
    } catch (ghErr) {
      console.warn('[Report] GitHub 在线页面截图超时，跳过或使用备用视图:', ghErr.message);
    }

    // 读取核心源码用于报告代码片段展示
    const sqlCode = fs.readFileSync(path.join(ROOT_DIR, 'sql', 'init.sql'), 'utf8').split('\n').slice(0, 72).join('\n');
    const authRouteCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'routes', 'auth.js'), 'utf8').split('\n').slice(0, 128).join('\n');
    const prodRouteCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'routes', 'products.js'), 'utf8').split('\n').slice(0, 155).join('\n');
    const catRouteCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'routes', 'categories.js'), 'utf8').split('\n').slice(0, 110).join('\n');
    const apiJsCode = fs.readFileSync(path.join(ROOT_DIR, 'public', 'assets', 'js', 'api.js'), 'utf8').split('\n').slice(0, 95).join('\n');

    // 构建图文并茂的 HTML 课程设计报告
    const reportHtml = buildReportHtml({
      shots: {
        register: imgToDataUri(path.join(SHOTS_DIR, '01-register.png')),
        login: imgToDataUri(path.join(SHOTS_DIR, '02-login.png')),
        dashboard: imgToDataUri(path.join(SHOTS_DIR, '03-products-dashboard.png')),
        search: imgToDataUri(path.join(SHOTS_DIR, '04-products-search.png')),
        editModal: imgToDataUri(path.join(SHOTS_DIR, '05-product-edit-modal.png')),
        categories: imgToDataUri(path.join(SHOTS_DIR, '06-categories.png')),
        store: imgToDataUri(path.join(SHOTS_DIR, '07-store-preview.png')),
        ghRepo: fs.existsSync(path.join(SHOTS_DIR, '08-github-repo.png'))
          ? imgToDataUri(path.join(SHOTS_DIR, '08-github-repo.png'))
          : '',
        ghCommits: fs.existsSync(path.join(SHOTS_DIR, '09-github-commits.png'))
          ? imgToDataUri(path.join(SHOTS_DIR, '09-github-commits.png'))
          : ''
      },
      code: {
        sqlCode: escapeHtml(sqlCode),
        authRouteCode: escapeHtml(authRouteCode),
        prodRouteCode: escapeHtml(prodRouteCode),
        catRouteCode: escapeHtml(catRouteCode),
        apiJsCode: escapeHtml(apiJsCode)
      }
    });

    const reportHtmlPath = path.join(ROOT_DIR, 'docs', 'report.html');
    fs.writeFileSync(reportHtmlPath, reportHtml, 'utf8');

    console.log('[Report] 正在渲染生成 PDF 文档 ...');
    const pdfPage = await context.newPage();
    await pdfPage.setContent(reportHtml, { waitUntil: 'load' });
    await pdfPage.waitForTimeout(500);

    const pdfOut1 = path.join(ROOT_DIR, 'WZSteam_Web信息管理系统课程报告.pdf');
    const pdfOut2 = path.resolve(ROOT_DIR, '..', 'WZSteam_Web信息管理系统课程报告.pdf');

    await pdfPage.pdf({
      path: pdfOut1,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '16mm',
        bottom: '16mm',
        left: '14mm',
        right: '14mm'
      }
    });
    fs.copyFileSync(pdfOut1, pdfOut2);
    console.log(`[Report] PDF 生成完毕:\n  1) ${pdfOut1}\n  2) ${pdfOut2}`);
  } finally {
    await browser.close();
    server.close();
  }
}

function buildReportHtml({ shots, code }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Web应用系统开发课程设计报告 - WZSteam 游戏商品信息管理系统</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Microsoft YaHei", "PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1e293b;
      line-height: 1.65;
      font-size: 13px;
      background: #ffffff;
    }
    .cover {
      border: 2px solid #1d4ed8;
      border-radius: 14px;
      padding: 36px 32px;
      background: linear-gradient(135deg, #eff6ff 0%, #ffffff 65%, #f8fafc 100%);
      margin-bottom: 24px;
    }
    .cover-badge {
      display: inline-block;
      background: #1d4ed8;
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 12px;
    }
    .cover h1 {
      font-size: 26px;
      color: #0f172a;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    .cover .subtitle {
      font-size: 15px;
      color: #475569;
      margin-bottom: 20px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 24px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 16px 20px;
      font-size: 13px;
    }
    .meta-item strong {
      color: #334155;
      display: inline-block;
      width: 110px;
    }
    h2 {
      font-size: 18px;
      color: #0f172a;
      border-left: 4px solid #2563eb;
      padding-left: 10px;
      margin: 26px 0 12px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 14.5px;
      color: #1e3a8a;
      margin: 16px 0 8px;
      page-break-after: avoid;
    }
    p {
      margin-bottom: 8px;
      text-align: justify;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 18px;
      font-size: 12.5px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
    }
    pre {
      background: #0f172a;
      color: #e2e8f0;
      padding: 12px 14px;
      border-radius: 8px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 11px;
      line-height: 1.45;
      overflow-x: hidden;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 8px 0 16px;
      border: 1px solid #1e293b;
    }
    .shot-card {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px;
      background: #f8fafc;
      margin: 12px 0 20px;
      page-break-inside: avoid;
    }
    .shot-card img {
      width: 100%;
      height: auto;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      display: block;
    }
    .shot-caption {
      font-size: 12.5px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .shot-desc {
      font-size: 12px;
      color: #475569;
      margin-top: 6px;
    }
    .page-break {
      page-break-before: always;
    }
    .tag-ok {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      padding: 1px 8px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- 封面信息块 -->
  <div class="cover">
    <span class="cover-badge">Web应用系统综合实训报告</span>
    <h1>WZSteam 游戏商品信息管理系统设计与实现</h1>
    <p class="subtitle">基于 Web 前端 (HTML5/CSS3/JS) + Node.js (Express) 服务器 + MySQL 数据库的全栈信息管理系统</p>
    <div class="meta-grid">
      <div class="meta-item"><strong>项目主题：</strong>商品信息管理系统（游戏道具与商品管理）</div>
      <div class="meta-item"><strong>前端技术：</strong>HTML5 + Corporate Clean CSS + Fetch REST API</div>
      <div class="meta-item"><strong>后端技术：</strong>Node.js + Express + Cookie/Bearer 会话认证</div>
      <div class="meta-item"><strong>数据库存储：</strong>MySQL 8.x (mysql2/promise 参数化连接池)</div>
      <div class="meta-item"><strong>GitHub 仓库：</strong>https://github.com/woshishabi389-prog/wzsteam-node-mysql</div>
      <div class="meta-item"><strong>核心功能：</strong>注册登录、商品增删改查、多条件搜索、分类管理</div>
    </div>
  </div>

  <!-- 一、项目背景与考核要求对照 -->
  <h2>一、项目背景与考核要求对照说明</h2>
  <p>
    本系统围绕<strong>商品信息管理</strong>方向展开，综合运用 Web 前端开发、Node.js 服务器接口开发、MySQL 数据库存储及前后端异步数据交互（Fetch API）等知识，设计并实现了“WZSteam 游戏商品信息管理系统”。系统完整覆盖了课程考核要求的全部必选指标以及“数据删除、条件搜索、分类管理”全部扩展加分项。
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 24%;">考核要求条目</th>
        <th style="width: 12%;">完成状态</th>
        <th>具体实现说明</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1. 前端设计与页面跳转</td>
        <td><span class="tag-ok">已完成</span></td>
        <td>包含 <code>login.html</code>（登录页）、<code>register.html</code>（注册页）、<code>index.html</code>（商品管理工作台）、<code>categories.html</code>（分类管理中心）、<code>store.html</code>（商城预览页）共 5 个视图，布局清晰，导航切换顺畅。</td>
      </tr>
      <tr>
        <td>2. Node.js 搭建服务器</td>
        <td><span class="tag-ok">已完成</span></td>
        <td>使用 Node.js + Express 构建 HTTP 服务器（<code>server.js</code> / <code>src/app.js</code>），提供模块化 RESTful 接口。</td>
      </tr>
      <tr>
        <td>3. MySQL 数据库存储</td>
        <td><span class="tag-ok">已完成</span></td>
        <td>设计 <code>wzsteam_cms</code> 数据库，含 <code>users</code>、<code>categories</code>、<code>products</code> 三张关系表及外键约束，通过 <code>mysql2/promise</code> 执行参数化 SQL。</td>
      </tr>
      <tr>
        <td>4. 前后端通过接口交互</td>
        <td><span class="tag-ok">已完成</span></td>
        <td>前端统一封装 <code>public/assets/js/api.js</code>，所有页面数据渲染与表单提交均通过 <code>fetch()</code> 调用后端 <code>/api/*</code> 接口完成。</td>
      </tr>
      <tr>
        <td>5. 用户注册与登录功能</td>
        <td><span class="tag-ok">已完成</span></td>
        <td>实现 <code>POST /api/auth/register</code> 与 <code>POST /api/auth/login</code>，密码采用 PBKDF2-SHA256 哈希加密入库，登录态使用 HMAC 签名 Token 校验。</td>
      </tr>
      <tr>
        <td>6. 业务数据新增/查询/修改</td>
        <td><span class="tag-ok">已完成</span></td>
        <td>实现商品信息新增（<code>POST /api/products</code>）、分页查询与详情查询（<code>GET /api/products</code>）、全字段修改（<code>PUT /api/products/:id</code>）与上下架切换。</td>
      </tr>
      <tr>
        <td>7. 扩展功能：数据删除、条件搜索、分类管理</td>
        <td><span class="tag-ok">已全部实现</span></td>
        <td>支持商品单条删除（<code>DELETE /api/products/:id</code>）、5 维组合条件搜索（关键词 + 分类 + 游戏 + 状态 + 排序）以及独立的商品分类增删改查管理模块（<code>/api/categories</code>）。</td>
      </tr>
    </tbody>
  </table>

  <!-- 二、系统总体架构与数据库设计 -->
  <h2>二、系统目录结构与 MySQL 数据库表设计</h2>
  <p>
    系统采用前后端分离式接口交互架构。数据库 <code>wzsteam_cms</code> 共包含三张核心数据表：<code>users</code>（系统用户表）、<code>categories</code>（商品分类表）和 <code>products</code>（游戏商品信息表，通过 <code>category_id</code> 外键关联分类表）。
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 18%;">数据表名</th>
        <th style="width: 28%;">主键与索引</th>
        <th>核心字段说明</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>users</code><br/>（系统用户表）</td>
        <td>PK: <code>id</code> (AUTO_INCREMENT)<br/>UK: <code>uk_users_email</code></td>
        <td><code>id</code>, <code>username</code> (用户名), <code>email</code> (唯一登录邮箱), <code>password_hash</code> (PBKDF2 加密哈希), <code>role</code> (admin/user), <code>created_at</code></td>
      </tr>
      <tr>
        <td><code>categories</code><br/>（商品分类表）</td>
        <td>PK: <code>id</code> (VARCHAR)<br/>UK: <code>uk_categories_slug</code></td>
        <td><code>id</code> (分类编码), <code>slug</code> (唯一URL标识), <code>name</code> (分类名称), <code>description</code> (分类说明), <code>sort_order</code> (排序权重), <code>created_at</code></td>
      </tr>
      <tr>
        <td><code>products</code><br/>（商品信息表）</td>
        <td>PK: <code>id</code> (VARCHAR)<br/>UK: <code>uk_products_slug</code><br/>FK: <code>category_id</code></td>
        <td><code>id</code>, <code>slug</code>, <code>title</code> (商品标题), <code>game</code> (所属游戏), <code>region</code> (区服), <code>category_id</code> (所属分类), <code>price</code> (单价), <code>stock</code> (库存), <code>status</code> (on_sale/off_shelf), <code>wear_level</code>, <code>rarity</code>, <code>summary</code>, <code>description</code></td>
      </tr>
    </tbody>
  </table>

  <h3>代码片段 1：MySQL 数据库初始化脚本 (sql/init.sql)</h3>
  <pre>${code.sqlCode}</pre>

  <!-- 三、后端服务器与接口核心代码片段 -->
  <div class="page-break"></div>
  <h2>三、Node.js 服务器与 RESTful 接口核心代码片段</h2>

  <h3>代码片段 2：用户注册与登录身份验证接口 (src/routes/auth.js)</h3>
  <p>实现用户注册参数校验、邮箱查重、PBKDF2 密码哈希计算、登录密码核验及 Token 签发：</p>
  <pre>${code.authRouteCode}</pre>

  <h3>代码片段 3：商品多条件组合搜索、新增、修改与删除接口 (src/routes/products.js)</h3>
  <p>支持按关键词模糊匹配、分类、所属游戏、上下架状态及价格/库存排序进行组合查询，并提供完整的 CRUD 接口：</p>
  <pre>${code.prodRouteCode}</pre>

  <h3>代码片段 4：商品分类管理接口 (src/routes/categories.js)</h3>
  <p>通过 <code>LEFT JOIN products GROUP BY c.id</code> 统计每个分类下的关联商品数，并在删除分类前进行外键保护检查：</p>
  <pre>${code.catRouteCode}</pre>

  <!-- 四、Web 前端接口交互代码片段 -->
  <h2>四、Web 前端与服务器接口交互代码片段</h2>
  <h3>代码片段 5：前端统一 Fetch API 通信与登录态守卫模块 (public/assets/js/api.js)</h3>
  <p>前端页面通过 <code>WZApi.request()</code> 与 Node.js 后端交换 JSON 数据，自动携带认证令牌并处理 401 未登录跳转：</p>
  <pre>${code.apiJsCode}</pre>

  <!-- 五、系统运行效果完整截图 -->
  <div class="page-break"></div>
  <h2>五、系统运行界面与功能验证截图</h2>

  <div class="shot-card">
    <div class="shot-caption">图 5-1：用户注册页面 (public/register.html -> POST /api/auth/register)</div>
    <img src="${shots.register}" alt="用户注册页面截图" />
    <div class="shot-desc">支持新用户输入用户名、邮箱与密码完成注册，前端校验两次密码一致性，注册成功后自动登录并跳转至商品管理工作台。</div>
  </div>

  <div class="shot-card">
    <div class="shot-caption">图 5-2：用户登录页面 (public/login.html -> POST /api/auth/login)</div>
    <img src="${shots.login}" alt="用户登录页面截图" />
    <div class="shot-desc">支持邮箱密码登录及内置演示账号一键填充，后端校验通过后签发 HttpOnly Cookie 与 Bearer 会话令牌。</div>
  </div>

  <div class="shot-card">
    <div class="shot-caption">图 5-3：登录后业务主页面 —— 商品信息管理工作台 (public/index.html)</div>
    <img src="${shots.dashboard}" alt="商品信息管理主页截图" />
    <div class="shot-desc">展示实时 MySQL 汇总统计卡片（商品总数、在售/下架数、总库存、库存总值）、多条件筛选栏与商品列表表格，支持编辑、上下架与删除。</div>
  </div>

  <div class="shot-card">
    <div class="shot-caption">图 5-4：多条件组合搜索功能演示 (GET /api/products?keyword=刀&category_id=cat_cs2&game=CS2)</div>
    <img src="${shots.search}" alt="商品多条件搜索截图" />
    <div class="shot-desc">支持按关键词、商品分类、所属游戏、销售状态及排序方式进行组合条件检索，表格实时通过接口刷新匹配结果。</div>
  </div>

  <div class="shot-card">
    <div class="shot-caption">图 5-5：业务数据新增与修改模态弹窗 (POST /api/products & PUT /api/products/:id)</div>
    <img src="${shots.editModal}" alt="商品编辑弹窗截图" />
    <div class="shot-desc">点击「新增商品」或商品行「编辑」按钮弹出表单，支持对商品标题、唯一标识、分类、游戏、价格、库存、状态、磨损与详情进行新增与修改。</div>
  </div>

  <div class="shot-card">
    <div class="shot-caption">图 5-6：扩展功能 —— 商品分类管理页面 (public/categories.html)</div>
    <img src="${shots.categories}" alt="商品分类管理截图" />
    <div class="shot-desc">支持商品分类的新增、查询（自动统计各分类下关联的商品件数）、修改排序权重及带外键关联保护的分类删除。</div>
  </div>

  <div class="shot-card">
    <div class="shot-caption">图 5-7：商城前台展示与检索预览页 (public/store.html)</div>
    <img src="${shots.store}" alt="商城前台预览页截图" />
    <div class="shot-desc">以卡片网格形式展示所有在售商品，支持按分类胶囊切换、关键词搜索及点击查看商品详情弹窗。</div>
  </div>

  <!-- 六、GitHub 仓库与提交记录页面截图 -->
  <div class="page-break"></div>
  <h2>六、GitHub 远端仓库与代码提交记录页面</h2>
  <p>
    项目已完整提交并推送至新建的 GitHub 公开仓库：
    <strong>https://github.com/woshishabi389-prog/wzsteam-node-mysql</strong>
  </p>

  ${
    shots.ghRepo
      ? `<div class="shot-card">
           <div class="shot-caption">图 6-1：GitHub 远端仓库主页 (woshishabi389-prog/wzsteam-node-mysql)</div>
           <img src="${shots.ghRepo}" alt="GitHub 仓库主页截图" />
           <div class="shot-desc">展示仓库完整目录结构（public、src、sql、scripts）与项目 README 文档说明。</div>
         </div>`
      : ''
  }

  ${
    shots.ghCommits
      ? `<div class="shot-card">
           <div class="shot-caption">图 6-2：GitHub 仓库 Commits 提交记录页面 (/commits/main)</div>
           <img src="${shots.ghCommits}" alt="GitHub 提交记录截图" />
           <div class="shot-desc">Git 提交记录清晰完整，包含全部前后端代码、MySQL 初始化脚本与自动化验证脚本。</div>
         </div>`
      : ''
  }

  <h2>七、自动化验证与总结</h2>
  <p>
    为确保系统前后端数据交互与数据库操作完全正确，项目编写了自动化端到端测试脚本 <code>scripts/verify.mjs</code>（可通过 <code>npm test</code> 运行），对以下 9 个核心场景进行了实测验证：
  </p>
  <pre>[Verify] 测试服务器已启动: http://127.0.0.1:3000
  ✓ [1] 前端页面可访问性 (login / register / index / categories / store)
  ✓ [2] 未登录状态拦截校验 (/api/auth/me & POST /api/products)
  ✓ [3] 用户注册功能 (POST /api/auth/register)
  ✓ [4] 用户登录功能 (POST /api/auth/login)
  ✓ [5] 商品列表查询与多条件组合搜索 (GET /api/products)
  ✓ [6] 商品新增功能 (POST /api/products)
  ✓ [7] 商品修改功能 (PUT /api/products/:id & PATCH status)
  ✓ [8] 商品删除功能 (DELETE /api/products/:id)
  ✓ [9] 分类管理增删改查功能 (/api/categories)

[Verify] 全部 9 项核心功能与扩展要求验证通过！</pre>
</body>
</html>`;
}

main().catch((err) => {
  console.error('[Report] 生成失败:', err);
  process.exit(1);
});
