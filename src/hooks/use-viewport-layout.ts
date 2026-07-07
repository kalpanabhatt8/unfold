"use client";

import { useEffect, useState } from "react";
import { BREAKPOINT_LG, BREAKPOINT_MD } from "@/lib/breakpoints";

export type ViewportLayout = {
  /** Stamp inset from viewport edges (px). */
  stampCornerInsetPx: number;
  stampButtonSizePx: number;
  /** Canvas vertical page padding (px). */
  pagePaddingYPx: number;
  scrollComfortBottomPx: number;
};

function computeViewportLayout(width: number): ViewportLayout {
  const stampCornerInsetPx =
    width >= BREAKPOINT_LG ? 32 : width >= BREAKPOINT_MD ? 24 : 16;
  const stampButtonSizePx = width >= BREAKPOINT_MD ? 36 : 32;
  const pagePaddingYPx =
    width >= BREAKPOINT_LG ? 88 : width >= BREAKPOINT_MD ? 64 : 48;
  const scrollComfortBottomPx =
    width >= BREAKPOINT_LG ? 72 : width >= BREAKPOINT_MD ? 56 : 44;

  return {
    stampCornerInsetPx,
    stampButtonSizePx,
    pagePaddingYPx,
    scrollComfortBottomPx,
  };
}

/** Responsive spacing for canvas corners and page padding — desktop values unchanged at lg+. */
export function useViewportLayout(): ViewportLayout {
  const [layout, setLayout] = useState<ViewportLayout>(() =>
    computeViewportLayout(
      typeof window !== "undefined" ? window.innerWidth : 1280,
    ),
  );

  useEffect(() => {
    const update = () => setLayout(computeViewportLayout(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return layout;
}
