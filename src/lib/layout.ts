/**
 * Shared layout tokens for the app shell.
 * Breakpoints live in `breakpoints.ts` (sm 640 / md 768 / lg 1024).
 *
 * Use `min(100%, …)` so on phone the column is full-bleed and `px-4` can
 * line up with chrome. On wide screens the px cap still centers via `mx-auto`.
 */
/** Journal writing column — also used by Patterns on laptop/desktop. */
export const CONTENT_COLUMN_MAX_WIDTH = "min(100%, 840px)";

/**
 * Patterns on phone/tablet only — full bleed up to this cap.
 * Laptop+ (`!isOverlayNav`) uses `CONTENT_COLUMN_MAX_WIDTH` so switching
 * Entries → Patterns keeps the same reading column.
 */
export const PATTERNS_COLUMN_MAX_WIDTH = "min(100%, 960px)";

/** Patterns column: match canvas on laptop/desktop; wider OK below lg. */
export const patternsColumnMaxWidth = (isOverlayNav: boolean): string =>
  isOverlayNav ? PATTERNS_COLUMN_MAX_WIDTH : CONTENT_COLUMN_MAX_WIDTH;

/**
 * Horizontal page padding — mirrors Tailwind `px-4 sm:px-5 lg:px-6`.
 */
export const PAGE_PADDING_X_CLASS = "px-4 sm:px-5 lg:px-6";

/**
 * Fixed overlay hamburger (≤1023px): top offset + touch target + gap below.
 * Used by the journal column; Patterns keeps the menu in-flow instead.
 */
export const OVERLAY_MENU_TOP_PX = 24;
export const OVERLAY_MENU_SIZE_PX = 44;
export const OVERLAY_MENU_GAP_PX = 16;
export const OVERLAY_MENU_CLEARANCE_PX =
  OVERLAY_MENU_TOP_PX + OVERLAY_MENU_SIZE_PX + OVERLAY_MENU_GAP_PX; // 84

/** Page horizontal padding. */
export const pagePaddingXClass = (_isOverlayNav?: boolean): string =>
  PAGE_PADDING_X_CLASS;

/** Open the overlay / collapsed sidebar from in-page controls (e.g. Patterns). */
export const OPEN_NAV_EVENT = "keeps-open-nav";

export const openAppNav = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_NAV_EVENT));
};
