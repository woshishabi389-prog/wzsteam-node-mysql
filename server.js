require('dotenv').config();
const app = require('./src/app');
const { initDatabase } = require('./src/config/db');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

async function bootstrap() {
  await initDatabase();
  app.listen(PORT, HOST, () => {
    console.log('==============================================================');
    console.log(`  WZSteam 游戏商品信息管理系统已启动`);
    console.log(`  访问地址: http://${HOST}:${PORT}`);
    console.log(`  登录页面: http://${HOST}:${PORT}/login.html`);
    console.log(`  注册页面: http://${HOST}:${PORT}/register.html`);
    console.log(`  商品管理: http://${HOST}:${PORT}/index.html`);
    console.log(`  分类管理: http://${HOST}:${PORT}/categories.html`);
    console.log(`  商城预览: http://${HOST}:${PORT}/store.html`);
    console.log('==============================================================');
  });
}

bootstrap();
