const express = require('express');
const db = require('../config/database');
const { authenticateUser } = require('../utils/auth');

const router = express.Router();

// 获取用户M币余额和最近交易记录
router.get('/balance', authenticateUser, async (req, res) => {
  try {
    const balance = await db.getCoinBalance(req.user.id);
    const transactions = await db.getCoinTransactions(req.user.id, 10);

    res.json({
      balance,
      transactions,
    });
  } catch (error) {
    console.error('获取M币余额错误:', error);
    res.status(500).json({
      error: '获取余额失败',
      code: 'GET_BALANCE_ERROR'
    });
  }
});

// 每日签到
router.post('/daily-signin', authenticateUser, async (req, res) => {
  try {
    const result = await db.dailySignIn(req.user.id);

    res.json({
      message: '签到成功',
      coinsEarned: result.coinsEarned,
      newBalance: result.updatedUser.mCoins,
      signIn: result.signIn,
    });
  } catch (error) {
    console.error('每日签到错误:', error);
    res.status(500).json({
      error: '签到失败，请稍后重试',
      code: 'SIGN_IN_ERROR'
    });
  }
});

// 获取签到状态
router.get('/sign-in-status', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 检查今天是否已签到
    const todaySignIn = await db.findDailySignIn(userId, today);

    // 获取最近7天的签到记录
    const recentSignIns = await db.getRecentSignIns(userId, 7);

    // 计算连续签到天数
    let consecutiveDays = 0;
    const signInDates = recentSignIns.map(si => si.date.getTime());

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);

      if (signInDates.includes(checkDate.getTime())) {
        consecutiveDays++;
      } else {
        break;
      }
    }

    // 计算明天可能的奖励
    let tomorrowReward = 1;
    if (recentSignIns.length > 0) {
      tomorrowReward = Math.min(recentSignIns[0].mCoins + 1, 7);
    }

    res.json({
      signedInToday: !!todaySignIn,
      consecutiveDays,
      recentSignIns,
      tomorrowReward,
    });
  } catch (error) {
    console.error('获取签到状态错误:', error);
    res.status(500).json({
      error: '获取签到状态失败',
      code: 'GET_SIGN_IN_STATUS_ERROR'
    });
  }
});

// 获取完整交易历史
router.get('/transactions', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          type: true,
          amount: true,
          reason: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.coinTransaction.count({
        where: { userId: req.user.id },
      }),
    ]);

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取交易历史错误:', error);
    res.status(500).json({
      error: '获取交易历史失败',
      code: 'GET_TRANSACTIONS_ERROR'
    });
  }
});

// 消费M币 (用于将来扩展)
router.post('/spend', authenticateUser, async (req, res) => {
  try {
    const { amount, reason, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: '无效的消费金额',
        code: 'INVALID_AMOUNT'
      });
    }

    const result = await db.spendCoins(
      req.user.id,
      amount,
      reason || 'feature_usage',
      description || '使用功能消费'
    );

    res.json({
      message: '消费成功',
      newBalance: result.updatedUser.mCoins,
      transaction: result.transaction,
    });
  } catch (error) {
    console.error('消费M币错误:', error);
    res.status(500).json({
      error: '消费失败，请稍后重试',
      code: 'SPEND_COINS_ERROR'
    });
  }
});

module.exports = router;
