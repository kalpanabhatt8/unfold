"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import {
  GREETING_BOTTOM_PCT,
  GREETING_COLOR,
  GREETING_FONT_FAMILY,
  GREETING_FONT_SIZE_PX,
  GREETING_LEFT_PCT,
  PEEK_LIFT_PCT,
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
};

export function EntranceGreeting({
  children,
  visible,
  peeking = false,
  placement = "beside",
  className,
  as: Tag = "div",
}: EntranceGreetingProps) {
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

  return (
    <Tag
      aria-hidden
      className={clsx("pointer-events-none absolute whitespace-nowrap leading-none", className)}
      style={{
        ...placementStyle,
        fontFamily: GREETING_FONT_FAMILY,
        fontSize: `${GREETING_FONT_SIZE_PX}px`,
        color: GREETING_COLOR,
        opacity: visible ? 1 : 0,
        transition: "opacity 450ms ease, transform 450ms ease",
      }}
    >
      {children}
    </Tag>
  );
}
