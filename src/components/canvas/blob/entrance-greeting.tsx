"use client";

import clsx from "clsx";
import type { CSSProperties, RefObject } from "react";
import { useId, useLayoutEffect, useMemo, useState } from "react";
import {
  GREETING_BOTTOM_PCT,
  GREETING_COLOR,
  GREETING_FONT_FAMILY,
  GREETING_FONT_SIZE_PX,
  GREETING_LEFT_PCT,
  PEEK_LIFT_PCT,
  WHISPER_ARC_BASELINE_Y_PX,
  WHISPER_ARC_CHAR_WIDTH_PX,
  WHISPER_ARC_MAX_WIDTH_PX,
  WHISPER_ARC_MIN_FONT_SIZE_PX,
  WHISPER_ARC_MIN_WIDTH_PX,
  WHISPER_ARC_PEAK_Y_PX,
  WHISPER_ARC_SIDE_MARGIN_PX,
  WHISPER_ARC_TEXT_PADDING_PX,
  WHISPER_GAP_PX,
} from "./layout";

type EntranceGreetingProps = {
  children: string;
  visible: boolean;
  peeking?: boolean;
  /** Peek greeting sits beside the flower; whispers float above it. */
  placement?: "beside" | "above";
  className?: string;
  /** @default "div" — canvas uses div; dev page may use span */
  as?: "div" | "span";
  italic?: boolean;
  color?: string;
  /** Opacity transition duration (ms). */
  fadeDurationMs?: number;
  /** Anchor for viewport-aware curved whisper sizing (flower wrapper). */
  layoutAnchorRef?: RefObject<HTMLElement | null>;
};

type ArcLayout = {
  width: number;
  fontSize: number;
};

let measureProbe: HTMLSpanElement | null = null;

function measureGreetingWidth(text: string, fontSize: number) {
  if (typeof document === "undefined") {
    return text.length * WHISPER_ARC_CHAR_WIDTH_PX;
  }

  if (!measureProbe) {
    measureProbe = document.createElement("span");
    measureProbe.setAttribute("aria-hidden", "true");
    measureProbe.style.cssText =
      "position:fixed;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;";
    measureProbe.style.fontFamily = GREETING_FONT_FAMILY;
    document.body.appendChild(measureProbe);
  }

  measureProbe.style.fontSize = `${fontSize}px`;
  measureProbe.textContent = text;
  return measureProbe.getBoundingClientRect().width;
}

function viewportArcMaxWidth(anchor: HTMLElement | null) {
  if (!anchor || typeof window === "undefined") {
    return WHISPER_ARC_MAX_WIDTH_PX;
  }

  const rect = anchor.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const halfAvailable = Math.min(
    centerX - WHISPER_ARC_SIDE_MARGIN_PX,
    window.innerWidth - centerX - WHISPER_ARC_SIDE_MARGIN_PX
  );

  return Math.max(
    WHISPER_ARC_MIN_WIDTH_PX,
    Math.min(WHISPER_ARC_MAX_WIDTH_PX, halfAvailable * 2)
  );
}

function computeArcLayout(text: string, viewportMax: number): ArcLayout {
  let fontSize = GREETING_FONT_SIZE_PX;
  let textWidth = measureGreetingWidth(text, fontSize);
  const targetWidth = textWidth + WHISPER_ARC_TEXT_PADDING_PX;

  if (targetWidth > viewportMax) {
    const scale = (viewportMax - WHISPER_ARC_TEXT_PADDING_PX) / textWidth;
    fontSize = Math.max(
      WHISPER_ARC_MIN_FONT_SIZE_PX,
      GREETING_FONT_SIZE_PX * scale
    );
    textWidth = measureGreetingWidth(text, fontSize);
  }

  const width = Math.min(
    viewportMax,
    Math.max(WHISPER_ARC_MIN_WIDTH_PX, textWidth + WHISPER_ARC_TEXT_PADDING_PX)
  );

  return { width, fontSize };
}

function useArcLayout(
  text: string,
  layoutAnchorRef?: RefObject<HTMLElement | null>
) {
  const [layout, setLayout] = useState<ArcLayout>(() => {
    const viewportMax = WHISPER_ARC_MAX_WIDTH_PX;
    return computeArcLayout(text, viewportMax);
  });

  useLayoutEffect(() => {
    const update = () => {
      const viewportMax = viewportArcMaxWidth(layoutAnchorRef?.current ?? null);
      setLayout(computeArcLayout(text, viewportMax));
    };

    update();

    const anchor = layoutAnchorRef?.current;
    if (!anchor || typeof window === "undefined") return;

    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [layoutAnchorRef, text]);

  return layout;
}

function CurvedWhisper({
  children,
  color,
  italic,
  pathId,
  layoutAnchorRef,
}: {
  children: string;
  color: string;
  italic: boolean;
  pathId: string;
  layoutAnchorRef?: RefObject<HTMLElement | null>;
}) {
  const { width, fontSize } = useArcLayout(children, layoutAnchorRef);
  const pathD = `M 0 ${WHISPER_ARC_BASELINE_Y_PX} Q ${width / 2} ${WHISPER_ARC_PEAK_Y_PX} ${width} ${WHISPER_ARC_BASELINE_Y_PX}`;
  const textLength = useMemo(() => width * 0.94, [width]);

  return (
    <svg
      width={width}
      height={WHISPER_ARC_BASELINE_Y_PX + 4}
      className="block max-w-[calc(100vw-24px)] overflow-visible"
      aria-hidden
    >
      <defs>
        <path id={pathId} d={pathD} fill="none" />
      </defs>
      <text
        fill={color}
        fontFamily={GREETING_FONT_FAMILY}
        fontSize={fontSize}
        fontStyle={italic ? "italic" : "normal"}
        textLength={textLength}
        lengthAdjust="spacingAndGlyphs"
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {children}
        </textPath>
      </text>
    </svg>
  );
}

export function EntranceGreeting({
  children,
  visible,
  peeking = false,
  placement = "beside",
  className,
  as: Tag = "div",
  italic = false,
  color = GREETING_COLOR,
  fadeDurationMs = 450,
  layoutAnchorRef,
}: EntranceGreetingProps) {
  const curvedPathId = useId();
  const transforms: string[] = [];

  if (placement === "above") {
    transforms.push("translateX(-50%)");
  } else if (peeking) {
    transforms.push(`translateY(-${PEEK_LIFT_PCT}%)`);
  }

  if (!visible) transforms.push("translateY(4px)");

  const placementStyle: CSSProperties =
    placement === "above"
      ? {
          bottom: "100%",
          left: "50%",
          marginBottom: WHISPER_GAP_PX,
          transform: transforms.join(" ") || undefined,
        }
      : {
          bottom: `${GREETING_BOTTOM_PCT}%`,
          left: `${GREETING_LEFT_PCT}%`,
          transform: transforms.join(" ") || undefined,
        };

  const sharedStyle: CSSProperties = {
    ...placementStyle,
    opacity: visible ? 1 : 0,
    transition: `opacity ${fadeDurationMs}ms ease, transform ${fadeDurationMs}ms ease`,
  };

  if (placement === "above") {
    return (
      <Tag
        aria-hidden
        className={clsx("pointer-events-none absolute leading-none", className)}
        style={sharedStyle}
      >
        <CurvedWhisper
          pathId={curvedPathId}
          color={color}
          italic={italic}
          layoutAnchorRef={layoutAnchorRef}
        >
          {children}
        </CurvedWhisper>
      </Tag>
    );
  }

  return (
    <Tag
      aria-hidden
      className={clsx(
        "pointer-events-none absolute whitespace-nowrap leading-none",
        italic && "italic",
        className
      )}
      style={{
        ...sharedStyle,
        fontFamily: GREETING_FONT_FAMILY,
        fontSize: `${GREETING_FONT_SIZE_PX}px`,
        color,
      }}
    >
      {children}
    </Tag>
  );
}
