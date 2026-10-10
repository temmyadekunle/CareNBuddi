"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/app-ui";
import { CheckIcon, CloseIcon, SettingsIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

type CropperProps = {
  imageSrc: string;
  onCrop: (dataUrl: string) => void;
  onCancel: () => void;
};

const OUTPUT_SIZE = 320;

export function ProfileCropper({ imageSrc, onCrop, onCancel }: CropperProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const imgLoadingRef = useRef(false);

  const canvasSize = 300;

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current || imgSize.width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const maxScale = Math.max(canvasSize / imgSize.width, canvasSize / imgSize.height);
    const minScale = Math.min(canvasSize / imgSize.width, canvasSize / imgSize.height);
    let currentScale = scale;
    if (currentScale < minScale) currentScale = minScale;
    if (currentScale > maxScale * 3) currentScale = maxScale * 3;

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.save();
    ctx.translate(canvasSize / 2, canvasSize / 2);
    ctx.scale(currentScale, currentScale);
    ctx.translate(position.x, position.y);
    ctx.drawImage(imgRef.current!, -imgSize.width / 2, -imgSize.height / 2, imgSize.width, imgSize.height);
    ctx.restore();
  }, [canvasSize, imgSize, scale, position]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    if (imgLoadingRef.current) return;
    imgLoadingRef.current = true;
    const img = new Image();
    img.onload = () => {
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
      setScale(1);
      setPosition({ x: 0, y: 0 });
      imgLoadingRef.current = false;
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDrag({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDrag({ x: e.clientX, y: e.clientY });
    };
    const handleUp = () => setDrag(null);
    if (drag) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [drag]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => {
      const next = prev * (e.deltaY > 0 ? 0.9 : 1.1);
      return Math.max(0.1, Math.min(10, next));
    });
  };

  const handleRotate = () => {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imgSize.height;
    tempCanvas.height = imgSize.width;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.translate(imgSize.height / 2, imgSize.width / 2);
    tempCtx.rotate(Math.PI / 2);
    tempCtx.drawImage(imgRef.current!, -imgSize.width / 2, -imgSize.height / 2);

    setImgSize({ width: imgSize.height, height: imgSize.width });
    const newImageSrc = tempCanvas.toDataURL("image/jpeg", 0.82);
    imgRef.current!.src = newImageSrc;
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = OUTPUT_SIZE;
    outputCanvas.height = OUTPUT_SIZE;
    const outputCtx = outputCanvas.getContext("2d")!;

    const scaleRatio = OUTPUT_SIZE / canvasSize;
    outputCtx.scale(scaleRatio, scaleRatio);
    outputCtx.drawImage(canvas, 0, 0);

    const dataUrl = outputCanvas.toDataURL("image/jpeg", 0.82);
    onCrop(dataUrl);
  };

  const handleRotateReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-2xl overflow-hidden max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t("prof_crop_title", "Crop your photo")}</h2>
          <Button tone="ghost" onClick={onCancel} aria-label={t("prof_cancel", "Cancel")}>
            <CloseIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4">
          <div
            className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden touch-none"
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            onTouchStart={(e) => {
              if (e.touches[0]) setDrag({ x: e.touches[0].clientX, y: e.touches[0].clientY });
            }}
            onTouchMove={(e) => {
              if (!drag || !e.touches[0]) return;
              const dx = e.touches[0].clientX - drag.x;
              const dy = e.touches[0].clientY - drag.y;
              setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
              setDrag({ x: e.touches[0].clientX, y: e.touches[0].clientY });
              e.preventDefault();
            }}
            onTouchEnd={() => setDrag(null)}
          >
            <canvas
              ref={canvasRef}
              width={canvasSize}
              height={canvasSize}
              className="absolute inset-0 w-full h-full"
            />
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
            />
            <div className="absolute inset-0 border-4 border-white/50 pointer-events-none" />
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            <Button tone="secondary" onClick={handleRotate} className="min-h-9 px-3">
              <SettingsIcon className="h-4 w-4" />
              <span>{t("prof_rotate", "Rotate")}</span>
            </Button>
            <Button tone="secondary" onClick={handleRotateReset} className="min-h-9 px-3">
              {t("prof_reset", "Reset")}
            </Button>
            <div className="flex-1" />
            <Button tone="secondary" onClick={onCancel} className="min-h-9 px-3">
              {t("prof_cancel", "Cancel")}
            </Button>
            <Button onClick={handleSave} className="min-h-9 px-3">
              <CheckIcon className="h-4 w-4 mr-1" />
              {t("prof_crop_save", "Save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}