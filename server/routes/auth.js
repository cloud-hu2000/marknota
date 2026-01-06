const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../config/email');
const {
  hashPassword,
  comparePassword,
  generateToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  authenticateUser,
} = require('../utils/auth');

const router = express.Router();

// 输入验证中间件
const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/),
  body('password').isLength({ min: 6 }),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').exists(),
];

// 用户注册
router.post('/register', validateRegistration, async (req, res) => {
  console.log('🔍 开始处理注册请求');
  console.log('📧 请求数据:', { email: req.body.email, username: req.body.username, hasPassword: !!req.body.password });

  try {
    // 验证输入
    console.log('✅ 检查输入验证...');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ 输入验证失败:', errors.array());
      return res.status(400).json({
        error: '输入验证失败',
        details: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }
    console.log('✅ 输入验证通过');

    const { email, username, password } = req.body;
    console.log('📝 解析请求数据完成');

    // 检查邮箱是否已被注册
    console.log('🔍 检查邮箱是否已被注册...');
    const existingUserByEmail = await db.findUserByEmail(email);
    console.log('📧 邮箱检查结果:', existingUserByEmail ? '已存在' : '可用');

    if (existingUserByEmail) {
      console.log('❌ 邮箱已被注册');
      return res.status(409).json({
        error: '邮箱已被注册',
        code: 'EMAIL_EXISTS'
      });
    }

    // 检查用户名是否已被使用
    console.log('🔍 检查用户名是否已被使用...');
    const existingUserByUsername = await db.findUserByUsername(username);
    console.log('👤 用户名检查结果:', existingUserByUsername ? '已存在' : '可用');

    if (existingUserByUsername) {
      console.log('❌ 用户名已被使用');
      return res.status(409).json({
        error: '用户名已被使用',
        code: 'USERNAME_EXISTS'
      });
    }

    // 加密密码
    console.log('🔐 开始加密密码...');
    const hashedPassword = await hashPassword(password);
    console.log('✅ 密码加密完成');

    // 生成邮箱验证token
    console.log('🎫 生成邮箱验证token...');
    const emailVerificationToken = generateEmailVerificationToken();
    console.log('✅ Token生成完成');

    // 创建用户
    console.log('👤 开始创建用户...');
    const user = await db.createUser({
      email,
      username,
      password: hashedPassword,
      emailVerificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
      mCoins: 10, // 新用户赠送10M币
    });
    console.log('✅ 用户创建成功:', { id: user.id, email: user.email, username: user.username });

    // 发送验证邮件
    console.log('📧 开始发送验证邮件...');
    try {
      await sendVerificationEmail(email, emailVerificationToken);
      console.log('✅ 验证邮件发送成功');
    } catch (emailError) {
      console.error('❌ 发送验证邮件失败:', emailError);
      // 不阻止注册成功，但记录错误
    }

    // 创建初始M币交易记录
    console.log('💰 创建初始M币交易记录...');
    await db.createCoinTransaction({
      userId: user.id,
      type: 'earn',
      amount: 10,
      reason: 'welcome_bonus',
      description: '新用户欢迎奖励',
    });
    console.log('✅ M币交易记录创建成功');

    // 生成JWT token
    console.log('🎫 生成JWT token...');
    const token = generateToken(user.id);
    console.log('✅ JWT token生成成功');

    console.log('🎉 注册流程完成');
    res.status(201).json({
      message: '注册成功，请检查邮箱进行验证',
      user,
      token,
    });
  } catch (error) {
    console.error('❌ 注册错误:', error);
    console.error('📋 错误详情:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall
    });
    res.status(500).json({
      error: '注册失败，请稍后重试',
      code: 'REGISTRATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 用户登录
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '输入验证失败',
        details: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const { email, password } = req.body;

    // 查找用户
    const user = await db.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        error: '邮箱或密码错误',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 验证密码
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: '邮箱或密码错误',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 生成JWT token
    const token = generateToken(user.id);

    // 返回用户信息（不包含密码）
    const userResponse = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
      mCoins: user.mCoins,
      createdAt: user.createdAt,
    };

    res.json({
      message: '登录成功',
      user: userResponse,
      token,
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      error: '登录失败，请稍后重试',
      code: 'LOGIN_ERROR'
    });
  }
});

// 邮箱验证
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: '缺少验证令牌',
        code: 'TOKEN_MISSING'
      });
    }

    // 查找用户
    const result = await db.pool.query(
      'SELECT * FROM users WHERE "emailVerificationToken" = $1 AND "emailVerificationExpires" > $2',
      [token, new Date()]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({
        error: '验证令牌无效或已过期',
        code: 'INVALID_TOKEN'
      });
    }

    // 更新用户验证状态
    await db.updateUser(user.id, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    res.json({
      message: '邮箱验证成功',
    });
  } catch (error) {
    console.error('邮箱验证错误:', error);
    res.status(500).json({
      error: '验证失败，请稍后重试',
      code: 'VERIFICATION_ERROR'
    });
  }
});

// 请求密码重置
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: '请提供邮箱地址',
        code: 'EMAIL_MISSING'
      });
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // 为了安全，不透露用户是否存在
      return res.json({
        message: '如果邮箱存在，我们已发送重置密码邮件',
      });
    }

    // 生成重置token
    const resetToken = generatePasswordResetToken();

    // 更新用户重置信息
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000), // 1小时后过期
      },
    });

    // 发送重置邮件
    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error('发送重置密码邮件失败:', emailError);
      return res.status(500).json({
        error: '发送重置邮件失败，请稍后重试',
        code: 'EMAIL_SEND_ERROR'
      });
    }

    res.json({
      message: '重置密码邮件已发送，请检查邮箱',
    });
  } catch (error) {
    console.error('忘记密码错误:', error);
    res.status(500).json({
      error: '请求失败，请稍后重试',
      code: 'FORGOT_PASSWORD_ERROR'
    });
  }
});

// 重置密码
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: '缺少必要参数',
        code: 'MISSING_PARAMS'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: '密码长度至少6位',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        error: '重置令牌无效或已过期',
        code: 'INVALID_RESET_TOKEN'
      });
    }

    // 加密新密码
    const hashedPassword = await hashPassword(newPassword);

    // 更新密码并清除重置token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    res.json({
      message: '密码重置成功',
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({
      error: '重置失败，请稍后重试',
      code: 'RESET_PASSWORD_ERROR'
    });
  }
});

// 获取当前用户信息
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const user = await db.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: '用户不存在',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({ user });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      error: '获取用户信息失败',
      code: 'GET_USER_ERROR'
    });
  }
});

module.exports = router;
