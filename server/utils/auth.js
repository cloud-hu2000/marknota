const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// 密码加密
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// 密码验证
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// 生成JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'default-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// 验证JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
  } catch (error) {
    return null;
  }
};

// 生成邮箱验证token
const generateEmailVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// 生成重置密码token
const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// 从请求头获取token
const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

// 中间件：验证用户登录状态
const authenticateUser = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        error: '未提供访问令牌',
        code: 'TOKEN_MISSING'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: '无效的访问令牌',
        code: 'TOKEN_INVALID'
      });
    }

    // 将用户信息添加到请求对象中
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    res.status(500).json({
      error: '认证服务错误',
      code: 'AUTH_ERROR'
    });
  }
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  getTokenFromHeader,
  authenticateUser,
};
