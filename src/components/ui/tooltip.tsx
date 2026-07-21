"use client";

import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type TooltipSide = "top" | "bottom";

const VIEWPORT_MARGIN = 8;
const TOOLTIP_GAP = 8;

type TooltipProps = {
  content: string;
  side?: TooltipSide;
  className?: string;
  bubbleClassName?: string;
  children: ReactNode;
};

function isPositionedClass(className?: string) {
  if (!className) return false;
  return /\b(absolute|fixed|sticky)\b/.test(className);
}

function measureBubble(bubble: HTMLElement): DOMRect {
  const prev = bubble.style.cssText;
  bubble.style.cssText =
    "position:fixed;top:-999rem;left:0;visibility:hidden;opacity:1;pointer-events:none;";
  const rect = bubble.getBoundingClientRect();
  bubble.style.cssText = prev;
  return rect;
}

function computeBubbleStyle(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferredSide: TooltipSide,
): CSSProperties {
  const needsHeight = tooltipRect.height + TOOLTIP_GAP;
  const spaceAbove = triggerRect.top - VIEWPORT_MARGIN;
  const spaceBelow = window.innerHeight - triggerRect.bottom - VIEWPORT_MARGIN;

  let placeAbove = preferredSide === "top";
  if (placeAbove && spaceAbove < needsHeight && spaceBelow >= needsHeight) {
    placeAbove = false;
  } else if (!placeAbove && spaceBelow < needsHeight && spaceAbove >= needsHeight) {
    placeAbove = true;
  }

  const top = placeAbove
    ? triggerRect.top - tooltipRect.height - TOOLTIP_GAP
    : triggerRect.bottom + TOOLTIP_GAP;

  let left =
    triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;

  if (left + tooltipRect.width > window.innerWidth - VIEWPORT_MARGIN) {
    left = triggerRect.right - tooltipRect.width;
  }
  if (left < VIEWPORT_MARGIN) {
    left = VIEWPORT_MARGIN;
  }

  return { position: "fixed", top, left, zIndex: 9999 };
}

/** Hover/focus tooltip — bubble is portaled; trigger layout stays unchanged. */
export function Tooltip({
  content,
  side = "top",
  className,
  bubbleClassName,
  children,
}: TooltipProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [bubbleStyle, setBubbleStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const positioned = isPositionedClass(className);

  const reposition = useCallback(() => {
    const trigger = rootRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = measureBubble(bubble);
    setBubbleStyle(computeBubbleStyle(triggerRect, tooltipRect, side));
  }, [side]);

  const show = useCallback(() => {
    reposition();
    setOpen(true);
  }, [reposition]);

  const hide = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, content, reposition]);

  useEffect(() => {
    if (!open) return;
    const onViewportChange = () => reposition();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, reposition]);

  const bubble = (
    <span
      ref={bubbleRef}
      role="tooltip"
      className={clsx(
        "pointer-events-none whitespace-nowrap",
        bubbleClassName ?? "tooltip-bubble",
        open ? "tooltip-bubble-open opacity-100" : "opacity-0",
      )}
      style={bubbleStyle}
    >
      {content}
    </span>
  );

  return (
    <span
      ref={rootRef}
      className={clsx(
        positioned ? className : ["relative inline-flex", className],
      )}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocusCapture={show}
      onBlurCapture={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) hide();
      }}
    >
      {children}
      {mounted ? createPortal(bubble, document.body) : null}
    </span>
  );
};
