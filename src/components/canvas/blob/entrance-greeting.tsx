"use client";

import clsx from "clsx";
import {
  GREETING_BOTTOM_PCT,
  GREETING_COLOR,
  GREETING_FONT_FAMILY,
  GREETING_FONT_SIZE_PX,
  GREETING_LEFT_PCT,
  PEEK_LIFT_PCT,
} from "./layout";

type EntranceGreetingProps = {
  children: string;
  visible: boolean;
  peeking?: boolean;
  className?: string;
  /** @default "div" — canvas uses div; dev page may use span */
  as?: "div" | "span";
};

export function EntranceGreeting({
  children,
  visible,
  peeking = false,
  className,
  as: Tag = "div",
}: EntranceGreetingProps) {
  return (
    <Tag
      aria-hidden
      className={clsx("pointer-events-none absolute whitespace-nowrap leading-none", className)}
      style={{
        bottom: `${GREETING_BOTTOM_PCT}%`,
        left: `${GREETING_LEFT_PCT}%`,
        fontFamily: GREETING_FONT_FAMILY,
        fontSize: `${GREETING_FONT_SIZE_PX}px`,
        color: GREETING_COLOR,
        opacity: visible ? 1 : 0,
        transform: visible
          ? peeking
            ? `translateY(-${PEEK_LIFT_PCT}%)`
            : "translateY(0)"
          : "translateY(4px)",
        transition: "opacity 450ms ease, transform 450ms ease",
      }}
    >
      {children}
    </Tag>
  );
}
