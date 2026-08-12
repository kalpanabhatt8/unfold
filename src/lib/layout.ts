/**
 * Shared layout tokens for the app shell.
 * Breakpoints live in `breakpoints.ts` (sm 640 / md 768 / lg 1024).
 *
 * Use `min(100%, …)` so on phone the column is full-bleed and `px-4` can
 * line up with chrome. On wide screens the px cap still centers via `mx-auto`.
 */
/** Journal writing column - also used by Patterns on laptop/desktop. */
export const CONTENT_COLUMN_MAX_WIDTH = "min(100%, 52.5rem)";

/**
 * Patterns on phone/tablet only - full bleed up to this cap.
 * Laptop+ (`!isOverlayNav`) uses `CONTENT_COLUMN_MAX_WIDTH` so switching
 * Entries → Patterns keeps the same reading column.
 */
export const PATTERNS_COLUMN_MAX_WIDTH = "min(100%, 60rem)";

/** Patterns column: match canvas on laptop/desktop; wider OK below lg. */
export const patternsColumnMaxWidth = (isOverlayNav: boolean): string =>
  isOverlayNav ? PATTERNS_COLUMN_MAX_WIDTH : CONTENT_COLUMN_MAX_WIDTH;

/**
 * Horizontal page padding - mirrors Tailwind `px-4 sm:px-5 lg:px-6`.
 */
export const PAGE_PADDING_X_CLASS = "px-4 sm:px-5 lg:px-6";

/**
 * Fixed overlay hamburger clearance (≤1023px): top (16) + control (28) +
 * gap below (40) ≈ 84. Used by the journal column; Patterns overlay keeps the
 * menu in-flow instead (desktop Patterns uses the floating toggle when closed).
 */
export const OVERLAY_MENU_CLEARANCE_PX = 84;

/**
 * Shell content-header band - sidebar section label + main title share one
 * horizontal line under the brand chrome:
 *   Entries:  “Recent entries” + book title + date
 *   Patterns: “Summary” + “Patterns”
 *
 * Brand row: mt-4 (16) + collapse control h-7 (28) + mb-2 (8) = 52;
 * gap-3 to header = 12. Keep sidebar + canvas/patterns in sync when adjusting.
 */
export const SHELL_BRAND_ROW_HEIGHT_PX = 52;
export const SHELL_BRAND_TO_HEADER_GAP_PX = 12;
export const SHELL_CONTENT_HEADER_TOP_PX =
  SHELL_BRAND_ROW_HEIGHT_PX + SHELL_BRAND_TO_HEADER_GAP_PX;
/** Shared row height for Recent entries / canvas title+date (`h-9`). */
export const SHELL_CONTENT_HEADER_HEIGHT_CLASS = "h-9";

/** Open the overlay / collapsed sidebar from in-page controls (e.g. Patterns). */
export const OPEN_NAV_EVENT = "unfold-open-nav";

export const openAppNav = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_NAV_EVENT));
};
