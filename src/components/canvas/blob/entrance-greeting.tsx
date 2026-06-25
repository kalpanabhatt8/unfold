"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import { useId, useMemo } from "react";
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
  WHISPER_ARC_MIN_WIDTH_PX,
  WHISPER_ARC_PEAK_Y_PX,
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
};

function whisperArcWidth(text: string) {
  return Math.min(
    WHISPER_ARC_MAX_WIDTH_PX,
    Math.max(
      WHISPER_ARC_MIN_WIDTH_PX,
      text.length * WHISPER_ARC_CHAR_WIDTH_PX
    )
  );
}

function CurvedWhisper({
  children,
  color,
  italic,
  pathId,
}: {
  children: string;
  color: string;
  italic: boolean;
  pathId: string;
}) {
  const width = useMemo(() => whisperArcWidth(children), [children]);
  const pathD = `M 0 ${WHISPER_ARC_BASELINE_Y_PX} Q ${width / 2} ${WHISPER_ARC_PEAK_Y_PX} ${width} ${WHISPER_ARC_BASELINE_Y_PX}`;

  return (
    <svg
      width={width}
      height={WHISPER_ARC_BASELINE_Y_PX + 4}
      className="block overflow-visible"
      aria-hidden
    >
      <defs>
        <path id={pathId} d={pathD} fill="none" />
      </defs>
      <text
        fill={color}
        fontFamily={GREETING_FONT_FAMILY}
        fontSize={GREETING_FONT_SIZE_PX}
        fontStyle={italic ? "italic" : "normal"}
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
