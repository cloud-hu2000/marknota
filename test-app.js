// 简单的测试脚本，验证应用是否能正常启动

const { exec } = require('child_process');
const http = require('http');

console.log('🧪 开始测试共享白板应用...\n');

// 测试后端服务器
function testBackend() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3004', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ 后端服务器运行正常');
          console.log(`   状态: ${response.status}`);
          console.log(`   房间数量: ${Object.keys(response.rooms || {}).length}`);
          resolve(true);
        } catch (e) {
          console.log('❌ 后端响应解析失败');
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      console.log('❌ 后端服务器连接失败');
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log('❌ 后端服务器响应超时');
      req.destroy();
      resolve(false);
    });
  });
}

// 测试前端构建
function testFrontend() {
  return new Promise((resolve) => {
    exec('cd client && npm run build', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ 前端构建失败');
        console.log(stderr);
        resolve(false);
      } else {
        console.log('✅ 前端构建成功');
        resolve(true);
      }
    });
  });
}

// 主测试流程
async function runTests() {
  console.log('📦 测试前端构建...');
  const frontendOk = await testFrontend();

  console.log('\n🌐 测试后端服务器...');
  const backendOk = await testBackend();

  console.log('\n📊 测试结果:');
  console.log(`   前端: ${frontendOk ? '✅' : '❌'}`);
  console.log(`   后端: ${backendOk ? '✅' : '❌'}`);

  if (frontendOk && backendOk) {
    console.log('\n🎉 所有测试通过！应用已准备就绪。');
    console.log('\n🚀 启动说明:');
    console.log('   1. 启动后端: npm run dev:server');
    console.log('   2. 启动前端: npm run dev:client');
    console.log('   3. 打开浏览器访问前端地址');
    console.log('   4. 复制分享链接邀请其他人加入协作');
  } else {
    console.log('\n❌ 部分测试失败，请检查配置和依赖。');
    process.exit(1);
  }
}

runTests();

