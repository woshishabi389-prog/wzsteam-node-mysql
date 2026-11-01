const { initDatabase, isRealMysqlConnected, DB_CONFIG } = require('../src/config/db');

(async () => {
  await initDatabase();
  if (isRealMysqlConnected()) {
    console.log(`[init-db] 数据库 ${DB_CONFIG.database} 表结构与初始种子数据已同步完成！`);
  } else {
    console.log('[init-db] 已生成本地初始化数据文件 data/runtime-db.json，可直接执行 npm start 启动系统。');
  }
  process.exit(0);
})();
