#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要设置执行权限的文件
const binaries = [
  'node_modules/.bin/tsc',
  'node_modules/.bin/vite'
];

// 在 Unix-like 系统上设置执行权限
function setExecutePermission(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const newMode = stats.mode | parseInt('111', 8); // 添加执行权限
    fs.chmodSync(filePath, newMode);
    console.log(`Set execute permission for ${filePath}`);
  } catch (error) {
    // 在 Windows 上忽略权限错误
    if (process.platform !== 'win32') {
      console.warn(`Failed to set permissions for ${filePath}:`, error.message);
    }
  }
}

// 处理所有二进制文件
binaries.forEach(binary => {
  const fullPath = path.resolve(binary);
  if (fs.existsSync(fullPath)) {
    setExecutePermission(fullPath);
  } else {
    console.log(`Binary not found: ${fullPath}`);
  }
});

console.log('Permission fix completed');
