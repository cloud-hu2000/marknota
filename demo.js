#!/usr/bin/env node

/**
 * 共享白板演示脚本
 * 自动启动应用并打开浏览器
 */

const { exec, spawn } = require('child_process');
const path = require('path');

console.log('🚀 启动共享白板演示...\n');

// 检查是否安装了依赖
function checkDependencies() {
  return new Promise((resolve) => {
    exec('npm list --depth=0', { cwd: path.join(__dirname, 'client') }, (error, stdout) => {
      if (error || !stdout.includes('react@')) {
        console.log('📦 安装前端依赖...');
        exec('npm install', { cwd: path.join(__dirname, 'client') }, () => {
          exec('npm install', { cwd: path.join(__dirname, 'server') }, () => {
            resolve();
          });
        });
      } else {
        resolve();
      }
    });
  });
}

// 启动服务器
async function startDemo() {
  await checkDependencies();

  console.log('🔧 启动后端服务器...');
  const serverProcess = spawn('npm', ['run', 'dev:server'], {
    cwd: __dirname,
    stdio: 'inherit',
    detached: true
  });

  // 等待服务器启动
  setTimeout(() => {
    console.log('🎨 启动前端开发服务器...');
    const clientProcess = spawn('npm', ['run', 'dev:client'], {
      cwd: __dirname,
      stdio: 'inherit',
      detached: true
    });

    // 等待前端启动
    setTimeout(() => {
      console.log('\n✨ 演示已启动！');
      console.log('📱 打开浏览器访问: http://localhost:3002');
      console.log('🔗 复制分享链接邀请其他人加入协作');
      console.log('\n🎯 功能演示:');
      console.log('   1. 点击"上传图片"添加图片到白板');
      console.log('   2. 拖拽图片移动位置');
      console.log('   3. 拖拽角点缩放图片');
      console.log('   4. 拖拽旋转手柄调整角度');
      console.log('   5. 选择图片后按 Delete 键删除');
      console.log('   6. 复制分享链接邀请朋友实时协作');
      console.log('\n🛑 按 Ctrl+C 停止演示');

      // 处理退出
      process.on('SIGINT', () => {
        console.log('\n👋 正在停止演示...');
        try {
          process.kill(-serverProcess.pid);
          process.kill(-clientProcess.pid);
        } catch (e) {
          // 忽略错误
        }
        process.exit(0);
      });

    }, 3000);

  }, 2000);
}

startDemo().catch(console.error);

