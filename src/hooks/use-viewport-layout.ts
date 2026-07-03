"use client";

import { useEffect, useState } from "react";

export type ViewportLayout = {
  /** Stamp / companion inset from viewport edges (px). */
  stampCornerInsetPx: number;
  stampButtonSizePx: number;
  companionAboveSignGapPx: number;
  companionCornerBottomPx: number;
  companionCornerRightPx: number;
  /** Canvas vertical page padding (px). */
  pagePaddingYPx: number;
  scrollComfortBottomPx: number;
};

function computeViewportLayout(width: number): ViewportLayout {
  const stampCornerInsetPx = width >= 1024 ? 32 : width >= 768 ? 24 : 16;
  const stampButtonSizePx = width >= 768 ? 36 : 32;
  const companionAboveSignGapPx = width >= 1024 ? 24 : width >= 768 ? 22 : 18;
  const pagePaddingYPx = width >= 1024 ? 88 : width >= 768 ? 64 : 48;
  const scrollComfortBottomPx = width >= 1024 ? 72 : width >= 768 ? 56 : 44;

  return {
    stampCornerInsetPx,
    stampButtonSizePx,
    companionAboveSignGapPx,
    companionCornerBottomPx:
      stampCornerInsetPx + stampButtonSizePx + companionAboveSignGapPx,
    companionCornerRightPx: stampCornerInsetPx,
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
