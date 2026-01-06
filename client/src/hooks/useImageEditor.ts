import React, { useState, useCallback } from 'react';
import { ImageElement, Position, Size } from '../types';

interface UseImageEditorProps {
  element: ImageElement;
  onLocalUpdate?: (updates: Partial<ImageElement>) => void; // 本地实时更新（拖动过程中）
  onRealtimeUpdate?: (updates: Partial<ImageElement>) => void; // 实时更新到服务器用于持久化
  onFinalUpdate: (updates: Partial<ImageElement>) => void; // 最终更新到服务器（鼠标释放时）
  canvasRef: React.RefObject<HTMLDivElement>;
  canvasTransform?: {
    panOffset: { x: number; y: number };
    zoom: number;
  };
}

export const useImageEditor = ({ element, onLocalUpdate, onRealtimeUpdate, onFinalUpdate, canvasRef, canvasTransform }: UseImageEditorProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<Size>({ width: 0, height: 0 });
  const [resizeCenter, setResizeCenter] = useState<Position>({ x: 0, y: 0 });
  const [rotateStart, setRotateStart] = useState(0);

  // 存储拖拽开始时的画布变换状态，用于在缩放过程中保持拖拽的一致性
  const [dragStartTransform, setDragStartTransform] = useState<{ zoom: number; panOffset: { x: number; y: number } } | null>(null);

  // 计算鼠标相对于元素中心的角度
  const getAngle = useCallback((mouseX: number, mouseY: number, centerX: number, centerY: number) => {
    return Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI);
  }, []);

  // 开始拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'drag' | 'resize' | 'rotate') => {
    e.preventDefault();
    e.stopPropagation();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 获取画布变换信息
    const zoom = canvasTransform?.zoom || 1;
    const panOffset = canvasTransform?.panOffset || { x: 0, y: 0 };

    // 将屏幕坐标转换为画布坐标（考虑缩放和平移）
    const mouseX = (e.clientX - rect.left) / zoom - panOffset.x;
    const mouseY = (e.clientY - rect.top) / zoom - panOffset.y;

    switch (type) {
      case 'drag': {
        // 计算鼠标相对于元素位置的偏移（在画布坐标系中）
        // mouseX/mouseY 已经是画布坐标
        // 元素位置也是画布坐标
        setDragStart({
          x: mouseX - element.position.x,
          y: mouseY - element.position.y
        });
        // 保存拖拽开始时的画布变换状态，用于在缩放过程中保持拖拽的一致性
        setDragStartTransform({
          zoom: zoom,
          panOffset: { ...panOffset }
        });
        break;
      }

      case 'resize':
        setIsResizing(true);
        setResizeStart({
          width: element.size.width,
          height: element.size.height
        });
        // 记录元素中心（屏幕坐标，考虑缩放）
        const elCenterX = (element.position.x + element.size.width / 2 + panOffset.x) * zoom;
        const elCenterY = (element.position.y + element.size.height / 2 + panOffset.y) * zoom;
        setResizeCenter({ x: elCenterX, y: elCenterY });

        const angleRad = (element.rotation || 0) * (Math.PI / 180);
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        // 将鼠标在画布坐标系的位置转换到元素的本地坐标（未旋转）
        const localX = (mouseX - elCenterX) * cos + (mouseY - elCenterY) * sin;
        const localY = -(mouseX - elCenterX) * sin + (mouseY - elCenterY) * cos;

        setDragStart({
          x: localX,
          y: localY
        });
        break;

      case 'rotate': {
        setIsRotating(true);
        const rotateCenterX = (element.position.x + element.size.width / 2 + panOffset.x) * zoom;
        const rotateCenterY = (element.position.y + element.size.height / 2 + panOffset.y) * zoom;
        setRotateStart(getAngle(mouseX, mouseY, rotateCenterX, rotateCenterY) - element.rotation);
        break;
      }
    }
  }, [element, canvasRef, getAngle]);

  // 开始实际的拖拽操作
  const startDragging = useCallback(() => {
    setIsDragging(true);
  }, []);

  // 使用节流来限制更新频率，避免过度更新
  const throttledUpdateRef = React.useRef<number | null>(null);
  // 实时更新的节流定时器
  const realtimeUpdateRef = React.useRef<number | null>(null);

  // 鼠标移动处理
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 获取画布变换信息
    const zoom = canvasTransform?.zoom || 1;
    const panOffset = canvasTransform?.panOffset || { x: 0, y: 0 };

    // 将屏幕坐标转换为画布坐标（考虑缩放和平移）
    const mouseX = (e.clientX - rect.left) / zoom - panOffset.x;
    const mouseY = (e.clientY - rect.top) / zoom - panOffset.y;

    // 使用节流来限制更新频率，每16ms最多更新一次（约60fps）
    if (throttledUpdateRef.current) return;

    throttledUpdateRef.current = setTimeout(() => {
      throttledUpdateRef.current = null;

      let updates: Partial<ImageElement> | null = null;

      if (isDragging) {
        // 检查画布变换是否发生了变化，如果是则重新计算dragStart
        if (dragStartTransform) {
          const currentZoom = canvasTransform?.zoom || 1;
          const currentPanOffset = canvasTransform?.panOffset || { x: 0, y: 0 };
          const startZoom = dragStartTransform.zoom;
          const startPanOffset = dragStartTransform.panOffset;

          // 如果画布变换发生了变化，立即重新计算dragStart
          if (currentZoom !== startZoom || currentPanOffset.x !== startPanOffset.x || currentPanOffset.y !== startPanOffset.y) {
            // 直接基于当前鼠标位置和元素当前位置重新计算dragStart
            // 这样可以立即适应新的坐标变换规则
            setDragStart({
              x: mouseX - element.position.x,
              y: mouseY - element.position.y
            });

            // 更新存储的变换状态
            setDragStartTransform({
              zoom: currentZoom,
              panOffset: { ...currentPanOffset }
            });

            console.log('画布缩放已更新拖拽计算规则', {
              oldZoom: startZoom,
              newZoom: currentZoom,
              newDragStart: { x: mouseX - element.position.x, y: mouseY - element.position.y }
            });
          }
        }

        // 在画布坐标系中计算新的元素位置
        const newPosX = mouseX - dragStart.x;
        const newPosY = mouseY - dragStart.y;

        updates = {
          position: {
            x: newPosX,
            y: newPosY
          }
        };
      } else if (isResizing) {
        // 在元素本地（去旋转）坐标系中计算新的半宽半高，使得对应角点与鼠标对齐，
        // 并保持元素中心不变（这样旋转情况下角点会跟随鼠标）
        const centerX = resizeCenter.x;
        const centerY = resizeCenter.y;
        const angleRad = (element.rotation || 0) * (Math.PI / 180);
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        // 当前鼠标在元素本地坐标
        const localX = (mouseX - centerX) * cos + (mouseY - centerY) * sin;
        const localY = -(mouseX - centerX) * sin + (mouseY - centerY) * cos;

        // 以中心为参考，新的半宽半高由 localX/localY 的绝对值决定（像素）
        const newHalfWidth = Math.max(25, Math.abs(localX));
        const newHalfHeight = Math.max(25, Math.abs(localY));

        const newWidthPx = newHalfWidth * 2;
        const newHeightPx = newHalfHeight * 2;

        // 计算新的左上角位置（保持中心不变）
        const newPosXPx = centerX - newWidthPx / 2;
        const newPosYPx = centerY - newHeightPx / 2;

        // 将屏幕坐标转换回原始存储坐标
        const originalPosX = newPosXPx / zoom - panOffset.x;
        const originalPosY = newPosYPx / zoom - panOffset.y;
        const originalWidth = newWidthPx / zoom;
        const originalHeight = newHeightPx / zoom;

        updates = {
          size: { width: originalWidth, height: originalHeight },
          position: { x: originalPosX, y: originalPosY }
        };
      } else if (isRotating) {
        // 计算元素中心在屏幕上的位置（考虑缩放和平移）
        const centerXPx = (element.position.x + element.size.width / 2 + panOffset.x) * zoom;
        const centerYPx = (element.position.y + element.size.height / 2 + panOffset.y) * zoom;
        const currentAngle = getAngle(mouseX, mouseY, centerXPx, centerYPx);

        updates = {
          rotation: currentAngle - rotateStart
        };
      }

      if (updates) {
        // 限制最小像素尺寸
        const minPx = 25;

        // 先计算合并后的 candidate position/size（像素），使用现有 element 做缺省值
        const candidatePosX = updates.position?.x ?? element.position.x;
        const candidatePosY = updates.position?.y ?? element.position.y;
        const candidateW = updates.size?.width ?? element.size.width;
        const candidateH = updates.size?.height ?? element.size.height;

        // 确保尺寸不小于最小像素值
        const clampedW = Math.max(candidateW, minPx);
        const clampedH = Math.max(candidateH, minPx);

        // 允许图片自由移动到画布任何位置，无边界限制

        // 覆盖 updates 的值为受限后的像素值（只限制最小尺寸，不限制位置）
        updates = {
          ...updates,
          position: { x: candidatePosX, y: candidatePosY },
          size: { width: clampedW, height: clampedH },
        };

        // 本地更新提供实时反馈
        onLocalUpdate?.(updates);

        // 使用节流发送实时更新到服务器用于持久化（每100ms最多一次）
        if (!realtimeUpdateRef.current) {
          const toSend = updates;
          realtimeUpdateRef.current = setTimeout(() => {
            realtimeUpdateRef.current = null;
            onRealtimeUpdate?.(toSend);
          }, 100); // 100ms节流，避免过度持久化
        }
      }
    }, 16); // 约60fps
  }, [isDragging, isResizing, isRotating, dragStart, resizeStart, rotateStart, element, onLocalUpdate, onRealtimeUpdate, canvasRef, canvasTransform, getAngle]);

  // 结束操作
  const handleMouseUp = useCallback(() => {
    // 清除节流定时器
    if (throttledUpdateRef.current) {
      clearTimeout(throttledUpdateRef.current);
      throttledUpdateRef.current = null;
    }

    // 清除实时更新定时器
    if (realtimeUpdateRef.current) {
      clearTimeout(realtimeUpdateRef.current);
      realtimeUpdateRef.current = null;
    }

    // 如果之前有拖动、调整大小或旋转操作，现在同步最终状态到服务器
    if (isDragging || isResizing || isRotating) {
      // 由于拖动过程中已经通过onLocalUpdate实时更新了本地状态，
      // 这里只需要通知服务器同步，不需要传递具体的更新数据
      onFinalUpdate({});
    }

    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
  }, [isDragging, isResizing, isRotating, onFinalUpdate]);

  // 全局鼠标事件监听
  React.useEffect(() => {
    if (isDragging || isResizing || isRotating) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, isRotating, handleMouseMove, handleMouseUp]);

  return {
    isDragging,
    isResizing,
    isRotating,
    handleMouseDown,
    startDragging
  };
};
