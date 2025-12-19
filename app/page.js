"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

const WHITEBOARD_SIZE = 20000;
const MAX_UPLOAD_SIZE = 1000;

const TOOLS = {
  PAN: "pan",
  MOVE: "move",
  ERASE: "erase",
  CROP: "crop",
};

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export default function Home() {
  const canvasRef = useRef(null);
  const boardRef = useRef(null);
  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTool, setActiveTool] = useState(TOOLS.MOVE);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [viewScale, setViewScale] = useState(0.1);
  const [viewOffset, setViewOffset] = useState({ x: 20, y: 20 });
  const dragInfoRef = useRef(null);
  const eraseInfoRef = useRef(null);
  const panInfoRef = useRef(null);
  const [cropInfo, setCropInfo] = useState(null);

  const selectedImage = useMemo(
    () => images.find((img) => img.id === selectedId) || null,
    [images, selectedId]
  );

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WHITEBOARD_SIZE, WHITEBOARD_SIZE);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, WHITEBOARD_SIZE, WHITEBOARD_SIZE);

    images.forEach((img) => {
      if (!img.canvas) return;
      const { x, y, width, height, scale, rotation, id } = img;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(degToRad(rotation));
      ctx.scale(scale, scale);
      ctx.drawImage(img.canvas, -width / 2, -height / 2);

      if (id === selectedId) {
        ctx.strokeStyle = "#0f766e";
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([10 / scale, 6 / scale]);
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        ctx.setLineDash([]);
      }

      ctx.restore();
    });

    if (cropInfo && cropInfo.active && selectedImage) {
      const { start, current } = cropInfo;
      const img = selectedImage;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const lx1 = Math.min(start.x, current.x);
      const ly1 = Math.min(start.y, current.y);
      const lx2 = Math.max(start.x, current.x);
      const ly2 = Math.max(start.y, current.y);

      ctx.save();
      ctx.translate(img.x, img.y);
      ctx.rotate(degToRad(img.rotation));
      ctx.scale(img.scale, img.scale);
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 2 / img.scale;
      ctx.setLineDash([6 / img.scale, 4 / img.scale]);
      ctx.strokeRect(
        lx1 - img.width / 2,
        ly1 - img.height / 2,
        lx2 - lx1,
        ly2 - ly1
      );
      ctx.restore();
    }
  }, [images, selectedId, cropInfo, selectedImage]);

  useEffect(() => {
    drawAll();
  }, [drawAll]);

  const createImageObject = (canvas, width, height) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
      id,
      canvas,
      width,
      height,
      x: WHITEBOARD_SIZE / 2,
      y: WHITEBOARD_SIZE / 2,
      scale: 1,
      rotation: 0,
    };
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width > MAX_UPLOAD_SIZE || height > MAX_UPLOAD_SIZE) {
        alert(
          `Image is too large. Max allowed size is ${MAX_UPLOAD_SIZE}x${MAX_UPLOAD_SIZE}px.`
        );
        URL.revokeObjectURL(url);
        return;
      }

      const offCanvas = document.createElement("canvas");
      offCanvas.width = width;
      offCanvas.height = height;
      const offCtx = offCanvas.getContext("2d");
      if (!offCtx) {
        URL.revokeObjectURL(url);
        return;
      }
      offCtx.drawImage(img, 0, 0);

      const newImg = createImageObject(offCanvas, width, height);
      setImages((prev) => [...prev, newImg]);
      setSelectedId(newImg.id);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      alert("Failed to load image.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
    event.target.value = "";
  };

  const canvasToLocal = (img, point) => {
    const dx = point.x - img.x;
    const dy = point.y - img.y;
    const r = degToRad(img.rotation);
    const cos = Math.cos(-r);
    const sin = Math.sin(-r);
    const sx = (dx * cos - dy * sin) / img.scale;
    const sy = (dx * sin + dy * cos) / img.scale;
    return {
      x: sx + img.width / 2,
      y: sy + img.height / 2,
    };
  };

  const isPointInsideImage = (img, point) => {
    const local = canvasToLocal(img, point);
    return (
      local.x >= 0 &&
      local.y >= 0 &&
      local.x <= img.width &&
      local.y <= img.height
    );
  };

  const findTopImageAtPoint = (point) => {
    for (let i = images.length - 1; i >= 0; i -= 1) {
      const img = images[i];
      if (isPointInsideImage(img, point)) {
        return img;
      }
    }
    return null;
  };

  const updateImageById = (id, updater) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...updater(img) } : img))
    );
  };

  const beginPan = (event) => {
    setIsPanning(true);
    panInfoRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: viewOffset.x,
      originY: viewOffset.y,
    };
  };

  const handleWheel = (event) => {
    const wrapper = boardRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    event.preventDefault();

    const rect = wrapper.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;

    setViewScale((prevScale) => {
      const scaleStep = Math.exp(-event.deltaY * 0.0015);
      const next = Math.min(3, Math.max(0.02, prevScale * scaleStep));
      const oldScale = prevScale;
      const worldX = (screenX - viewOffset.x) / oldScale;
      const worldY = (screenY - viewOffset.y) / oldScale;
      setViewOffset({
        x: screenX - worldX * next,
        y: screenY - worldY * next,
      });
      return next;
    });
  };

  const handlePointerDown = (event) => {
    if (activeTool === TOOLS.PAN || event.button === 1) {
      beginPan(event);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x =
      ((event.clientX - rect.left) / rect.width) * canvas.width || 0;
    const y =
      ((event.clientY - rect.top) / rect.height) * canvas.height || 0;

    const point = { x, y };
    const targetImg = findTopImageAtPoint(point);
    if (targetImg) {
      setSelectedId(targetImg.id);
    }

    if (!targetImg) {
      setIsPointerDown(false);
      dragInfoRef.current = null;
      eraseInfoRef.current = null;
      return;
    }

    if (activeTool === TOOLS.MOVE) {
      setIsPointerDown(true);
      dragInfoRef.current = {
        id: targetImg.id,
        offsetX: x - targetImg.x,
        offsetY: y - targetImg.y,
      };
    } else if (activeTool === TOOLS.ERASE && targetImg.id === selectedId) {
      setIsPointerDown(true);
      const local = canvasToLocal(targetImg, point);
      eraseInfoRef.current = {
        id: targetImg.id,
        last: local,
      };
      applyEraseStroke(targetImg.id, local, local);
    } else if (activeTool === TOOLS.CROP && targetImg.id === selectedId) {
      setIsPointerDown(true);
      const local = canvasToLocal(targetImg, point);
      setCropInfo({
        id: targetImg.id,
        start: local,
        current: local,
        active: true,
      });
    }
  };

  const applyEraseStroke = (id, from, to) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.id !== id || !img.canvas) return img;
        const offCanvas = img.canvas;
        const ctx = offCanvas.getContext("2d");
        if (!ctx) return img;
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
        return img;
      })
    );
  };

  const finalizeCrop = () => {
    if (!cropInfo || !cropInfo.active) return;
    const img = images.find((i) => i.id === cropInfo.id);
    if (!img || !img.canvas) {
      setCropInfo(null);
      return;
    }

    const { start, current } = cropInfo;
    const x1 = Math.max(0, Math.min(start.x, current.x));
    const y1 = Math.max(0, Math.min(start.y, current.y));
    const x2 = Math.min(img.width, Math.max(start.x, current.x));
    const y2 = Math.min(img.height, Math.max(start.y, current.y));
    const cropWidth = x2 - x1;
    const cropHeight = y2 - y1;

    if (cropWidth < 10 || cropHeight < 10) {
      setCropInfo(null);
      return;
    }

    const newCanvas = document.createElement("canvas");
    newCanvas.width = cropWidth;
    newCanvas.height = cropHeight;
    const nctx = newCanvas.getContext("2d");
    if (!nctx) {
      setCropInfo(null);
      return;
    }
    nctx.drawImage(
      img.canvas,
      x1,
      y1,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    setImages((prev) =>
      prev.map((item) =>
        item.id === img.id
          ? {
              ...item,
              canvas: newCanvas,
              width: cropWidth,
              height: cropHeight,
            }
          : item
      )
    );
    setCropInfo(null);
  };

  const handlePointerMove = (event) => {
    if (!isPointerDown) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x =
      ((event.clientX - rect.left) / rect.width) * canvas.width || 0;
    const y =
      ((event.clientY - rect.top) / rect.height) * canvas.height || 0;
    const point = { x, y };

    if (activeTool === TOOLS.MOVE && dragInfoRef.current) {
      const { id, offsetX, offsetY } = dragInfoRef.current;
      setImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? {
                ...img,
                x: x - offsetX,
                y: y - offsetY,
              }
            : img
        )
      );
    } else if (activeTool === TOOLS.ERASE && eraseInfoRef.current) {
      const { id, last } = eraseInfoRef.current;
      const img = images.find((i) => i.id === id);
      if (!img) return;
      const local = canvasToLocal(img, point);
      applyEraseStroke(id, last, local);
      eraseInfoRef.current = { id, last: local };
    } else if (activeTool === TOOLS.CROP && cropInfo && cropInfo.active) {
      const img = images.find((i) => i.id === cropInfo.id);
      if (!img) return;
      const local = canvasToLocal(img, point);
      setCropInfo((prev) =>
        prev
          ? {
              ...prev,
              current: local,
            }
          : prev
      );
    }
  };

  const handlePointerUp = () => {
    setIsPointerDown(false);
    dragInfoRef.current = null;
    eraseInfoRef.current = null;
    if (activeTool === TOOLS.CROP) {
      finalizeCrop();
    }
    if (isPanning) {
      setIsPanning(false);
      panInfoRef.current = null;
    }
  };

  const handleScaleChange = (event) => {
    if (!selectedImage) return;
    const value = Number(event.target.value);
    const clamped = Math.min(3, Math.max(0.1, value));
    updateImageById(selectedImage.id, () => ({
      scale: clamped,
    }));
  };

  const handleRotationChange = (event) => {
    if (!selectedImage) return;
    const value = Number(event.target.value);
    updateImageById(selectedImage.id, () => ({
      rotation: value,
    }));
  };

  const clearBoard = () => {
    setImages([]);
    setSelectedId(null);
    setCropInfo(null);
  };

  const handleGlobalPointerMove = (event) => {
    if (isPanning && panInfoRef.current) {
      const { startX, startY, originX, originY } = panInfoRef.current;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      setViewOffset({
        x: originX + dx,
        y: originY + dy,
      });
      return;
    }
    handlePointerMove(event);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logoMark}>M</span>
          <div>
            <h1 className={styles.title}>Marknota Collaborative Whiteboard</h1>
            <p className={styles.subtitle}>
              Upload and edit images together on a massive 20,000 × 20,000
              pixel canvas.
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <label className={styles.uploadButton}>
            <span>Upload image (max 1000×1000)</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </label>
          <button
            type="button"
            className={styles.clearButton}
            onClick={clearBoard}
          >
            Clear board
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.sidebar}>
          <div className={styles.toolbarSection}>
            <h2 className={styles.sectionTitle}>Tools</h2>
            <div className={styles.toolButtons}>
              <button
                type="button"
                className={`${styles.toolButton} ${
                  activeTool === TOOLS.PAN ? styles.toolButtonActive : ""
                }`}
                onClick={() => setActiveTool(TOOLS.PAN)}
              >
                Pan view
              </button>
              <button
                type="button"
                className={`${styles.toolButton} ${
                  activeTool === TOOLS.MOVE ? styles.toolButtonActive : ""
                }`}
                onClick={() => setActiveTool(TOOLS.MOVE)}
              >
                Move
              </button>
              <button
                type="button"
                className={`${styles.toolButton} ${
                  activeTool === TOOLS.ERASE ? styles.toolButtonActive : ""
                }`}
                onClick={() => setActiveTool(TOOLS.ERASE)}
              >
                Erase
              </button>
              <button
                type="button"
                className={`${styles.toolButton} ${
                  activeTool === TOOLS.CROP ? styles.toolButtonActive : ""
                }`}
                onClick={() => setActiveTool(TOOLS.CROP)}
              >
                Crop
              </button>
            </div>
            <p className={styles.helperText}>
              Select an image by tapping or clicking it on the board.
            </p>
          </div>

          <div className={styles.toolbarSection}>
            <h2 className={styles.sectionTitle}>Selected image</h2>
            {selectedImage ? (
              <div className={styles.controls}>
                <div className={styles.controlGroup}>
                  <label className={styles.controlLabel}>
                    Scale ({selectedImage.scale.toFixed(2)}×)
                  </label>
                  <input
                    type="range"
                    min="0.2"
                    max="3"
                    step="0.05"
                    value={selectedImage.scale}
                    onChange={handleScaleChange}
                  />
                </div>
                <div className={styles.controlGroup}>
                  <label className={styles.controlLabel}>
                    Rotation ({selectedImage.rotation.toFixed(0)}°)
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={selectedImage.rotation}
                    onChange={handleRotationChange}
                  />
                </div>
              </div>
            ) : (
              <p className={styles.helperText}>
                No image selected. Upload an image and click it on the
                whiteboard to start editing.
              </p>
            )}
          </div>

          <div className={styles.toolbarSection}>
            <h2 className={styles.sectionTitle}>How it works</h2>
            <ol className={styles.howToList}>
              <li>Upload an image up to 1000×1000 pixels.</li>
              <li>Click the image to select it.</li>
              <li>Use Move, Erase, and Crop tools directly on the canvas.</li>
              <li>Adjust scale and rotation from the controls above.</li>
            </ol>
          </div>
        </section>

        <section className={styles.boardSection}>
          <div
            ref={boardRef}
            className={`${styles.boardWrapper} ${
              isPanning || activeTool === TOOLS.PAN
                ? styles.boardWrapperPan
                : ""
            }`}
            onWheel={handleWheel}
            onPointerMove={handleGlobalPointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              width={WHITEBOARD_SIZE}
              height={WHITEBOARD_SIZE}
              style={{
                width: "100%",
                height: "100%",
                transformOrigin: "0 0",
                transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${viewScale})`,
              }}
              onPointerDown={handlePointerDown}
            />
          </div>
          <p className={styles.boardHint}>
            Use wheel or trackpad to zoom; choose Pan view (or middle mouse) to
            grab and move the canvas. The board is 20,000 × 20,000 pixels.
          </p>
        </section>
      </main>
    </div>
  );
}
