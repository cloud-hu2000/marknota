import React from 'react';
import { ToolbarProps } from '../types';

export const Toolbar: React.FC<ToolbarProps> = ({
  selectedElement,
  onUploadImage,
  onDeleteElement,
  onCropStart
  , onZoomIn, onZoomOut, onResetZoom, zoomLevel
}) => {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <h3>工具栏</h3>
        <button onClick={onUploadImage} className="upload-btn">
          📤 上传图片
        </button>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button onClick={onZoomOut} className="action-btn">➖</button>
          <button onClick={onResetZoom} className="action-btn">100%</button>
          <button onClick={onZoomIn} className="action-btn">➕</button>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#666' }}>{zoomLevel ? `${Math.round(zoomLevel*100)}%` : ''}</div>
        </div>
      </div>

      {selectedElement && (
        <div className="toolbar-section">
          <h4>图片操作</h4>
          <div className="action-buttons">
            <button onClick={onCropStart} className="action-btn">
              ✂️ 裁剪
            </button>
            <button onClick={onDeleteElement} className="action-btn delete-btn">
              🗑️ 删除
            </button>
          </div>

          <div className="element-info">
            <p>位置: ({Math.round(selectedElement.position.x)}, {Math.round(selectedElement.position.y)})</p>
            <p>尺寸: {Math.round(selectedElement.size.width)} × {Math.round(selectedElement.size.height)}</p>
            <p>旋转: {Math.round(selectedElement.rotation)}°</p>
          </div>
        </div>
      )}

      <style>{`
        .toolbar {
          width: 250px;
          height: 100vh;
          background: #f8f9fa;
          border-right: 1px solid #dee2e6;
          padding: 20px;
          box-sizing: border-box;
          overflow-y: auto;
        }

        .toolbar-section {
          margin-bottom: 30px;
        }

        .toolbar-section h3 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 16px;
        }

        .toolbar-section h4 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 14px;
        }

        .upload-btn {
          width: 100%;
          padding: 12px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .upload-btn:hover {
          background: #0056b3;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 15px;
        }

        .action-btn {
          padding: 8px 12px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }

        .action-btn:hover {
          background: #218838;
        }

        .delete-btn {
          background: #dc3545;
        }

        .delete-btn:hover {
          background: #c82333;
        }

        .element-info {
          background: #e9ecef;
          padding: 10px;
          border-radius: 4px;
          font-size: 12px;
          color: #666;
        }

        .element-info p {
          margin: 5px 0;
        }
      `}</style>
    </div>
  );
};
