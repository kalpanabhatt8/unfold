/**
 * Canonical breakpoints — aligned with Tailwind defaults (sm/md/lg).
 * Use these (or Tailwind `sm:` / `md:` / `lg:`) everywhere; avoid one-off fixed units.
 *
 * | Token | rem    | Role                                      |
 * |-------|--------|-------------------------------------------|
 * | sm    | 40rem  | Mobile → tablet                           |
 * | md    | 48rem  | Tablet → desktop (sidebar width step)    |
 * | lg    | 64rem  | Desktop; sidebar in-flow (not overlay)    |
 *
 * Content column max-width: see `CONTENT_COLUMN_MAX_WIDTH` in `layout.ts`.
 */
export const BREAKPOINT_SM = 640;
export const BREAKPOINT_MD = 768;
export const BREAKPOINT_LG = 1024;

/** Below lg the sidebar renders as an overlay drawer (matches Tailwind `lg:`). */
export const OVERLAY_NAV_MAX_WIDTH = BREAKPOINT_LG - 1;
export const OVERLAY_NAV_QUERY = `(max-width: ${OVERLAY_NAV_MAX_WIDTH / 16}rem)`;
