import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { initDatabase } from '../src/config/db.js';

async function runTests() {
  await initDatabase();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Verify] 测试服务器已启动: ${baseUrl}`);

  let token = '';
  let passed = 0;

  async function check(name, fn) {
    await fn();
    passed++;
    console.log(`  ✓ [${passed}] ${name}`);
  }

  try {
    // 1. 页面可访问性检查
    await check('前端页面可访问性 (login / register / index / categories / store)', async () => {
      for (const page of ['/login.html', '/register.html', '/index.html', '/categories.html', '/store.html']) {
        const res = await fetch(baseUrl + page);
        assert.equal(res.status, 200, `${page} 状态码应为 200`);
        const html = await res.text();
        assert.ok(html.includes('WZSteam'), `${page} 应包含系统标题`);
      }
    });

    // 2. 未登录访问受保护接口拦截
    await check('未登录状态拦截校验 (/api/auth/me & POST /api/products)', async () => {
      const meRes = await fetch(`${baseUrl}/api/auth/me`);
      assert.equal(meRes.status, 401);

      const postRes = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test' })
      });
      assert.equal(postRes.status, 401);
    });

    // 3. 用户注册功能验证
    const uniqueEmail = `student_${Date.now()}@wzsteam.local`;
    await check('用户注册功能 (POST /api/auth/register)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '测试学生账号',
          email: uniqueEmail,
          password: 'Password123!'
        })
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.code, 200);
      assert.equal(body.data.user.email, uniqueEmail);
      assert.ok(body.data.token);
    });

    // 4. 用户登录功能验证（使用内置管理员账号）
    await check('用户登录功能 (POST /api/auth/login)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@wzsteam.local',
          password: 'Admin12345!'
        })
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.code, 200);
      assert.equal(body.data.user.email, 'admin@wzsteam.local');
      token = body.data.token;
      assert.ok(token.length > 20);
    });

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };

    // 5. 商品列表查询与多条件搜索
    await check('商品列表查询与多条件组合搜索 (GET /api/products)', async () => {
      const res = await fetch(
        `${baseUrl}/api/products?keyword=AK-47&category_id=cat_cs2&game=CS2&status=on_sale`
      );
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.code, 200);
      assert.ok(body.data.items.length >= 1);
      assert.ok(body.data.items[0].title.includes('AK-47'));
    });

    // 6. 新增商品功能
    let createdProductId = '';
    const testSlug = `cs2-karambit-doppler-${Date.now()}`;
    await check('商品新增功能 (POST /api/products)', async () => {
      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: '爪子刀 | 多普勒（崭新出厂）',
          slug: testSlug,
          category_id: 'cat_cs2',
          game: 'CS2',
          region: '国际服',
          price: 1299.5,
          stock: 5,
          status: 'on_sale',
          cover_emoji: '🗡️',
          wear_level: '崭新出厂',
          rarity: '隐秘',
          summary: 'P2 红宝石质感刀面',
          description: '爪子刀多普勒崭新出厂，支持自动发货。'
        })
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.code, 200);
      createdProductId = body.data.id;
      assert.ok(createdProductId.startsWith('prod_'));
    });

    // 7. 修改商品功能
    await check('商品修改功能 (PUT /api/products/:id & PATCH status)', async () => {
      const putRes = await fetch(`${baseUrl}/api/products/${createdProductId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          title: '爪子刀 | 多普勒（崭新出厂·特惠版）',
          slug: testSlug,
          category_id: 'cat_cs2',
          game: 'CS2',
          region: '国际服',
          price: 1188.0,
          stock: 8,
          status: 'on_sale',
          cover_emoji: '🗡️',
          wear_level: '崭新出厂',
          rarity: '隐秘',
          summary: '特惠调价',
          description: '修改后的商品描述'
        })
      });
      assert.equal(putRes.status, 200);
      const putBody = await putRes.json();
      assert.equal(Number(putBody.data.price), 1188.0);
      assert.equal(Number(putBody.data.stock), 8);

      const patchRes = await fetch(`${baseUrl}/api/products/${createdProductId}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: 'off_shelf' })
      });
      assert.equal(patchRes.status, 200);
    });

    // 8. 删除商品功能
    await check('商品删除功能 (DELETE /api/products/:id)', async () => {
      const delRes = await fetch(`${baseUrl}/api/products/${createdProductId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      assert.equal(delRes.status, 200);

      const getRes = await fetch(`${baseUrl}/api/products/${createdProductId}`);
      assert.equal(getRes.status, 404);
    });

    // 9. 分类管理（新增、修改、删除）
    let createdCatId = '';
    const catSlug = `cs2-stickers-${Date.now()}`;
    await check('分类管理增删改查功能 (/api/categories)', async () => {
      const createRes = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'CS2 战队印花',
          slug: catSlug,
          sort_order: 50,
          description: 'Major 锦标赛全息与金色战队贴纸'
        })
      });
      assert.equal(createRes.status, 201);
      const createBody = await createRes.json();
      createdCatId = createBody.data.id;

      const updateRes = await fetch(`${baseUrl}/api/categories/${createdCatId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'CS2 典藏印花贴纸',
          slug: catSlug,
          sort_order: 45,
          description: '更新后的分类说明'
        })
      });
      assert.equal(updateRes.status, 200);

      const delRes = await fetch(`${baseUrl}/api/categories/${createdCatId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      assert.equal(delRes.status, 200);
    });

    console.log(`\n[Verify] 全部 ${passed} 项核心功能与扩展要求验证通过！`);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('[Verify] 测试失败:', err);
  process.exit(1);
});
