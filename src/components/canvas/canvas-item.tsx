"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import type { DraggableData, ResizableDelta } from "react-rnd";
import type { DraggableEvent } from "react-draggable";
// Inline ResizeDirection type since react-rnd does not export it
import clsx from "clsx";
import Image from "next/image";
import type {
  BoardElement,
  DateElement,
  EmojiElement,
  ImageElement,
  StickerElement,
  TextElement,
  FrameStyle,
  TextureStyle,
  ThemeFilter,
} from "./types";

type CanvasItemProps = {
  element: BoardElement;
  selected: boolean;
  shiftPressed: boolean;
  onSelect: (id: string) => void;
  onBringToFront: (id: string) => void;
  onChange: (id: string, updates: Partial<BoardElement>) => void;
  onDelete: (id: string) => void;
};

const handleStyle = (visible: boolean): React.CSSProperties => ({
  width: "0.875rem",
  height: "0.875rem",
  borderRadius: "9999px",
  border: "1px solid var(--color-border-emphasis)",
  background: visible
    ? "var(--color-surface-base) url('/Images/resize.svg') center/70% no-repeat"
    : "var(--color-surface-base)",
  boxShadow: "none",
  opacity: visible ? 1 : 0,
  transition: "opacity 0.12s ease",
});

const FRAME_STYLE_MAP: Record<
  FrameStyle,
  { outer: string; inner: string; image: string }
> = {
  none: { outer: "flex h-full w-full items-center justify-center", inner: "relative h-full w-full", image: "" },
  polaroid: {
    outer:
      "flex h-full w-full flex-col items-center justify-start rounded-[22px] bg-[var(--k-surface)] px-4 pt-4 pb-12 shadow-none",
    inner: "relative h-full w-full overflow-hidden rounded-[14px] bg-[var(--k-surface)]",
    image: "object-cover",
  },
  rounded: {
    outer:
      "flex h-full w-full items-center justify-center rounded-3xl bg-[var(--k-surface)] p-4 shadow-none",
    inner: "relative h-full w-full overflow-hidden rounded-2xl bg-[var(--k-surface)]",
    image: "object-cover",
  },
  taped: {
    outer:
      "relative flex h-full w-full items-center justify-center rounded-2xl bg-[var(--k-surface)] p-4 shadow-none",
    inner: "relative h-full w-full overflow-hidden rounded-xl bg-[var(--k-surface)]",
    image: "object-cover",
  },
};

const TEXTURE_OVERLAY_MAP: Record<
  TextureStyle,
  { backgroundImage?: string; mixBlendMode?: React.CSSProperties["mixBlendMode"]; baseOpacity: number }
> = {
  none: { baseOpacity: 0 },
  noise: {
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(30,30,30,0.18) 0px, rgba(30,30,30,0.18) 1px, transparent 1px, transparent 2px), repeating-linear-gradient(90deg, rgba(30,30,30,0.12) 0px, rgba(30,30,30,0.12) 1px, transparent 1px, transparent 3px)",
    mixBlendMode: "soft-light",
    baseOpacity: 0.35,
  },
  grain: {
    backgroundImage:
      "repeating-linear-gradient(45deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 4px)",
    mixBlendMode: "multiply",
    baseOpacity: 0.28,
  },
  paper: {
    backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.6), rgba(0,0,0,0.2))",
    mixBlendMode: "overlay",
    baseOpacity: 0.3,
  },
};

const FILTER_STYLES: Record<ThemeFilter, string> = {
  none: "none",
  tone3: "contrast(1.05) saturate(1.15) sepia(0.08)",
  pastel: "saturate(0.92) brightness(1.05)",
  glow: "brightness(1.15) contrast(0.95) saturate(1.1)",
};


function CanvasItem({
  element,
  selected,
  shiftPressed,
  onSelect,
  onBringToFront,
  onChange,
  onDelete,
}: CanvasItemProps) {
  const isText = element.kind === "text";
  const isDate = element.kind === "date";
  const isEmoji = element.kind === "emoji";
  const isSticker = element.kind === "sticker";
  const isImage = element.kind === "image";
  const isTextLike = isText || isDate;
  const isVisualMedia = isImage || isSticker;
  const imageElement = isImage ? (element as ImageElement) : null;
  const stickerElement = isSticker ? (element as StickerElement) : null;

  const [isEditing, setIsEditing] = useState(false);
  const getInitialText = useCallback(() => {
    if (isText) return (element as TextElement).text;
    if (isDate) return (element as DateElement).label;
    return "";
  }, [element, isDate, isText]);

  const [draftText, setDraftText] = useState(getInitialText);

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rotationContextRef = useRef<{ startAngle: number; baseRotation: number } | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    if (isTextLike && !isEditing) {
      setDraftText(getInitialText());
    }
  }, [element, getInitialText, isEditing, isTextLike]);

  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.focus();
      textAreaRef.current.select();
    }
  }, [isEditing]);

  const enableResizing = useMemo(() => {
    if (!isVisualMedia) return false;
    if (isEditing) return false;
    return {
      top: false,
      right: false,
      bottom: false,
      left: false,
      topLeft: false,
      topRight: false,
      bottomLeft: true,
      bottomRight: false,
    };
  }, [isEditing, isVisualMedia]);

  const handleStyles = useMemo(() => {
    const visible = selected && !isEditing;
    const base = handleStyle(visible);
    return !isVisualMedia
      ? {}
      : {
          bottomLeft: base,
        };
  }, [isEditing, isVisualMedia, selected]);

  const handleDragStop = useCallback(
    (_event: DraggableEvent, data: DraggableData) => {
      onChange(element.id, { x: data.x, y: data.y });
    },
    [element.id, onChange]
  );

  const handleResizeStop = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      _dir: ResizeDirection,
      ref: HTMLElement,
      _delta: ResizableDelta,
      position: { x: number; y: number }
    ) => {
      onChange(element.id, {
        w: parseFloat(ref.style.width),
        h: parseFloat(ref.style.height),
        x: position.x,
        y: position.y,
      });
    },
    [element.id, onChange]
  );

  const handleDelete = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onDelete(element.id);
    },
    [element.id, onDelete]
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      if (isTextLike) {
        onBringToFront(element.id);
        setIsEditing(true);
      }
    },
    [element.id, isTextLike, onBringToFront]
  );

  const handleTextBlur = useCallback(() => {
    if (!isTextLike) return;
    if (isText) {
      onChange(element.id, { text: draftText });
    } else if (isDate) {
      onChange(element.id, { label: draftText });
    }
    setIsEditing(false);
  }, [draftText, element.id, isDate, isText, isTextLike, onChange]);

  const handleTextKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleTextBlur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setDraftText(getInitialText());
        setIsEditing(false);
      }
    },
    [getInitialText, handleTextBlur]
  );

  const handleRotationPointerMove = useCallback(
    (event: PointerEvent) => {
      const context = rotationContextRef.current;
      const container = containerRef.current;
      if (!context || !container) return;

      event.preventDefault();

      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
      let rotation =
        context.baseRotation + ((angle - context.startAngle) * 180) / Math.PI;

      if (!Number.isFinite(rotation)) {
        return;
      }

      if (shiftPressed) {
        rotation = Math.round(rotation / 15) * 15;
      }

      if (rotation > 180 || rotation < -180) {
        rotation = ((rotation + 180) % 360 + 360) % 360 - 180;
      }

      onChange(element.id, { rotation });
    },
    [element.id, onChange, shiftPressed]
  );

  const handleRotationPointerUp = useCallback(() => {
    rotationContextRef.current = null;
    setIsRotating(false);
    window.removeEventListener("pointermove", handleRotationPointerMove);
    window.removeEventListener("pointerup", handleRotationPointerUp);
  }, [handleRotationPointerMove]);

  const handleRotationPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!containerRef.current) return;

      onBringToFront(element.id);
      onSelect(element.id);

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);

      rotationContextRef.current = {
        startAngle,
        baseRotation: element.rotation ?? 0,
      };
      setIsRotating(true);

      window.addEventListener("pointermove", handleRotationPointerMove);
      window.addEventListener("pointerup", handleRotationPointerUp);
    },
    [element.id, element.rotation, handleRotationPointerMove, handleRotationPointerUp, onBringToFront, onSelect]
  );

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", handleRotationPointerMove);
      window.removeEventListener("pointerup", handleRotationPointerUp);
      rotationContextRef.current = null;
    },
    [handleRotationPointerMove, handleRotationPointerUp]
  );

  const lockAspectRatio = isVisualMedia && !shiftPressed && !isEditing && !isRotating;

  const imageFrame = imageElement?.frame ?? "none";
  const frameStyle = FRAME_STYLE_MAP[imageFrame];
  const imageTexture = imageElement?.texture ?? "none";
  const textureConfig = TEXTURE_OVERLAY_MAP[imageTexture];
  const textureIntensity = imageElement
    ? Math.min(Math.max(imageElement.textureIntensity ?? 0.4, 0), 1)
    : 0;
  const textureStyle =
    imageElement && imageTexture !== "none" && textureConfig.backgroundImage
      ? {
          backgroundImage: textureConfig.backgroundImage,
          mixBlendMode: textureConfig.mixBlendMode,
          opacity: textureConfig.baseOpacity * textureIntensity,
          pointerEvents: "none" as const,
        }
      : null;
  const elementFilter = imageElement
    ? FILTER_STYLES[imageElement.filter ?? "none"]
    : undefined;

  return (
    <Rnd
      className="canvas-item"
      bounds="parent"
      size={{ width: element.w, height: element.h }}
      position={{ x: element.x, y: element.y }}
      disableDragging={isEditing || isRotating}
      enableResizing={enableResizing}
      resizeHandleStyles={handleStyles}
      lockAspectRatio={lockAspectRatio}
      onDragStart={() => {
        onBringToFront(element.id);
        onSelect(element.id);
      }}
      onDragStop={handleDragStop}
      onResizeStart={() => {
        onBringToFront(element.id);
        onSelect(element.id);
      }}
      onResizeStop={handleResizeStop}
      style={{ zIndex: element.z }}
      onClick={(event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        onSelect(element.id);
      }}
    >
      <div
        ref={containerRef}
        className={clsx(
          "relative h-full w-full border border-transparent transition",
          selected ? "border-[var(--k-primary)]" : "border-transparent"
        )}
        style={{
          transform: `rotate(${element.rotation ?? 0}deg)`,
          transformOrigin: "center",
        }}
        onDoubleClick={handleDoubleClick}
      >
        {isTextLike && (
          <>
            <div
              className={clsx(
                "flex h-[fit-content] w-[fit-content] cursor-text select-text break-words px-3 py-2 text-sm leading-snug text-[var(--k-text)]",
                isEditing && "opacity-0"
              )}
              style={{
                justifyContent:
                  (isText ? (element as TextElement).align : (element as DateElement).align) ===
                  "center"
                    ? "center"
                    : (isText
                        ? (element as TextElement).align
                        : (element as DateElement).align) === "right"
                    ? "flex-end"
                    : "flex-start",
                textAlign: isText
                  ? (element as TextElement).align
                  : (element as DateElement).align,
                color: isText
                  ? (element as TextElement).color ?? "var(--k-text)"
                  : (element as DateElement).color ?? "var(--k-text)",
                fontSize: isText
                  ? (element as TextElement).fontSize
                  : (element as DateElement).fontSize,
                fontFamily: isText
                  ? (element as TextElement).fontFamily ?? "var(--k-font)"
                  : (element as DateElement).fontFamily ?? "var(--k-font)",
                fontWeight: isText
                  ? (element as TextElement).weight
                  : (element as DateElement).weight,
                fontStyle: isText && (element as TextElement).italic ? "italic" : undefined,
              }}
            >
              {isText
                ? (element as TextElement).text || "Double-click to edit"
                : (element as DateElement).label || "Double-click to edit"}
            </div>

            {isEditing && (
              <textarea
                ref={textAreaRef}
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onBlur={handleTextBlur}
                onKeyDown={handleTextKeyDown}
                className="absolute inset-0 h-[fit-content] w-[fit-content] resize-none rounded-xl border border-[var(--k-primary)] bg-[var(--k-surface)] px-3 py-2 text-sm leading-snug text-[var(--k-text)] outline-none shadow-lg"
              />
            )}
          </>
        )}

        {isEmoji && (
          <div className="flex h-full w-full items-center justify-center p-2 text-center">
            <span
              className="select-none"
              style={{
                fontSize: (element as EmojiElement).fontSize,
                lineHeight: 1,
              }}
            >
              {(element as EmojiElement).emoji}
            </span>
          </div>
        )}

        {stickerElement && (
          <div className="pointer-events-none relative flex h-full w-full items-center justify-center select-none">
            <Image
              src={stickerElement.src}
              alt="Canvas asset"
              fill
              className="pointer-events-none select-none object-contain"
              draggable={false}
              unoptimized
            />
          </div>
        )}

        {imageElement && (
          <div
            className={clsx(
              "pointer-events-none relative h-full w-full select-none",
              frameStyle.outer
            )}
          >
            <div className={clsx(frameStyle.inner)}>
              <Image
                src={imageElement.src}
                alt="Canvas asset"
                fill
                className={clsx(
                  "pointer-events-none select-none h-full w-full object-contain",
                  frameStyle.image
                )}
                draggable={false}
                unoptimized
                style={{ filter: elementFilter }}
              />

              {textureStyle && (
                <div className="pointer-events-none absolute inset-0" style={textureStyle} />
              )}
            </div>

            {imageFrame === "taped" && (
              <>
                <span className="pointer-events-none absolute -top-6 left-8 h-8 w-[5rem] rotate-[-10deg] rounded bg-amber-200/90 shadow-sm" />
                <span className="pointer-events-none absolute -top-5 right-10 h-8 w-[5rem] rotate-[7deg] rounded bg-amber-100/90 shadow-sm" />
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleDelete}
          className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--k-subtle)] bg-[var(--k-surface)] text-xs font-bold text-[var(--k-text)] shadow-md transition hover:scale-105"
          aria-label="Delete element"
        >
          ×
        </button>

        {isVisualMedia && selected && !isEditing && (
          <button
            type="button"
            aria-label="Rotate element"
            className={clsx(
              "absolute -bottom-4 -right-4 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--k-primary)] bg-[var(--k-surface)] text-[var(--k-primary)] shadow-md transition",
              isRotating ? "scale-110" : "hover:scale-105"
            )}
            onPointerDown={handleRotationPointerDown}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M3 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d="M5.64 18.36A9 9 0 0 0 12 21a9 9 0 0 0 9-9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18.36 5.64A9 9 0 0 0 12 3a9 9 0 0 0-9 9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

      </div>
    </Rnd>
  );
}

export default React.memo(CanvasItem);

type ResizeDirection =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";
