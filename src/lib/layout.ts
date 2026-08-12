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
 * Fixed overlay menu horizontal inset - mirrors `PAGE_PADDING_X_CLASS` so the
 * journal toggle lines up with the writing column below lg.
 */
export const OVERLAY_MENU_INSET_LEFT_CLASS =
  "left-[calc(env(safe-area-inset-left,0)+1rem)] sm:left-[calc(env(safe-area-inset-left,0)+1.25rem)] lg:left-[calc(env(safe-area-inset-left,0)+1.5rem)]";

/**
 * Pin the menu glyph to the leading edge of its touch target so it lines up
 * with `PAGE_PADDING_X_CLASS` text, not the centered icon-button default.
 */
export const OVERLAY_MENU_ICON_FLUSH_CLASS = "!justify-start";

/**
 * Icon-only overlay menu — no chrome surface; glyph aligns with page text.
 * Use below lg only; laptop+ keeps `btnIconChrome` on the fixed journal toggle.
 */
export const OVERLAY_MENU_ICON_ONLY_CLASS =
  "inline-flex shrink-0 items-center border-0 bg-transparent p-0 shadow-none rounded-none " +
  `${OVERLAY_MENU_ICON_FLUSH_CLASS} ` +
  "text-(--sidebar-ink) transition-colors duration-150 " +
  "hover:bg-transparent hover:text-(--sidebar-active-ink) " +
  "active:bg-transparent active:text-(--sidebar-active-ink) " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20";

/**
 * In-flow overlay menu (Patterns) - h-7 control + gap below matches sidebar
 * brand row → section label (mb-2 + gap-4).
 */
export const OVERLAY_MENU_BUTTON_CLASS = `mb-6 h-7 ${OVERLAY_MENU_ICON_ONLY_CLASS}`;

/** Fixed overlay menu inset from the top (matches `top: max(1rem, safe-area)`). */
export const OVERLAY_MENU_TOP_PX = 16;
/** Menu control height - matches sidebar brand row `h-7`. */
export const OVERLAY_MENU_CONTROL_HEIGHT_PX = 28;
/**
 * Gap below the menu control before the page heading - mirrors sidebar
 * `mb-2` (8) + `gap-4` (16) between brand row and section label.
 */
export const OVERLAY_MENU_TO_HEADER_GAP_PX = 24;
/**
 * Fixed overlay hamburger clearance (≤1023px): top (16) + control (28) +
 * gap below (24) = 68. Journal uses this as scroll padding; Patterns overlay
 * reaches the same band via in-flow menu + `OVERLAY_MENU_BUTTON_CLASS`.
 */
export const OVERLAY_MENU_CLEARANCE_PX =
  OVERLAY_MENU_TOP_PX +
  OVERLAY_MENU_CONTROL_HEIGHT_PX +
  OVERLAY_MENU_TO_HEADER_GAP_PX;

/**
 * Shell content-header band - sidebar section label + main title share one
 * horizontal line under the brand chrome:
 *   Entries:  “Recent entries” + book title + date
 *   Patterns: “Summary” + “Patterns”
 *
 * Brand row: mt-4 (16) + collapse control h-7 (28) + mb-2 (8) = 52;
 * gap-4 to section label = 16. Keep sidebar + canvas/patterns in sync.
 */
export const SHELL_BRAND_ROW_HEIGHT_PX = 52;
export const SHELL_SECTION_GAP_PX = 16;
export const SHELL_CONTENT_HEADER_TOP_PX =
  SHELL_BRAND_ROW_HEIGHT_PX + SHELL_SECTION_GAP_PX;
/** Shared row height for Recent entries / canvas title+date (`h-9`). */
export const SHELL_CONTENT_HEADER_HEIGHT_CLASS = "h-9";

/** Open the overlay / collapsed sidebar from in-page controls (e.g. Patterns). */
export const OPEN_NAV_EVENT = "unfold-open-nav";

export const openAppNav = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_NAV_EVENT));
};
