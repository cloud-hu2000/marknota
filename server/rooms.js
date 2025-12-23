// 房间状态管理
const fs = require('fs').promises;
const path = require('path');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> roomData
    this.dataDir = path.join(__dirname, 'data');
    this.ensureDataDirectory();
    this.loadAllRooms();
  }

  // 确保数据目录存在
  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }

  // 获取房间数据文件路径
  getRoomFilePath(roomId) {
    return path.join(this.dataDir, `${roomId}.json`);
  }

  // 从文件加载房间数据
  async loadRoom(roomId) {
    try {
      const filePath = this.getRoomFilePath(roomId);
      const data = await fs.readFile(filePath, 'utf8');
      const parsedData = JSON.parse(data);

      // 确保返回的数据格式正确
      return {
        roomId: parsedData.roomId,
        state: parsedData.state || { elements: [], selectedElementId: null },
        operations: parsedData.operations || [],
        clients: new Set(), // 运行时重置客户端连接
        lastUpdate: parsedData.lastUpdate || 0
      };
    } catch (error) {
      // 文件不存在或读取失败，返回null
      console.log(`No saved data found for room ${roomId}`);
      return null;
    }
  }

  // 保存房间数据到文件
  async saveRoom(roomId, roomData) {
    try {
      const filePath = this.getRoomFilePath(roomId);
      // 只保存状态和操作，不保存客户端连接信息
      const dataToSave = {
        roomId: roomData.roomId,
        state: roomData.state,
        operations: roomData.operations.slice(-100), // 只保存最近100个操作
        lastUpdate: roomData.lastUpdate
      };
      // 使用临时文件避免并发写入问题
      const tempFilePath = `${filePath}.tmp`;
      await fs.writeFile(tempFilePath, JSON.stringify(dataToSave, null, 2));
      await fs.rename(tempFilePath, filePath);
    } catch (error) {
      console.error(`Error saving room ${roomId}:`, error);
    }
  }

  // 启动时加载所有房间数据
  async loadAllRooms() {
    try {
      const files = await fs.readdir(this.dataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      for (const file of jsonFiles) {
        const roomId = file.replace('.json', '');
        const roomData = await this.loadRoom(roomId);
        if (roomData) {
          // 恢复房间数据，但重置客户端连接
          roomData.clients = new Set();
          this.rooms.set(roomId, roomData);
          console.log(`Loaded room ${roomId} from disk`);
        }
      }
    } catch (error) {
      console.error('Error loading rooms from disk:', error);
    }
  }

  // 获取或创建房间
  async getRoom(roomId, forceReload = false) {
    if (!this.rooms.has(roomId) || forceReload) {
      // 先尝试从文件加载
      const savedData = await this.loadRoom(roomId);
      if (savedData) {
        savedData.clients = forceReload ? new Set() : (this.rooms.get(roomId)?.clients || new Set()); // 保留客户端连接
        this.rooms.set(roomId, savedData);
      } else {
        // 创建新房间
        this.rooms.set(roomId, {
          roomId,
          state: {
            elements: [],
            selectedElementId: null
          },
          operations: [],
          clients: new Set() // 连接的客户端Socket ID
        });
      }
    }
    return this.rooms.get(roomId);
  }

  // 添加客户端到房间
  async addClient(roomId, socketId) {
    const room = await this.getRoom(roomId);
    room.clients.add(socketId);
    console.log(`Client ${socketId} joined room ${roomId}. Total clients: ${room.clients.size}`);
  }

  // 从房间移除客户端
  removeClient(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.clients.delete(socketId);
      console.log(`Client ${socketId} left room ${roomId}. Remaining clients: ${room.clients.size}`);

      // 如果房间没有客户端了，可以选择清理房间数据
      if (room.clients.size === 0) {
        console.log(`Room ${roomId} is empty, keeping data for potential reconnects`);
        // 这里可以设置定时器来清理空房间
      }
    }
  }

  // 更新房间状态
  async updateRoomState(roomId, state) {
    const room = await this.getRoom(roomId);
    room.state = { ...state };
    room.lastUpdate = Date.now();
    // 异步保存到文件，不阻塞操作
    this.saveRoom(roomId, room).catch(error =>
      console.error(`Failed to save room ${roomId}:`, error)
    );
    return room;
  }

  // 添加操作到房间
  async addOperation(roomId, operation) {
    const room = await this.getRoom(roomId);
    room.operations.push(operation);

    // 限制操作历史长度，避免内存泄漏
    if (room.operations.length > 1000) {
      room.operations = room.operations.slice(-500);
    }

    room.lastUpdate = Date.now();
    // 异步保存到文件，不阻塞操作
    this.saveRoom(roomId, room).catch(error =>
      console.error(`Failed to save room ${roomId}:`, error)
    );
    return room;
  }

  // 获取房间中的其他客户端（排除发送者）
  async getOtherClients(roomId, excludeSocketId) {
    const room = await this.getRoom(roomId);
    if (!room) return [];

    return Array.from(room.clients).filter(id => id !== excludeSocketId);
  }

  // 获取房间统计信息
  getRoomStats() {
    const stats = {};
    for (const [roomId, room] of this.rooms) {
      stats[roomId] = {
        clientCount: room.clients.size,
        elementCount: room.state.elements.length,
        lastUpdate: room.lastUpdate || 0,
        persisted: true // 标记为已持久化
      };
    }
    return stats;
  }

  // 清理空房间（可选，用于内存管理）
  cleanupEmptyRooms(maxAge = 3600000) { // 默认1小时
    const now = Date.now();
    const toDelete = [];

    for (const [roomId, room] of this.rooms) {
      if (room.clients.size === 0 && room.lastUpdate && (now - room.lastUpdate) > maxAge) {
        toDelete.push(roomId);
      }
    }

    toDelete.forEach(roomId => {
      this.rooms.delete(roomId);
      console.log(`Cleaned up empty room: ${roomId}`);
    });

    return toDelete.length;
  }
}

module.exports = new RoomManager();

