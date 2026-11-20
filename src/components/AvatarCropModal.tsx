import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Crop, RotateCw, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AvatarCropModalProps {
  file: File;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void | Promise<void>;
}

const VIEW_SIZE = 280;
const CROP_MARGIN = 20;
const CROP_SIZE = VIEW_SIZE - CROP_MARGIN * 2; // 240x240 inner crop frame
const OUTPUT_SIZE = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  file,
  busy = false,
  onCancel,
  onConfirm,
}) => {
  const { t, dir } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const [imageReady, setImageReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);

  const getGeometry = useCallback(
    (img: HTMLImageElement, nextZoom: number, nextRotation: 0 | 90 | 180 | 270) => {
      const natW = Math.max(1, img.naturalWidth);
      const natH = Math.max(1, img.naturalHeight);
      const rotated = nextRotation === 90 || nextRotation === 270;
      const effW = rotated ? natH : natW;
      const effH = rotated ? natW : natH;
      const baseScale = Math.max(CROP_SIZE / effW, CROP_SIZE / effH);
      const scale = baseScale * nextZoom;
      const drawW = effW * scale;
      const drawH = effH * scale;
      const maxOffsetX = Math.max(0, (drawW - CROP_SIZE) / 2);
      const maxOffsetY = Math.max(0, (drawH - CROP_SIZE) / 2);
      return { natW, natH, scale, maxOffsetX, maxOffsetY };
    },
    []
  );

  // Load File into HTMLImageElement via Object URL
  useEffect(() => {
    setImageReady(false);
    setLoadError(null);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageReady(true);
    };
    img.onerror = () => {
      imageRef.current = null;
      setLoadError(t.profile.invalidImageType);
    };
    img.src = objectUrl;

    return () => {
      imageRef.current = null;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, t.profile.invalidImageType]);

  // Draw interactive canvas preview whenever transform state updates
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageReady) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const pixelSize = Math.round(VIEW_SIZE * dpr);
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
      canvas.width = pixelSize;
      canvas.height = pixelSize;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { natW, natH, scale, maxOffsetX, maxOffsetY } = getGeometry(img, zoom, rotation);
    const clampedX = clamp(offset.x, -maxOffsetX, maxOffsetX);
    const clampedY = clamp(offset.y, -maxOffsetY, maxOffsetY);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE);

    // Subtle dark backdrop behind image
    ctx.fillStyle = '#181414';
    ctx.fillRect(0, 0, VIEW_SIZE, VIEW_SIZE);

    // Transformed image centered + offset
    ctx.save();
    ctx.translate(VIEW_SIZE / 2 + clampedX, VIEW_SIZE / 2 + clampedY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (-natW * scale) / 2, (-natH * scale) / 2, natW * scale, natH * scale);
    ctx.restore();

    // Scrim outside inner crop square
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_SIZE, VIEW_SIZE);
    ctx.rect(CROP_MARGIN, CROP_MARGIN, CROP_SIZE, CROP_SIZE);
    ctx.fill('evenodd');
    ctx.restore();

    // Square crop frame & circular avatar guide
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(CROP_MARGIN + 0.5, CROP_MARGIN + 0.5, CROP_SIZE - 1, CROP_SIZE - 1);

    ctx.beginPath();
    ctx.arc(VIEW_SIZE / 2, VIEW_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#E5B742';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }, [getGeometry, imageReady, offset.x, offset.y, rotation, zoom]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Escape key closes modal safely
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy && !exporting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, exporting, onCancel]);

  const applyZoom = (nextRaw: number) => {
    const nextZoom = clamp(Number(nextRaw.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
    setZoom(nextZoom);
    const img = imageRef.current;
    if (img) {
      const { maxOffsetX, maxOffsetY } = getGeometry(img, nextZoom, rotation);
      setOffset((prev) => ({
        x: clamp(prev.x, -maxOffsetX, maxOffsetX),
        y: clamp(prev.y, -maxOffsetY, maxOffsetY),
      }));
    }
  };

  const handleRotate = () => {
    const nextRotation = ((rotation + 90) % 360) as 0 | 90 | 180 | 270;
    setRotation(nextRotation);
    const img = imageRef.current;
    if (img) {
      const { maxOffsetX, maxOffsetY } = getGeometry(img, zoom, nextRotation);
      setOffset((prev) => ({
        x: clamp(prev.x, -maxOffsetX, maxOffsetX),
        y: clamp(prev.y, -maxOffsetY, maxOffsetY),
      }));
    }
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imageReady || busy || exporting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStartRef.current;
    const img = imageRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !img) return;
    const dx = e.clientX - drag.clientX;
    const dy = e.clientY - drag.clientY;
    const { maxOffsetX, maxOffsetY } = getGeometry(img, zoom, rotation);
    setOffset({
      x: clamp(drag.startOffsetX + dx, -maxOffsetX, maxOffsetX),
      y: clamp(drag.startOffsetY + dy, -maxOffsetY, maxOffsetY),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragStartRef.current?.pointerId === e.pointerId) {
      dragStartRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!imageReady || busy || exporting) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.15 : -0.15;
    applyZoom(zoom + step);
  };

  const handleConfirm = async () => {
    const img = imageRef.current;
    if (!img || !imageReady || busy || exporting) return;
    setExporting(true);
    try {
      const { natW, natH, scale, maxOffsetX, maxOffsetY } = getGeometry(img, zoom, rotation);
      const clampedX = clamp(offset.x, -maxOffsetX, maxOffsetX);
      const clampedY = clamp(offset.y, -maxOffsetY, maxOffsetY);
      const outRatio = OUTPUT_SIZE / CROP_SIZE;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = OUTPUT_SIZE;
      outCanvas.height = OUTPUT_SIZE;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) throw new Error('Canvas is unavailable.');

      outCtx.fillStyle = '#FFFFFF';
      outCtx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      outCtx.save();
      outCtx.translate(
        OUTPUT_SIZE / 2 + clampedX * outRatio,
        OUTPUT_SIZE / 2 + clampedY * outRatio
      );
      outCtx.rotate((rotation * Math.PI) / 180);
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(
        img,
        (-natW * scale * outRatio) / 2,
        (-natH * scale * outRatio) / 2,
        natW * scale * outRatio,
        natH * scale * outRatio
      );
      outCtx.restore();

      const blob = await new Promise<Blob | null>((resolve) => {
        outCanvas.toBlob(
          (webpBlob) => {
            if (webpBlob) {
              resolve(webpBlob);
              return;
            }
            outCanvas.toBlob((jpegBlob) => resolve(jpegBlob), 'image/jpeg', 0.9);
          },
          'image/webp',
          0.88
        );
      });

      if (!blob) {
        throw new Error('Failed to export cropped image.');
      }

      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'avatar';
      const croppedFile = new File([blob], `${baseName}-cropped.${ext}`, {
        type: blob.type,
      });

      await onConfirm(croppedFile);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setExporting(false);
    }
  };

  const disabled = busy || exporting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
      dir={dir}
      onClick={() => {
        if (!disabled) onCancel();
      }}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E1A1A] border border-[#E6DFD5] dark:border-[#342D2D] p-5 sm:p-6 space-y-4 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E6DFD5] dark:border-[#342D2D] pb-3.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#F9EFF0] dark:bg-[#2B2022] border border-[#E6DFD5] dark:border-[#3A2E2E] flex items-center justify-center shrink-0">
              <Crop className="w-4 h-4 text-[#6B1118] dark:text-[#E5B742]" />
            </div>
            <div className="min-w-0">
              <h3
                id="avatar-crop-title"
                className="text-base font-bold text-[#1C1917] dark:text-[#F5EFE9]"
              >
                {t.profile.cropModalTitle}
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#B8AEA5] mt-0.5">
                {t.profile.cropModalSub}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={onCancel}
            aria-label={t.profile.cancel}
            className="p-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] dark:text-[#B8AEA5] dark:hover:text-white cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Crop Canvas */}
        {loadError ? (
          <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-6 text-center text-xs text-[#991B1B]">
            {loadError}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="rounded-2xl overflow-hidden border border-[#E6DFD5] dark:border-[#342D2D] shadow-inner bg-[#181414]">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
                style={{ width: VIEW_SIZE, height: VIEW_SIZE, touchAction: 'none' }}
                className="block cursor-grab active:cursor-grabbing select-none"
              />
            </div>

            {/* Zoom Control */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#B8AEA5]">
                <span className="font-semibold text-[#1C1917] dark:text-[#F5EFE9]">
                  {t.profile.zoomLabel}
                </span>
                <span className="tabular-nums font-medium">{Math.round(zoom * 100)}%</span>
              </div>
              <div className="flex items-center gap-2.5" dir="ltr">
                <button
                  type="button"
                  disabled={!imageReady || disabled || zoom <= MIN_ZOOM}
                  onClick={() => applyZoom(zoom - 0.2)}
                  aria-label="Zoom out"
                  className="p-2 rounded-lg border border-[#E6DFD5] dark:border-[#342D2D] bg-[#FAF8F5] dark:bg-[#272222] text-[#1C1917] dark:text-[#F5EFE9] hover:border-[#6B1118] disabled:opacity-40 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.05}
                  value={zoom}
                  disabled={!imageReady || disabled}
                  onChange={(e) => applyZoom(Number(e.target.value))}
                  aria-label={t.profile.zoomLabel}
                  className="flex-1 accent-[#6B1118] cursor-pointer"
                />
                <button
                  type="button"
                  disabled={!imageReady || disabled || zoom >= MAX_ZOOM}
                  onClick={() => applyZoom(zoom + 0.2)}
                  aria-label="Zoom in"
                  className="p-2 rounded-lg border border-[#E6DFD5] dark:border-[#342D2D] bg-[#FAF8F5] dark:bg-[#272222] text-[#1C1917] dark:text-[#F5EFE9] hover:border-[#6B1118] disabled:opacity-40 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rotate & Reset Buttons */}
            <div className="w-full flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={!imageReady || disabled}
                onClick={handleRotate}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E6DFD5] dark:border-[#342D2D] bg-[#FAF8F5] dark:bg-[#272222] px-3 py-2 text-xs font-semibold text-[#1C1917] dark:text-[#F5EFE9] hover:border-[#6B1118] disabled:opacity-50 cursor-pointer min-h-[38px]"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#6B1118] dark:text-[#E5B742]" />
                <span>{t.profile.rotateBtn}</span>
              </button>
              <button
                type="button"
                disabled={!imageReady || disabled}
                onClick={handleReset}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E6DFD5] dark:border-[#342D2D] bg-[#FAF8F5] dark:bg-[#272222] px-3 py-2 text-xs font-semibold text-[#57534E] dark:text-[#B8AEA5] hover:border-[#6B1118] disabled:opacity-50 cursor-pointer min-h-[38px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.profile.resetCropBtn}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6DFD5] dark:border-[#342D2D]">
          <button
            type="button"
            disabled={disabled}
            onClick={onCancel}
            className="rounded-xl border border-[#E6DFD5] dark:border-[#342D2D] px-4 py-2 text-xs font-semibold text-[#57534E] dark:text-[#B8AEA5] hover:text-[#1C1917] cursor-pointer min-h-[40px]"
          >
            {t.profile.cancel}
          </button>
          <button
            type="button"
            disabled={!imageReady || Boolean(loadError) || disabled}
            onClick={() => void handleConfirm()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer min-h-[40px]"
          >
            <Check className="w-4 h-4 text-[#E5B742]" />
            <span>{disabled ? t.profile.uploadingAvatar : t.profile.applyCropUploadBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
