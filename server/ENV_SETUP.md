# 环境变量配置说明

## 问题原因
由于 `.env` 文件被 `.gitignore` 忽略，无法直接在项目中提交和查看。

## 解决方案

### 支持的文件格式
服务器现在支持以下环境变量文件（按优先级顺序）：
1. `.env.local` - 本地开发环境变量（最高优先级）
2. `.env` - 默认环境变量文件

### 1. 创建环境变量文件
在 `server/` 目录下创建 `.env.local` 或 `.env` 文件：

```bash
# Windows
type nul > server\.env.local

# Linux/Mac
touch server/.env.local
```

### 2. 配置环境变量
在环境变量文件中添加以下内容：

```env
# Database Configuration
# 如果使用PostgreSQL，请设置正确的连接字符串
# 如果不设置或设置USE_MOCK_DB=true，将使用内存数据库
DATABASE_URL="postgresql://username:password@localhost:5432/marknota"

# 强制使用内存数据库（可选）
# USE_MOCK_DB=true

# JWT Configuration
JWT_SECRET="your-development-jwt-secret-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# AWS SES Configuration (optional for development)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_SES_FROM_EMAIL=""

# Application Configuration
NODE_ENV="development"
PORT=3004
FRONTEND_URL="http://localhost:3000"
```

### 3. 验证配置
重启服务器后，你应该在控制台看到：
- `[dotenv@17.2.3] injecting env (X) from .env.local` （如果使用 .env.local）
- 或 `[dotenv@17.2.3] injecting env (X) from .env` （如果使用 .env）

### 4. 数据库选项

#### 选项1：使用内存数据库（推荐用于开发）
不设置 `DATABASE_URL` 或设置 `USE_MOCK_DB=true`，系统将自动使用内存数据库。

#### 选项2：使用PostgreSQL
设置正确的 `DATABASE_URL`，例如：
- 本地PostgreSQL：`postgresql://postgres:password@localhost:5432/marknota`
- Neon.tech：`postgresql://username:password@hostname:5432/database_name`
- Supabase：`postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres`

## 数据库连接问题解决

## 问题现象
如果遇到以下错误，说明数据库连接有问题：
```
Connection terminated due to connection timeout
```

## 解决方案

### 选项1：使用内存数据库（推荐用于开发）
在环境变量文件中设置：
```env
USE_MOCK_DB=true
```
或完全不设置 `DATABASE_URL`。

### 选项2：配置PostgreSQL数据库
设置正确的数据库连接：
```env
DATABASE_URL="postgresql://username:password@localhost:5432/marknota"
```

### 选项3：使用云数据库
- **Neon.tech**: `postgresql://username:password@hostname.neon.tech/dbname?sslmode=require`
- **Supabase**: `postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres`
- **Railway**: 自动设置的环境变量

## 连接测试
服务器启动时会显示：
- `✅ 数据库连接测试成功` - PostgreSQL连接正常
- `🔄 使用内存数据库模式` - 使用内存数据库

## 注意事项
- `.env.local` 和 `.env` 文件都不会被提交到Git仓库
- `.env.local` 优先级高于 `.env`，适合存放本地开发环境的敏感信息
- 如果PostgreSQL连接失败，系统会自动切换到内存数据库
- 生产环境请设置强密码和真实的数据库连接
- JWT_SECRET 生产环境必须修改
