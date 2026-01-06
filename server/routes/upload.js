const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateUser } = require('../utils/auth');

const router = express.Router();

// 配置multer存储
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/avatars');

    try {
      // 确保目录存在
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 检查文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传 JPG、PNG、GIF 或 WebP 格式的图片'), false);
  }
};

// 配置multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB限制
  }
});

// 头像上传路由
router.post('/avatar', authenticateUser, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: '请选择要上传的头像文件',
        code: 'NO_FILE'
      });
    }

    const userId = req.user.id;
    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    // 获取当前用户，检查是否有旧头像需要删除
    const currentUser = await db.findUserById(userId);

    // 如果有旧头像，删除文件
    if (currentUser && currentUser.avatar && currentUser.avatar.startsWith('/uploads/avatars/')) {
      const oldAvatarPath = path.join(__dirname, '..', currentUser.avatar);
      try {
        await fs.unlink(oldAvatarPath);
        console.log('删除旧头像文件:', oldAvatarPath);
      } catch (error) {
        console.warn('删除旧头像文件失败:', error);
        // 不阻止新头像上传
      }
    }

    // 更新用户头像
    const updatedUser = await db.updateUser(userId, { avatar: avatarPath });

    res.json({
      message: '头像上传成功',
      user: updatedUser,
    });
  } catch (error) {
    console.error('头像上传错误:', error);

    // 如果上传失败，删除已上传的文件
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('清理上传失败的文件时出错:', cleanupError);
      }
    }

    res.status(500).json({
      error: '头像上传失败，请稍后重试',
      code: 'UPLOAD_ERROR'
    });
  }
});

// 删除头像
router.delete('/avatar', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取当前用户头像
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });

    if (!currentUser || !currentUser.avatar) {
      return res.status(404).json({
        error: '用户没有设置头像',
        code: 'NO_AVATAR'
      });
    }

    // 删除头像文件
    if (currentUser.avatar.startsWith('/uploads/avatars/')) {
      const avatarPath = path.join(__dirname, '..', currentUser.avatar);
      try {
        await fs.unlink(avatarPath);
        console.log('删除头像文件:', avatarPath);
      } catch (error) {
        console.warn('删除头像文件失败:', error);
        // 不阻止数据库更新
      }
    }

    // 更新用户头像为空
    const updatedUser = await db.updateUser(userId, { avatar: null });

    res.json({
      message: '头像删除成功',
      user: updatedUser,
    });
  } catch (error) {
    console.error('删除头像错误:', error);
    res.status(500).json({
      error: '头像删除失败，请稍后重试',
      code: 'DELETE_AVATAR_ERROR'
    });
  }
});

// 提供静态文件服务
router.use('/avatars', express.static(path.join(__dirname, '../uploads/avatars')));

module.exports = router;
