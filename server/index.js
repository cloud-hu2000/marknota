const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const roomManager = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // 前端开发服务器地址
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB，增加消息大小限制
  pingTimeout: 60000, // 60秒ping超时
  pingInterval: 25000, // 25秒ping间隔
  connectTimeout: 20000 // 20秒连接超时
});

// 中间件
app.use(cors());
app.use(express.json());

// 基础路由
app.get('/', (req, res) => {
  res.json({
    message: '共享白板WebSocket服务器',
    status: '运行中',
    rooms: roomManager.getRoomStats()
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    rooms: roomManager.getRoomStats()
  });
});

// 实时更新路由（仅用于持久化，不广播）
app.post('/api/rooms/:roomId/realtime-update', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { operation } = req.body;

    if (!operation || operation.isRealtime !== true) {
      return res.status(400).json({ error: 'Invalid realtime operation' });
    }

    console.log(`实时更新操作 ${operation.type} for room ${roomId}, element ${operation.elementId}`);

    // 直接更新房间状态，不添加操作历史（避免历史记录过大）
    const room = await roomManager.getRoom(roomId);

    if (operation.type === 'update' && operation.data) {
      const elementIndex = room.state.elements.findIndex(el => el.id === operation.elementId);
      if (elementIndex >= 0) {
        // 更新元素状态
        room.state.elements[elementIndex] = { ...room.state.elements[elementIndex], ...operation.data };
        room.lastUpdate = Date.now();

        // 同步保存到文件，确保数据持久化
        try {
          await roomManager.saveRoom(roomId, room);
          console.log(`实时更新已保存 for room ${roomId}, element ${operation.elementId}`);
        } catch (saveError) {
          console.error(`Failed to save realtime update for room ${roomId}:`, saveError);
          return res.status(500).json({ error: 'Failed to save realtime update' });
        }
      } else {
        console.warn(`Element ${operation.elementId} not found in room ${roomId}`);
        return res.status(404).json({ error: 'Element not found' });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Realtime update error:', error);
    res.status(500).json({ error: 'Failed to process realtime update' });
  }
});

// WebSocket 连接处理
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // 客户端加入房间
  socket.on('join-room', async (roomId) => {
    try {
      // 离开之前的房间
      if (socket.currentRoom) {
        roomManager.removeClient(socket.currentRoom, socket.id);
        socket.leave(socket.currentRoom);
      }

      // 加入新房间
      socket.join(roomId);
      socket.currentRoom = roomId;
      await roomManager.addClient(roomId, socket.id);

      // 总是从最新文件重新加载房间状态，确保状态是最新的
      const room = await roomManager.getRoom(roomId, true); // 强制从文件重新加载
      console.log(`发送房间状态给客户端 ${socket.id}: ${room.state.elements.length} 个元素, 房间ID: ${roomId}`);
      console.log('房间状态详情:', JSON.stringify(room.state, null, 2).substring(0, 200) + '...');
      socket.emit('room-state', room);

      console.log(`Client ${socket.id} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // 接收状态更新
  socket.on('state-update', async (data) => {
    try {
      const { roomId, state } = data;

      if (!socket.currentRoom || socket.currentRoom !== roomId) {
        socket.emit('error', { message: 'Not in the correct room' });
        return;
      }

      // 更新房间状态
      const room = await roomManager.updateRoomState(roomId, state);

      // 广播给房间内的其他客户端
      socket.to(roomId).emit('room-state', room);

      console.log(`State updated in room ${roomId} by ${socket.id}`);
    } catch (error) {
      console.error('Error updating state:', error);
      socket.emit('error', { message: 'Failed to update state' });
    }
  });

    // 接收操作
    socket.on('operation', async (data) => {
      try {
        const { roomId, operation } = data;
        const dataSize = JSON.stringify(data).length;

        console.log(`接收操作 ${operation.type} from ${socket.id}, 数据大小: ${dataSize} bytes`);

        if (!socket.currentRoom || socket.currentRoom !== roomId) {
          console.warn(`客户端 ${socket.id} 尝试在错误房间操作: ${roomId}`);
          socket.emit('error', { message: 'Not in the correct room' });
          return;
        }

        // 添加操作到房间
        await roomManager.addOperation(roomId, operation);

        // 在操作中添加发送者ID，避免自己接收自己的操作
        const operationWithSender = {
          ...operation,
          senderId: socket.id
        };

        // 只有非实时操作才广播给其他客户端
        if (!operation.isRealtime) {
          socket.to(roomId).emit('operation', operationWithSender);
          console.log(`操作 ${operation.type} 在房间 ${roomId} 由 ${socket.id} 执行并广播`);
        } else {
          console.log(`实时操作 ${operation.type} 在房间 ${roomId} 由 ${socket.id} 执行（仅持久化）`);
        }
      } catch (error) {
        console.error(`处理操作时出错 (${socket.id}):`, error);
        socket.emit('error', { message: 'Failed to process operation' });
      }
    });

  // 处理同步请求
  socket.on('sync-request', async (roomId) => {
    try {
      if (!socket.currentRoom || socket.currentRoom !== roomId) {
        socket.emit('error', { message: 'Not in the correct room' });
        return;
      }

      // 发送当前房间状态给请求的客户端
      const room = await roomManager.getRoom(roomId);
      socket.emit('room-state', room);

      console.log(`Sync requested for room ${roomId} by ${socket.id}`);
    } catch (error) {
      console.error('Error processing sync request:', error);
      socket.emit('error', { message: 'Failed to sync' });
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    if (socket.currentRoom) {
      roomManager.removeClient(socket.currentRoom, socket.id);
    }
  });

  // 错误处理
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// 定期清理空房间
setInterval(() => {
  const cleanedCount = roomManager.cleanupEmptyRooms();
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} empty rooms`);
  }
}, 300000); // 每5分钟清理一次

// 启动服务器
const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`WebSocket 服务器已启动`);
  console.log(`前端开发服务器应运行在 http://localhost:3000`);
});
