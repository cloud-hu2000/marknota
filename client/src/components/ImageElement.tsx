import React, { useRef } from 'react';
import { ImageEditorProps } from '../types';
import { useImageEditor } from '../hooks/useImageEditor';

export const ImageElement: React.FC<ImageEditorProps> = ({
  element,
  isSelected,
  onLocalUpdate,
  onRealtimeUpdate,
  onFinalUpdate,
  onDelete,
  onCropStart: _onCropStart,
  onSelect,
  canvasRef,
  canvasTransform
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const [hasDragged, setHasDragged] = React.useState(false);
  const [imageDimensions, setImageDimensions] = React.useState<{ width: number; height: number } | null>(null);

  const { isDragging, handleMouseDown, startDragging } = useImageEditor({
    element,
    onLocalUpdate,
    onRealtimeUpdate,
    onFinalUpdate,
    canvasRef,
    canvasTransform
  });

  // 获取图片的实际尺寸
  React.useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = element.src;
  }, [element.src]);

  const handleMouseDownCustom = (e: React.MouseEvent) => {
    // 记录鼠标按下位置
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    setHasDragged(false);
    handleMouseDown(e, 'drag');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseDownPos.current) {
      const deltaX = Math.abs(e.clientX - mouseDownPos.current.x);
      const deltaY = Math.abs(e.clientY - mouseDownPos.current.y);

      // 如果移动距离超过阈值，开始拖拽
      if (deltaX > 5 || deltaY > 5) {
        if (!hasDragged) {
          setHasDragged(true);
          startDragging();
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (mouseDownPos.current && !hasDragged) {
      // 如果没有拖拽过，认为是点击
      e.stopPropagation();
      onSelect();
    }
    mouseDownPos.current = null;
    setHasDragged(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete') {
      onDelete();
    }
  };

  // 计算变换后的位置
  const transform = canvasTransform ? {
    x: element.position.x * canvasTransform.zoom + canvasTransform.panOffset.x,
    y: element.position.y * canvasTransform.zoom + canvasTransform.panOffset.y,
    scale: canvasTransform.zoom
  } : {
    x: element.position.x,
    y: element.position.y,
    scale: 1
  };

  // 计算实际显示的图片尺寸（考虑 object-fit: contain）
  const containerWidth = element.size.width * transform.scale;
  const containerHeight = element.size.height * transform.scale;

  // 计算图片在容器中的实际显示尺寸
  let displayWidth = containerWidth;
  let displayHeight = containerHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (imageDimensions) {
    const containerAspectRatio = containerWidth / containerHeight;
    const imageAspectRatio = imageDimensions.width / imageDimensions.height;

    if (containerAspectRatio > imageAspectRatio) {
      // 容器更宽，以高度为基准
      displayHeight = containerHeight;
      displayWidth = displayHeight * imageAspectRatio;
      offsetX = (containerWidth - displayWidth) / 2;
      offsetY = 0;
    } else {
      // 容器更高，以宽度为基准
      displayWidth = containerWidth;
      displayHeight = displayWidth / imageAspectRatio;
      offsetX = 0;
      offsetY = (containerHeight - displayHeight) / 2;
    }
  }

  return (
    <div
      ref={elementRef}
      className={`image-element ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${transform.x}px`,
        top: `${transform.y}px`,
        width: `${element.size.width * transform.scale}px`,
        height: `${element.size.height * transform.scale}px`,
        transform: `rotate(${element.rotation}deg)`,
        zIndex: element.zIndex,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDownCustom}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <img
        src={element.src}
        alt="Whiteboard element"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none'
        }}
        draggable={false}
      />

      {isSelected && (
        <>
          {/* 选择边框 - 紧贴实际图片尺寸 */}
          <div
            className="selection-border"
            style={{
              top: `${offsetY}px`,
              left: `${offsetX}px`,
              width: `${displayWidth}px`,
              height: `${displayHeight}px`
            }}
          />

          {/* 控制点 - 紧贴实际图片右下角 */}
          <div
            className="control-point resize-handle"
            style={{
              position: 'absolute',
              left: `${displayWidth + offsetX - 6}px`,
              top: `${displayHeight + offsetY - 6}px`,
              cursor: 'nw-resize',
              transform: `rotate(${-element.rotation}deg)`
            }}
            onMouseDown={(e) => handleMouseDown(e, 'resize')}
          />

          {/* 旋转手柄 */}
          <div
            className="control-point rotate-handle"
            style={{
              top: -20,
              left: '50%',
              transform: 'translateX(-50%)',
              cursor: 'crosshair'
            }}
            onMouseDown={(e) => handleMouseDown(e, 'rotate')}
          />
        </>
      )}

      <style>{`
        .image-element {
          outline: none;
          transition: box-shadow 0.2s ease;
        }

        /* 移除 container 的 box-shadow，使用内部 .selection-border 提供精确贴合的边框 */
        .image-element.selected {
          box-shadow: none;
        }

        .image-element.dragging {
          opacity: 0.8;
        }

        .selection-border {
          position: absolute;
          border: 2px solid #007bff;
          pointer-events: none;
          box-sizing: border-box;
        }

        .control-point {
          position: absolute;
          width: 12px;
          height: 12px;
          background: #007bff;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          pointer-events: auto;
        }

        .resize-handle {
          background: #28a745;
        }

        .rotate-handle {
          width: 16px;
          height: 16px;
          background: #ffc107;
        }

        .rotate-handle::after {
          content: '↻';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 10px;
          color: white;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};
