# MarkNota 服务器

## 环境配置

在开始之前，你需要配置以下环境变量：

### 1. 数据库配置 (Neon)
```bash
DATABASE_URL="postgresql://username:password@hostname:5432/database_name"
```

### 2. JWT 配置
```bash
JWT_SECRET="your-jwt-secret-key-here"
JWT_EXPIRES_IN="7d"
```

### 3. AWS SES 配置 (用于邮件发送)
```bash
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key-id"
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
AWS_SES_FROM_EMAIL="noreply@yourdomain.com"
```

### 4. 应用配置
```bash
NODE_ENV="development"
PORT=3004
FRONTEND_URL="http://localhost:3000"
```

## 安装和运行

```bash
# 安装依赖
npm install

# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# 启动服务器
npm run dev
```

## API 文档

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/verify-email` - 邮箱验证
- `GET /api/auth/me` - 获取当前用户信息

### M币相关
- `GET /api/coins/balance` - 获取M币余额和交易记录
- `POST /api/coins/daily-signin` - 每日签到
- `GET /api/coins/sign-in-status` - 获取签到状态

### 文件上传
- `POST /api/upload/avatar` - 上传头像
- `DELETE /api/upload/avatar` - 删除头像

## 数据库模型

### User (用户)
- id: String (主键)
- email: String (唯一)
- username: String (唯一)
- password: String (加密)
- avatar: String (头像URL)
- emailVerified: Boolean
- mCoins: Int (M币余额)
- createdAt/updatedAt: DateTime

### DailySignIn (每日签到)
- id: String
- userId: String (外键)
- date: Date (签到日期)
- mCoins: Int (获得M币)

### CoinTransaction (M币交易)
- id: String
- userId: String (外键)
- type: 'earn' | 'spend'
- amount: Int
- reason: String
- description: String
- createdAt: DateTime

## 部署说明

### 开发环境
```bash
npm run dev
```

### 生产环境
```bash
npm start
```

记得在生产环境中设置正确的环境变量，特别是数据库URL和AWS配置。
