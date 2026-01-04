import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WhiteboardState, Operation, RoomData } from '../types';
import { SERVER_URL } from '../config';

interface UseWebSocketProps {
  roomId: string;
  onStateUpdate?: (state: WhiteboardState) => void;
  onOperation?: (operation: Operation) => void;
}

export const useWebSocket = ({ roomId = '', onStateUpdate, onOperation }: UseWebSocketProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef({ onStateUpdate, onOperation });

  // 更新回调引用
  useEffect(() => {
    callbacksRef.current = { onStateUpdate, onOperation };
  }, [onStateUpdate, onOperation]);

  useEffect(() => {
    // 使用配置的服务器URL
    const wsUrl = SERVER_URL;
    console.log(`连接到WebSocket服务器: ${wsUrl}`);

    // 连接到WebSocket服务器
    const socket = io(wsUrl, {
      transports: ['polling', 'websocket'], // 优先使用轮询，与服务器配置匹配
      forceNew: true,
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socketRef.current = socket;

    // 连接成功
    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      setSocketId(socket.id || null);

      // 加入房间
      socket.emit('join-room', roomId);
    });

    // 断开连接
    socket.on('disconnect', (reason) => {
      console.log('Disconnected from server, reason:', reason);
      setIsConnected(false);
      setSocketId(null);
    });

    // 接收房间状态
    socket.on('room-state', (roomData: RoomData) => {
      console.log('Received room state:', roomData);
      console.log('Room state elements count:', roomData.state?.elements?.length || 0);
      callbacksRef.current.onStateUpdate?.(roomData.state);
    });

    // 接收操作
    socket.on('operation', (operation: Operation) => {
      console.log('Received operation:', operation);
      callbacksRef.current.onOperation?.(operation);
    });

    // 错误处理
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // 连接错误
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    // 重连
    socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);

      // 重连后重新加入房间，确保状态同步
      if (roomId) {
        socket.emit('join-room', roomId);
      }
    });

    // 重连错误
    socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]); // 只依赖 roomId，不依赖回调函数

  // 发送操作到服务器
  const sendOperation = useCallback((operation: Operation) => {
    if (socketRef.current && isConnected) {
      try {
        console.log('发送操作到服务器:', operation.type, operation.elementId);
        socketRef.current.emit('operation', { roomId, operation });
      } catch (error) {
        console.error('发送操作失败:', error);
      }
    } else {
      console.warn('WebSocket未连接，无法发送操作');
    }
  }, [roomId, isConnected]);

  // 发送状态更新
  const sendStateUpdate = useCallback((state: WhiteboardState) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('state-update', { roomId, state });
    }
  }, [roomId, isConnected]);

  return {
    isConnected,
    socketId,
    sendOperation,
    sendStateUpdate
  };
};
