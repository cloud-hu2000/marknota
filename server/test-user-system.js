// 测试用户系统
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function testUserSystem() {
  console.log('🧪 开始测试用户系统...\n');

  try {
    // 测试创建用户
    console.log('1. 测试创建用户...');
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword',
        mCoins: 10,
        emailVerificationToken: 'test-token',
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    console.log('✅ 用户创建成功:', testUser.username);

    // 测试M币交易记录
    console.log('\n2. 测试M币交易记录...');
    const transaction = await prisma.coinTransaction.create({
      data: {
        userId: testUser.id,
        type: 'earn',
        amount: 10,
        reason: 'welcome_bonus',
        description: '新用户欢迎奖励',
      },
    });
    console.log('✅ M币交易记录创建成功');

    // 测试每日签到
    console.log('\n3. 测试每日签到...');
    const signIn = await prisma.dailySignIn.create({
      data: {
        userId: testUser.id,
        date: new Date(),
        mCoins: 1,
      },
    });
    console.log('✅ 每日签到记录创建成功');

    // 测试查询用户及其关联数据
    console.log('\n4. 测试查询用户数据...');
    const userWithData = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: {
        dailySignIns: true,
        coinTransactions: true,
      },
    });
    console.log('✅ 用户查询成功，包含关联数据');
    console.log(`   - M币余额: ${userWithData.mCoins}`);
    console.log(`   - 签到次数: ${userWithData.dailySignIns.length}`);
    console.log(`   - 交易记录数: ${userWithData.coinTransactions.length}`);

    // 清理测试数据
    console.log('\n5. 清理测试数据...');
    await prisma.coinTransaction.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.dailySignIn.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    console.log('✅ 测试数据清理完成');

    console.log('\n🎉 用户系统测试完成！所有功能正常。');
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testUserSystem();
