"use client";

import { useEffect, useState } from "react";
import { BREAKPOINT_LG, BREAKPOINT_MD } from "@/lib/breakpoints";
import {
  OVERLAY_MENU_CLEARANCE_PX,
  OVERLAY_MENU_TOP_PX,
  SHELL_CONTENT_HEADER_TOP_PX,
} from "@/lib/layout";

export type ViewportLayout = {
  /** Stamp inset from viewport edges (px). */
  stampCornerInsetPx: number;
  stampButtonSizePx: number;
  /**
   * Vertical page padding (px). On overlay nav this clears the fixed
   * hamburger - use for journal. On desktop, top padding aligns the canvas
   * title/date with sidebar “Recent entries”; bottom keeps reading comfort.
   */
  pagePaddingYPx: number;
  /** Journal top padding - aligns with the shell content-header band. */
  pagePaddingTopPx: number;
  /** Journal bottom padding - reading comfort (unchanged from legacy Y). */
  pagePaddingBottomPx: number;
  /**
   * Patterns page top padding. On desktop, aligns “Patterns” with sidebar
   * “Summary”; on overlay nav the menu is in-flow so padding stays tight.
   */
  patternsPagePaddingYPx: number;
  scrollComfortBottomPx: number;
  /** True below lg - fixed hamburger is visible when the drawer is closed. */
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
  const pagePaddingBottomPx = isOverlayNav
    ? Math.max(basePaddingY, OVERLAY_MENU_CLEARANCE_PX)
    : basePaddingY;
  // Desktop: pin title/date to the same band as “Recent entries”. Overlay
  // keeps the larger clearance so the floating menu never covers the header.
  const pagePaddingTopPx = isOverlayNav
    ? pagePaddingBottomPx
    : SHELL_CONTENT_HEADER_TOP_PX;
  const pagePaddingYPx = pagePaddingBottomPx;
  // Patterns: desktop shares the shell content-header band with “Summary”.
  // Overlay: page inset matches the fixed menu top; heading band comes from
  // the in-flow menu control + `OVERLAY_MENU_BUTTON_CLASS` gap below.
  const patternsPagePaddingYPx = isOverlayNav
    ? OVERLAY_MENU_TOP_PX
    : SHELL_CONTENT_HEADER_TOP_PX;
  const scrollComfortBottomPx =
    width >= BREAKPOINT_LG ? 72 : width >= BREAKPOINT_MD ? 56 : 44;

  return {
    stampCornerInsetPx,
    stampButtonSizePx,
    pagePaddingYPx,
    pagePaddingTopPx,
    pagePaddingBottomPx,
    patternsPagePaddingYPx,
    scrollComfortBottomPx,
    isOverlayNav,
  };
}

/** SSR / first-paint width - must match on server and client to avoid hydration drift. */
const SSR_VIEWPORT_WIDTH = 1280;

/** Responsive spacing for canvas corners and page padding - desktop values unchanged at lg+. */
export function useViewportLayout(): ViewportLayout {
  // Always seed with the SSR width. Reading `window` in the initializer
  // mismatches mobile/tablet first paint (e.g. 5.5rem vs 5.25rem padding).
  const [layout, setLayout] = useState<ViewportLayout>(() =>
    computeViewportLayout(SSR_VIEWPORT_WIDTH),
  );

  useEffect(() => {
    const update = () => setLayout(computeViewportLayout(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return layout;
}
