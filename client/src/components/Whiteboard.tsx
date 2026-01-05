import React, { useState, useRef, useCallback } from 'react';
import { WhiteboardProps, ImageElement, WhiteboardState, Operation } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import { Toolbar } from './Toolbar';
import { ImageElement as ImageElementComponent } from './ImageElement';
import { compressImage, isValidImageFile, generateId, getImageDimensions } from '../utils/imageUtils';

export const Whiteboard: React.FC<WhiteboardProps> = ({ roomId, initialState }) => {
  const [state, setState] = useState<WhiteboardState>(initialState || {
    elements: [],
    selectedElementId: null
  });

  const [isCropping, setIsCropping] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 地图式画布状态
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  console.log('Whiteboard rendered, state:', state);

  // 处理接收到的操作
  const handleOperation = useCallback((operation: Operation & { senderId?: string }, currentSocketId?: string | null) => {
    // 如果这个操作是我们自己发送的，忽略它
    if (operation.senderId && currentSocketId && operation.senderId === currentSocketId) {
      console.log('忽略自己发送的操作:', operation.type);
      return;
    }

    setState(prevState => {
      const newState = { ...prevState };
      const elements = [...newState.elements];

      switch (operation.type) {
        case 'add':
          if (operation.data) {
            const newElement = operation.data as ImageElement;
            // 检查元素是否已存在，避免重复添加
            const existingIndex = elements.findIndex(el => el.id === newElement.id);
            if (existingIndex === -1) {
              elements.push(newElement);
            }
          }
          break;
        case 'update':
          const updateIndex = elements.findIndex(el => el.id === operation.elementId);
          if (updateIndex >= 0 && operation.data) {
            elements[updateIndex] = { ...elements[updateIndex], ...operation.data };
          }
          break;
        case 'delete':
          const deleteIndex = elements.findIndex(el => el.id === operation.elementId);
          if (deleteIndex >= 0) {
            elements.splice(deleteIndex, 1);
          }
          break;
      }

      newState.elements = elements;
      return newState;
    });
  }, []);

  // WebSocket 连接
  const { isConnected, socketId, sendOperation, sendStateUpdate } = useWebSocket({
    roomId,
    onStateUpdate: (serverState) => {
      console.log('接收到服务器状态更新:', {
        localElements: state.elements.length,
        serverElements: serverState.elements.length,
        localSelected: state.selectedElementId,
        serverSelected: serverState.selectedElementId,
        needsSync: needsStateSync
      });

      // 如果之前有状态同步需求，现在清除标记
      if (needsStateSync) {
        setNeedsStateSync(false);
      }

      // 检查是否有本地正在进行的操作（通过比较时间戳）
      const hasLocalChanges = state.elements.some(localEl => {
        const serverEl = serverState.elements.find(sEl => sEl.id === localEl.id);
        return serverEl && (
          localEl.position.x !== serverEl.position.x ||
          localEl.position.y !== serverEl.position.y ||
          localEl.size.width !== serverEl.size.width ||
          localEl.size.height !== serverEl.size.height ||
          localEl.rotation !== serverEl.rotation
        );
      });

      if (hasLocalChanges) {
        console.log('检测到本地有未同步的更改，优先使用本地状态');
        // 如果本地有更改，发送本地状态到服务器进行同步
        sendStateUpdate(state);
      } else if (state.elements.length > serverState.elements.length) {
        // 本地有更多元素，可能是断开期间添加的
        console.log('本地有更多元素，发送本地状态进行同步');
        sendStateUpdate(state);
      } else {
        // 使用服务器状态，但保留当前选中的元素
        console.log('使用服务器状态');
        setState(prevState => ({
          ...serverState,
          selectedElementId: prevState.selectedElementId // 保留本地选择状态
        }));
      }
    },
    onOperation: (operation) => {
      handleOperation(operation, socketId);
    }
  });

  // 发送操作到服务器
  const broadcastOperation = useCallback((operation: Operation) => {
    sendOperation(operation);
  }, [sendOperation]);

  // 发送实时操作到服务器（仅用于持久化，不广播）
  const sendRealtimeOperation = useCallback(async (operation: Operation) => {
    try {
      const response = await fetch(`http://localhost:3004/api/rooms/${roomId}/realtime-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operation }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Realtime update failed:', response.status, errorData);
        throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log('实时更新成功:', operation.elementId);
      return result;
    } catch (error) {
      console.error('Failed to send realtime update:', error);
      // 如果实时更新失败，标记需要状态同步
      setNeedsStateSync(true);
      throw error;
    }
  }, [roomId]);

  // 状态同步标记
  const [needsStateSync, setNeedsStateSync] = useState(false);

  // 当需要状态同步时，请求服务器重新发送状态
  React.useEffect(() => {
    if (needsStateSync && isConnected) {
      console.log('检测到状态同步需求，等待下次状态更新');
      // 状态同步将通过正常的WebSocket重连机制处理
    }
  }, [needsStateSync, isConnected]);

  // 本地更新元素（用于拖动过程中的实时反馈）
  const updateElementLocal = useCallback((elementId: string, updates: Partial<ImageElement>) => {
    setState(prevState => {
      const newState = { ...prevState };
      const elements = [...newState.elements];
      const index = elements.findIndex(el => el.id === elementId);

      if (index >= 0) {
        elements[index] = { ...elements[index], ...updates };
        newState.elements = elements;
      }

      return newState;
    });
  }, []);

  // 实时更新元素到服务器（拖拽过程中调用，用于持久化）
  const updateElementRealtime = useCallback(async (elementId: string, updates: Partial<ImageElement>) => {
    // 获取当前元素状态
    const currentElement = state.elements.find(el => el.id === elementId);
    if (!currentElement) return;

    // 合并更新数据
    const updatedElement = { ...currentElement, ...updates };

    try {
      await sendRealtimeOperation({
        type: 'update',
        elementId,
        data: {
          position: updatedElement.position,
          size: updatedElement.size,
          rotation: updatedElement.rotation
        },
        timestamp: Date.now(),
        isRealtime: true
      });
    } catch (error) {
      console.error('实时更新失败，将在最终操作时重试:', error);
      // 如果实时更新失败，我们仍然更新本地状态
      // 最终操作会确保数据同步
    }
  }, [state.elements, sendRealtimeOperation]);

  // 最终更新元素到服务器（鼠标释放时调用）
  const updateElementFinal = useCallback((elementId: string, updates: Partial<ImageElement>) => {
    // 获取当前元素状态（包含拖动过程中的本地更新）
    const currentElement = state.elements.find(el => el.id === elementId);
    if (!currentElement) return;

    // 合并传入的更新数据和当前元素状态，确保发送完整且最新的状态
    const finalElementState = { ...currentElement, ...updates };

    broadcastOperation({
      type: 'update',
      elementId,
      data: {
        position: finalElementState.position,
        size: finalElementState.size,
        rotation: finalElementState.rotation
      },
      timestamp: Date.now()
    });
  }, [state.elements, broadcastOperation]);

  // 删除元素
  const deleteElement = useCallback(() => {
    if (!state.selectedElementId) return;

    const elementIdToDelete = state.selectedElementId;

    setState(prevState => {
      const newState = { ...prevState };
      newState.elements = newState.elements.filter(el => el.id !== elementIdToDelete);
      newState.selectedElementId = null;

      // 发送操作
      broadcastOperation({
        type: 'delete',
        elementId: elementIdToDelete,
        timestamp: Date.now()
      });

      return newState;
    });
  }, [state.selectedElementId, broadcastOperation]);

  // 选择元素
  const selectElement = useCallback((elementId: string | null) => {
    setState(prevState => ({ ...prevState, selectedElementId: elementId }));
  }, []);

  // 处理画布鼠标按下（开始拖拽）
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      selectElement(null);
    }
  }, [panOffset, selectElement]);

  // 处理画布鼠标移动（拖拽过程中）
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      const newOffsetX = e.clientX - dragStart.x;
      const newOffsetY = e.clientY - dragStart.y;
      setPanOffset({ x: newOffsetX, y: newOffsetY });
    }
  }, [isDragging, dragStart]);

  // 处理画布鼠标释放（结束拖拽）
  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setIsDragging(false);
    }
  }, [isDragging]);

  // 处理鼠标离开画布区域
  const handleCanvasMouseLeave = useCallback((_e: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  // 处理滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1; // 缩小或放大
    const newZoom = Math.max(0.1, Math.min(3.0, zoom * delta)); // 限制缩放范围

    if (newZoom !== zoom) {
      // 计算鼠标在画布中的位置
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 计算缩放后的偏移调整
        const scaleFactor = newZoom / zoom;
        const newOffsetX = mouseX - (mouseX - panOffset.x) * scaleFactor;
        const newOffsetY = mouseY - (mouseY - panOffset.y) * scaleFactor;

        setZoom(newZoom);
        setPanOffset({ x: newOffsetX, y: newOffsetY });
      }
    }
  }, [zoom, panOffset]);

  // 处理画布点击
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current && !isDragging) {
      selectElement(null);
    }
  }, [selectElement, isDragging]);

  // 上传图片
  const handleUploadImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 处理文件选择
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isValidImageFile(file)) {
      alert('请选择有效的图片文件 (JPG/PNG)');
      return;
    }

    try {
      // 压缩图片以减少数据大小
      const base64Src = await compressImage(file, 800, 0.6); // 进一步压缩

      // 获取压缩后图片的尺寸
      const { width: naturalW, height: naturalH } = await getImageDimensions(base64Src);
      const maxWidth = Math.min(window.innerWidth * 0.6, 1200); // 限制默认显示宽度
      const maxHeight = Math.min(window.innerHeight * 0.6, 800);
      const scale = Math.min(1, maxWidth / naturalW, maxHeight / naturalH);
      const displayW = Math.round(naturalW * scale);
      const displayH = Math.round(naturalH * scale);

      // 创建新元素，尺寸基于图片实际比例，避免 container 与图片内容不匹配
      const newElement: ImageElement = {
        id: generateId(),
        src: base64Src,
        position: { x: 100, y: 100 }, // 默认位置
        size: { width: displayW, height: displayH },
        rotation: 0,
        zIndex: Date.now(),
        createdAt: Date.now()
      };

      // 先添加到本地状态，确保立即可见
      setState(prevState => {
        const newState = { ...prevState };
        newState.elements = [...newState.elements, newElement];
        newState.selectedElementId = newElement.id;
        return newState;
      });

      // 然后发送操作到服务器
      // 如果WebSocket断开，操作会失败，但图片已经在本地显示
      broadcastOperation({
        type: 'add',
        elementId: newElement.id,
        data: newElement,
        timestamp: Date.now()
      });

      // 如果WebSocket断开，尝试重连后重新发送操作
      if (!isConnected) {
        console.warn('WebSocket未连接，图片已添加到本地状态，重连后将同步到服务器');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('上传图片失败');
    }

    // 清空文件输入
    e.target.value = '';
  }, [broadcastOperation, isConnected]);


  // 开始裁剪
  const handleCropStart = useCallback(() => {
    setIsCropping(true);
    // TODO: 实现裁剪功能
  }, []);

  // 获取选中的元素
  const selectedElement = state.elements.find(el => el.id === state.selectedElementId) || null;

  return (
    <div className="whiteboard-app">
      {/* 顶部栏 */}
      <div className="top-bar">
        <div className="connection-status" style={{ color: isConnected ? '#28a745' : '#dc3545' }}>
          {isConnected ? '🟢' : '🔴'} {isConnected ? '已连接' : '连接中...'}
        </div>
      </div>

      <div className="main-content">
        {/* 工具栏 */}
        <Toolbar
          selectedElement={selectedElement}
          onUploadImage={handleUploadImage}
          onDeleteElement={deleteElement}
          onCropStart={handleCropStart}
        />

        {/* 白板画布 */}
        <div
          ref={canvasRef}
          className="whiteboard-canvas"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseLeave}
          onWheel={handleWheel}
          onClick={handleCanvasClick}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          {/* 网格背景 */}
          <div
            className="grid-background"
            style={{
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${panOffset.x * zoom}px ${panOffset.y * zoom}px`,
            }}
          />

          {/* 渲染图片元素 */}
          {state.elements.map(element => (
            <ImageElementComponent
              key={element.id}
              element={element}
              isSelected={element.id === state.selectedElementId}
              onLocalUpdate={(updates) => updateElementLocal(element.id, updates)}
              onRealtimeUpdate={(updates) => updateElementRealtime(element.id, updates)}
              onFinalUpdate={(updates) => updateElementFinal(element.id, updates)}
              onDelete={deleteElement}
              onCropStart={handleCropStart}
              onSelect={() => selectElement(element.id)}
              canvasRef={canvasRef}
              canvasTransform={{ panOffset, zoom }}
            />
          ))}

          {/* 裁剪模式覆盖层 */}
          {isCropping && (
            <div className="crop-overlay">
              <div className="crop-instructions">
                裁剪功能开发中...
                <button onClick={() => setIsCropping(false)}>取消</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <style>{`
        .whiteboard-app {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f8f9fa;
          overflow: hidden;
        }

        .top-bar {
          height: 50px;
          background: white;
          border-bottom: 1px solid #dee2e6;
          display: flex;
          align-items: center;
          padding: 0 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .connection-status {
          font-weight: bold;
          font-size: 14px;
          color: #666;
        }

        .main-content {
          flex: 1;
          display: flex;
        }

        .whiteboard-canvas {
          flex: 1;
          position: relative;
          background: white;
          overflow: visible;
          width: 100%;
          height: 100%;
        }

        .grid-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image:
            linear-gradient(#e9ecef 1px, transparent 1px),
            linear-gradient(90deg, #e9ecef 1px, transparent 1px);
          pointer-events: none;
        }

        .crop-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .crop-instructions {
          background: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
        }

        .crop-instructions button {
          display: block;
          margin-top: 10px;
          padding: 8px 16px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
