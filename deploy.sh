#!/bin/bash

echo "=== MarkNota 部署脚本 ==="
echo ""

# 检查是否提供了服务器URL
if [ -z "$1" ]; then
    echo "用法: $0 <服务器URL>"
    echo "例如: $0 https://your-server.onrender.com"
    echo ""
    echo "请先部署后端服务器，然后使用服务器URL作为参数运行此脚本"
    exit 1
fi

SERVER_URL=$1
echo "将使用服务器: $SERVER_URL"

echo ""
echo "=== 步骤 1: 构建前端应用 ==="
cd client

# 更新服务器URL配置
echo "更新服务器URL配置..."
if [ -f "src/config.ts" ]; then
    sed -i "s|http://localhost:3004|$SERVER_URL|g" src/config.ts
else
    # 创建配置文件
    cat > src/config.ts << EOF
export const SERVER_URL = '$SERVER_URL';
EOF
fi

# 构建应用
echo "构建前端应用..."
npm run build

echo ""
echo "=== 步骤 2: 部署前端到 Vercel ==="
echo "请运行以下命令部署前端:"
echo "cd client && vercel --prod"
echo ""
echo "或者如果你还没有安装 Vercel CLI:"
echo "npm install -g vercel"
echo "cd client && vercel --prod"

echo ""
echo "=== 完成 ==="
echo "1. 确保后端服务器 ($SERVER_URL) 正在运行"
echo "2. 前端已构建完成"
echo "3. 运行上述 vercel 命令完成部署"

