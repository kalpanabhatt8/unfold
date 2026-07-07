/** Canonical breakpoints — aligned with Tailwind defaults (sm/md/lg). */
export const BREAKPOINT_SM = 640;
export const BREAKPOINT_MD = 768;
export const BREAKPOINT_LG = 1024;

/** Below lg the sidebar renders as an overlay drawer (matches Tailwind `lg:`). */
export const OVERLAY_NAV_MAX_WIDTH = BREAKPOINT_LG - 1;
export const OVERLAY_NAV_QUERY = `(max-width: ${OVERLAY_NAV_MAX_WIDTH}px)`;
