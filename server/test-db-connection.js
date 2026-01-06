// 测试数据库连接
const db = require('./config/database');

async function testConnection() {
  console.log('🧪 测试数据库连接...\n');

  try {
    // 测试基本连接
    console.log('1. 测试数据库连接...');
    const client = await db.pool.connect();
    console.log('✅ 数据库连接成功');
    client.release();

    // 测试用户创建
    console.log('\n2. 测试用户创建...');
    const testUser = await db.createUser({
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedpassword',
      emailVerificationToken: 'test-token',
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      mCoins: 10,
    });
    console.log('✅ 用户创建成功:', testUser.username);

    // 测试查询
    console.log('\n3. 测试用户查询...');
    const foundUser = await db.findUserByEmail('test@example.com');
    console.log('✅ 用户查询成功:', foundUser.username);

    // 测试M币交易
    console.log('\n4. 测试M币交易...');
    const transaction = await db.createCoinTransaction({
      userId: testUser.id,
      type: 'earn',
      amount: 10,
      reason: 'welcome_bonus',
      description: '新用户欢迎奖励',
    });
    console.log('✅ M币交易记录创建成功');

    // 清理测试数据
    console.log('\n5. 清理测试数据...');
    await db.pool.query('DELETE FROM coin_transactions WHERE "userId" = $1', [testUser.id]);
    await db.pool.query('DELETE FROM daily_sign_ins WHERE "userId" = $1', [testUser.id]);
    await db.pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    console.log('✅ 测试数据清理完成');

    console.log('\n🎉 数据库连接和基本功能测试完成！所有功能正常。');
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await db.pool.end();
  }
}

// 运行测试
testConnection();
