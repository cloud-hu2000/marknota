// 测试持久化功能的脚本
const roomManager = require('./rooms');

async function testPersistence() {
  console.log('开始测试持久化功能...');

  // 创建一个测试房间
  const roomId = 'test-room-123';
  console.log(`创建房间: ${roomId}`);

  // 添加一些测试元素
  const testElements = [
    {
      id: 'test-element-1',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==',
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 },
      rotation: 0,
      zIndex: 1,
      createdAt: Date.now()
    },
    {
      id: 'test-element-2',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==',
      position: { x: 300, y: 200 },
      size: { width: 150, height: 100 },
      rotation: 45,
      zIndex: 2,
      createdAt: Date.now()
    }
  ];

  // 更新房间状态
  await roomManager.updateRoomState(roomId, {
    elements: testElements,
    selectedElementId: null
  });

  console.log('房间状态已更新');

  // 添加一些操作
  await Promise.all([
    roomManager.addOperation(roomId, {
      type: 'add',
      elementId: 'test-element-1',
      data: testElements[0],
      timestamp: Date.now()
    }),
    roomManager.addOperation(roomId, {
      type: 'add',
      elementId: 'test-element-2',
      data: testElements[1],
      timestamp: Date.now()
    })
  ]);

  console.log('操作已添加');

  // 获取房间数据验证
  const room = await roomManager.getRoom(roomId);
  console.log(`房间 ${roomId} 包含 ${room.state.elements.length} 个元素`);
  console.log(`房间 ${roomId} 包含 ${room.operations.length} 个操作`);

  // 等待异步保存完成
  console.log('等待数据保存...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  setTimeout(async () => {
    console.log('重新加载房间数据...');
    // 清除内存中的数据
    roomManager.rooms.delete(roomId);

    // 重新加载
    const reloadedRoom = await roomManager.getRoom(roomId);
    console.log(`重新加载后房间 ${roomId} 包含 ${reloadedRoom.state.elements.length} 个元素`);
    console.log(`重新加载后房间 ${roomId} 包含 ${reloadedRoom.operations.length} 个操作`);

    // 检查数据是否一致
    const elementsMatch = reloadedRoom.state.elements.length === testElements.length;
    const operationsMatch = reloadedRoom.operations.length === 2;

    if (elementsMatch && operationsMatch) {
      console.log('✅ 持久化测试通过！数据已成功保存到文件。');
    } else {
      console.log('❌ 持久化测试失败！');
    }

    process.exit(0);
  }, 1000);
}

testPersistence().catch(console.error);
