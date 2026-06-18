/** Book spine — disabled; original implementation kept below for reference. */
const __book_spine_disabled = String.raw`
"use client";

import React from "react";
import clsx from "clsx";
import type { CSSProperties } from "react";
import {
  rgbToHex,
  SPINE_INNER_SHADOWS,
  type Rgb,
} from "@/lib/spine-colors";

export const BOOK_SPINE_WIDTH = 80;
/** Design reference height (470px) minus ~20% bottom trim for shelf sit. */
export const BOOK_SPINE_HEIGHT = 376;

type BookSpineProps = {
  title: string;
  titleStyle?: CSSProperties;
  baseColor: Rgb;
  onClick?: () => void;
  className?: string;
};

export function BookSpine({
  title,
  titleStyle,
  baseColor,
  onClick,
  className,
}: BookSpineProps) {

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "group relative shrink-0 cursor-pointer overflow-hidden rounded-t-[12px] rounded-b-none border-0 p-0 text-left transition-transform duration-200 ease-out hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20",
        className,
      )}
      style={{
        width: BOOK_SPINE_WIDTH,
        height: BOOK_SPINE_HEIGHT,
        background: rgbToHex(baseColor),
        boxShadow: SPINE_INNER_SHADOWS,
        ["--book-title-size" as string]: "var(--text-md)",
      }}
      aria-label={title}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-black/[0.06]"
      />
      <div className="absolute inset-x-0 bottom-[10%] top-[32%] flex justify-center">
        <span
          className="book-cover__title max-h-full"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
            ...titleStyle,
          }}
        >
          {title}
        </span>
      </div>
    </button>
  );
}
`;

void __book_spine_disabled;
