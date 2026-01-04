# MarkNota 部署指南

## 架构说明

MarkNota 是一个包含前后端的协作白板应用：
- **前端**: React + Vite 应用
- **后端**: Node.js + WebSocket 服务器

由于 Vercel 不支持长时间运行的 WebSocket 服务器，我们需要分别部署前后端。

## 部署步骤

### 1. 部署后端服务器 (推荐使用 Render)

1. 注册 [Render](https://render.com) 账户
2. 创建新 **Web Service**
3. 连接你的 GitHub 仓库 (`cloud-hu2000/marknota`)
4. 配置构建设置：
   - **Runtime**: `Node`
   - **Root Directory**: `server` (重要！)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. 部署完成后，复制服务器 URL（类似 `https://your-app.onrender.com`）

### 2. 配置前端环境变量

在 Vercel 控制台中设置环境变量：
```
VITE_SERVER_URL=https://your-server.onrender.com
```

### 3. 部署前端到 Vercel

#### 方法一：使用 Vercel CLI (推荐)

```bash
# 在项目根目录运行 (不要进入 client 目录)
npm install -g vercel

# 登录 Vercel
vercel login

# 部署项目 (会自动检测根目录的 vercel.json)
vercel --prod
```

#### 方法二：通过 GitHub 集成

1. 在 [Vercel](https://vercel.com) 控制台连接你的 GitHub 仓库
2. Vercel 会自动检测项目根目录的 `vercel.json` 配置
3. 设置环境变量 `VITE_SERVER_URL`

#### 重要配置说明

- **Root Directory**: 保持为空（项目根目录）
- **Build Command**: `cd client && npm run build`（在 vercel.json 中配置）
- **Output Directory**: `client/dist`（在 vercel.json 中配置）
- **环境变量**: `VITE_SERVER_URL=https://your-server.onrender.com`

#### 手动配置（如果自动配置失败）

如果 vercel.json 配置仍有问题，在 Vercel 项目设置中手动设置：
- **Root Directory**: （留空）
- **Build Command**: `cd client && npm run build`
- **Output Directory**: `client/dist`

#### 故障排除

**如果遇到权限错误 (Permission denied)**:
- 确保使用最新的代码版本（已实现跨平台权限修复）
- 构建脚本会自动设置必要的执行权限
- 如果仍有问题，确保你的代码是最新的（包含 `fix-permissions.cjs` 文件）

**如果遇到 vercel.json schema 验证错误**:
- 确保使用最新的代码版本（已修复 schema 验证问题）
- 错误如 "functions should NOT have fewer than 1 properties" 已解决

**如果遇到 Rollup 原生依赖错误**:
- 确保使用最新的代码版本（已添加 Rollup 依赖修复脚本）
- 错误如 "Cannot find module @rollup/rollup-linux-x64-gnu" 已解决

**如果遇到 TypeScript 编译错误**:
- 确保使用最新的代码版本（已修复所有类型错误）
- 常见错误包括：
  - `import.meta.env` 类型错误 → 已通过 `vite-env.d.ts` 解决
  - `NodeJS.Timeout` 类型错误 → 已替换为浏览器兼容的 `number` 类型
  - `socket.id` 类型错误 → 已添加 null 检查

### 4. 更新服务器配置（可选）

如果你的服务器运行在不同端口，你可以在 `client/src/config.ts` 中修改默认配置。

## 环境变量说明

### 前端环境变量 (Vercel)
- `VITE_SERVER_URL`: 后端服务器的完整 URL

### 后端环境变量 (Render/Heroku)
- `PORT`: 服务器端口（自动设置）

## 故障排除

### 连接问题
1. 确保后端服务器正在运行
2. 检查防火墙设置允许 WebSocket 连接
3. 验证环境变量配置正确

### 构建问题
1. 确保所有依赖都在 package.json 中列出
2. 检查 Node.js 版本兼容性

## 本地开发

```bash
# 同时启动前后端
npm run dev

# 或者分别启动
npm run dev:client  # 前端开发服务器 (http://localhost:3000)
npm run dev:server  # 后端服务器 (http://localhost:3004)
```
