"use client";

import { useEffect, useState } from "react";
import { BREAKPOINT_LG, BREAKPOINT_MD } from "@/lib/breakpoints";
import { OVERLAY_MENU_CLEARANCE_PX } from "@/lib/layout";

export type ViewportLayout = {
  /** Stamp inset from viewport edges (px). */
  stampCornerInsetPx: number;
  stampButtonSizePx: number;
  /**
   * Vertical page padding (px). On overlay nav this clears the fixed
   * hamburger — use for journal.
   */
  pagePaddingYPx: number;
  /**
   * Patterns page top padding — tighter on phone because the menu is in-flow
   * (no floating hamburger to clear).
   */
  patternsPagePaddingYPx: number;
  scrollComfortBottomPx: number;
  /** True below lg — fixed hamburger is visible when the drawer is closed. */
  isOverlayNav: boolean;
};

function computeViewportLayout(width: number): ViewportLayout {
  const isOverlayNav = width < BREAKPOINT_LG;
  const stampCornerInsetPx =
    width >= BREAKPOINT_LG ? 32 : width >= BREAKPOINT_MD ? 24 : 16;
  const stampButtonSizePx = width >= BREAKPOINT_MD ? 36 : 32;
  const basePaddingY =
    width >= BREAKPOINT_LG ? 88 : width >= BREAKPOINT_MD ? 64 : 48;
  // Below lg the fixed journal menu sits in the top-left; keep titles below it.
  const pagePaddingYPx = isOverlayNav
    ? Math.max(basePaddingY, OVERLAY_MENU_CLEARANCE_PX)
    : basePaddingY;
  // Patterns: menu lives in the header — only need a small top inset on phone.
  const patternsPagePaddingYPx =
    width >= BREAKPOINT_LG ? 64 : width >= BREAKPOINT_MD ? 28 : 16;
  const scrollComfortBottomPx =
    width >= BREAKPOINT_LG ? 72 : width >= BREAKPOINT_MD ? 56 : 44;

  return {
    stampCornerInsetPx,
    stampButtonSizePx,
    pagePaddingYPx,
    patternsPagePaddingYPx,
    scrollComfortBottomPx,
    isOverlayNav,
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
