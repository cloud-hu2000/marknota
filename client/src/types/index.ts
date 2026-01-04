export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ImageElement {
  id: string;
  src: string; // Base64 data URL
  position: Position;
  size: Size;
  rotation: number; // degrees
  zIndex: number;
  createdAt: number;
}

export interface WhiteboardState {
  elements: ImageElement[];
  selectedElementId: string | null;
}

export interface Operation {
  type: 'add' | 'update' | 'delete';
  elementId: string;
  data?: Partial<ImageElement>;
  timestamp: number;
  isRealtime?: boolean; // 标记是否为实时操作（用于持久化但不广播）
}

export interface RoomData {
  roomId: string;
  state: WhiteboardState;
  operations: Operation[];
}

export interface ToolbarProps {
  selectedElement: ImageElement | null;
  onUploadImage: () => void;
  onDeleteElement: () => void;
  onCropStart: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  zoomLevel?: number;
}

export interface WhiteboardProps {
  roomId: string;
  initialState?: WhiteboardState;
}

export interface ImageEditorProps {
  element: ImageElement;
  isSelected: boolean;
  onLocalUpdate?: (updates: Partial<ImageElement>) => void;
  onRealtimeUpdate?: (updates: Partial<ImageElement>) => void;
  onFinalUpdate: (updates: Partial<ImageElement>) => void;
  onDelete: () => void;
  onCropStart: () => void;
  onSelect: () => void;
  canvasRef: React.RefObject<HTMLDivElement>;
  canvasScale?: number;
}
