// 简单数据库连接测试
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testSimple() {
  console.log('🧪 简单数据库连接测试');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已设置' : '未设置');

  try {
    console.log('🔌 连接数据库...');
    const client = await pool.connect();
    console.log('✅ 数据库连接成功');

    console.log('📊 执行简单查询...');
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ 查询成功:', result.rows[0]);

    client.release();
    console.log('🎉 数据库测试完成');

  } catch (error) {
    console.error('❌ 数据库测试失败:', error);
    console.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port
    });
  } finally {
    await pool.end();
  }
}

testSimple();
