import React, { useState, useCallback } from 'react';
import { ImageElement, Position, Size } from '../types';

interface UseImageEditorProps {
  element: ImageElement;
  onLocalUpdate?: (updates: Partial<ImageElement>) => void; // 本地实时更新（拖动过程中）
  onRealtimeUpdate?: (updates: Partial<ImageElement>) => void; // 实时更新到服务器用于持久化
  onFinalUpdate: (updates: Partial<ImageElement>) => void; // 最终更新到服务器（鼠标释放时）
  canvasRef: React.RefObject<HTMLDivElement>;
}

export const useImageEditor = ({ element, onLocalUpdate, onRealtimeUpdate, onFinalUpdate, canvasRef }: UseImageEditorProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<Size>({ width: 0, height: 0 });
  const [resizeCenter, setResizeCenter] = useState<Position>({ x: 0, y: 0 });
  const [rotateStart, setRotateStart] = useState(0);

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

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    switch (type) {
      case 'drag':
        // 不再立即设置拖拽状态，等待外部确认
        setDragStart({
          x: mouseX - element.position.x,
          y: mouseY - element.position.y
        });
        break;

      case 'resize':
        setIsResizing(true);
        setResizeStart({
          width: element.size.width,
          height: element.size.height
        });
        // 记录元素中心并把鼠标位置转换到元素的本地（去旋转）坐标系，便于旋转情况下按角点缩放
        const centerX = element.position.x + element.size.width / 2;
        const centerY = element.position.y + element.size.height / 2;
        setResizeCenter({ x: centerX, y: centerY });

        const angleRad = (element.rotation || 0) * (Math.PI / 180);
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        // 将鼠标在画布坐标系的位置转换到元素的本地坐标（未旋转）
        const localX = (mouseX - centerX) * cos + (mouseY - centerY) * sin;
        const localY = -(mouseX - centerX) * sin + (mouseY - centerY) * cos;

        setDragStart({
          x: localX,
          y: localY
        });
        break;

      case 'rotate':
        setIsRotating(true);
        const rotateCenterX = element.position.x + element.size.width / 2;
        const rotateCenterY = element.position.y + element.size.height / 2;
        setRotateStart(getAngle(mouseX, mouseY, rotateCenterX, rotateCenterY) - element.rotation);
        break;
    }
  }, [element, canvasRef, getAngle]);

  // 开始实际的拖拽操作
  const startDragging = useCallback(() => {
    setIsDragging(true);
  }, []);

  // 使用节流来限制更新频率，避免过度更新
  const throttledUpdateRef = React.useRef<NodeJS.Timeout | null>(null);
  // 实时更新的节流定时器
  const realtimeUpdateRef = React.useRef<NodeJS.Timeout | null>(null);

  // 鼠标移动处理
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 使用节流来限制更新频率，每16ms最多更新一次（约60fps）
    if (throttledUpdateRef.current) return;

    throttledUpdateRef.current = setTimeout(() => {
      throttledUpdateRef.current = null;

      let updates: Partial<ImageElement> | null = null;

      if (isDragging) {
        updates = {
          position: {
            x: mouseX - dragStart.x,
            y: mouseY - dragStart.y
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

        // 以中心为参考，新的半宽半高由 localX/localY 的绝对值决定
        const newHalfWidth = Math.max(25, Math.abs(localX));
        const newHalfHeight = Math.max(25, Math.abs(localY));

        const newWidth = newHalfWidth * 2;
        const newHeight = newHalfHeight * 2;

        // 计算新的左上角位置（保持中心不变）
        const newPosX = centerX - newWidth / 2;
        const newPosY = centerY - newHeight / 2;

        updates = {
          size: { width: newWidth, height: newHeight },
          position: { x: newPosX, y: newPosY }
        };
      } else if (isRotating) {
        const centerX = element.position.x + element.size.width / 2;
        const centerY = element.position.y + element.size.height / 2;
        const currentAngle = getAngle(mouseX, mouseY, centerX, centerY);

        updates = {
          rotation: currentAngle - rotateStart
        };
      }

      if (updates) {
        // 本地更新提供实时反馈
        onLocalUpdate?.(updates);

        // 使用节流发送实时更新到服务器用于持久化（每100ms最多一次）
        if (!realtimeUpdateRef.current) {
          realtimeUpdateRef.current = setTimeout(() => {
            realtimeUpdateRef.current = null;
            onRealtimeUpdate?.(updates);
          }, 100); // 100ms节流，避免过度持久化
        }
      }
    }, 16); // 约60fps
  }, [isDragging, isResizing, isRotating, dragStart, resizeStart, rotateStart, element, onLocalUpdate, onRealtimeUpdate, canvasRef, getAngle]);

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
