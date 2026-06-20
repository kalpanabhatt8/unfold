/** Master viewBox and feature anchors (60×60). Tune in /dev/blob. */

import type { BlobEmotion } from "./types";

export const VIEW_SIZE = 60;

export const BODY_CX = 30;
export const BODY_CY = 29;

export const FACE_SIZE = 31.4213;
export const FACE_RX = 15.7106;

export const LEFT_EYE_CX = 25.5;
export const RIGHT_EYE_CX = 34.5;
export const EYE_CY = 25;

export const LEFT_BLUSH_CX = 22.2;
export const RIGHT_BLUSH_CX = 37.8;
export const BLUSH_CY = 29;

export const MOUTH_CX = BODY_CX;
export const MOUTH_CY = 29;

/** Fine-tune mouth placement per emotion (viewBox units). Tune in /dev/blob. */
export const MOUTH_EMOTION_OFFSET: Partial<
  Record<BlobEmotion, { dx: number; dy: number }>
> = {
  shocked: { dx: 0, dy: 0 },
};

/** Petal ring offset inside viewBox. */
export const BODY_TX = 5;
export const BODY_TY = 4;

/** Leaf attach point on the petal ring. */
export const LEAF_ATTACH_X = BODY_TX + 25;
export const LEAF_ATTACH_Y = BODY_TY + 48.32 - 0.45;
export const LEAF_STEM_LEFT = { x: 18.9881, y: 8.52462 };
export const LEAF_STEM_RIGHT = { x: 2.88546, y: 8.52462 };
export const LEAF_SCALE = 22 / 23;

export const LEAF_LEFT_POS = {
  x: LEAF_ATTACH_X - LEAF_STEM_LEFT.x * LEAF_SCALE,
  y: LEAF_ATTACH_Y - LEAF_STEM_LEFT.y * LEAF_SCALE,
};
export const LEAF_RIGHT_POS = {
  x: LEAF_ATTACH_X - LEAF_STEM_RIGHT.x * LEAF_SCALE,
  y: LEAF_ATTACH_Y - LEAF_STEM_RIGHT.y * LEAF_SCALE,
};

export const FACE_POS = {
  x: BODY_CX - FACE_SIZE / 2,
  y: BODY_CY - FACE_SIZE / 2,
};

/** Floating hearts behind love emotion. */
export const LOVE_BG_SIZE = { w: 39, h: 17 };
export const LOVE_BG_POS = {
  x: BODY_CX - LOVE_BG_SIZE.w / 2,
  y: -6,
};
/** Hearts drift upward — scales with the SVG at any character `size`. */
export const LOVE_BG_RISE_DURATION_S = 4.2;
/** Staggered copies — negative delays so one heart is visible on first frame. */
export const LOVE_BG_STREAM_COUNT = 2;

/** Zzz cluster on upper-right petal (sleep) — matches sleep/sleepzz.svg layout. */
export const SLEEP_ZZZ_POS = { x: 38, y: 14 };
export const SLEEP_ZZZ_LETTER_SCALE = 1.5;
/** Full loop before the zzz cluster repeats. */
export const SLEEP_ZZZ_CYCLE_S = 4.2;

/** Nudge eyes / mouth / blush down while sleeping — closed eyes feel heavy. */
export const SLEEP_FACE_OFFSET_Y = 3.0;

/** Blush on the cheek while sleeping — slightly out from the eyes (viewBox units). */
export const SLEEP_LEFT_BLUSH_CX = 22;
export const SLEEP_RIGHT_BLUSH_CX = 38;
export const SLEEP_BLUSH_CY = 27;

/** Pivot while peeking — bottom-left matches the idle anchor (no vertical jump). */
export const PEEK_TRANSFORM_ORIGIN = "left bottom";
/**
 * Peek tilt — leans the head into the canvas (clockwise in CSS).
 * Figma panel shows −16.73° on the asset; with `PEEK_TRANSFORM_ORIGIN`
 * we use the opposite sign so the flower leans right like the mock.
 */
export const PEEK_ROTATE_DEG = 12;
/**
 * How much of the flower width stays visible while sneaking (0–100).
 * 50 = half the body peeks in; raise to show more, lower to hide more.
 */
export const PEEK_VISIBLE_PCT = 40;
/** Derived — shifts the flower left so only `PEEK_VISIBLE_PCT` stays on screen. */
export const PEEK_TRANSLATE_PCT = 100 - PEEK_VISIBLE_PCT;
/** Lift up while peeking (% of height) so the tilted pose lines up with idle. */
export const PEEK_LIFT_PCT = 14;
/** @deprecated kept for back-compat; use PEEK_TRANSLATE_PCT. */
export const PEEK_OFFSET_RATIO = PEEK_TRANSLATE_PCT / 100;

/** Entrance slide from left (pairs with `enter` pose). */
export const ENTRANCE_OFFSET_PX = 46;
export const ENTRANCE_DURATION_S = 0.95;
export const ENTRANCE_DURATION_MS = ENTRANCE_DURATION_S * 1000;

/* ── Entrance choreography (canvas open → peek → greeting → slide in) ── */
/** Wait after the canvas opens before the flower peeks in. */
export const PEEK_DELAY_MS = 1000;
/** How long the flower holds the peek (tilt + greeting) before sliding in. */
export const PEEK_HOLD_MS = 2000;

/** Sunflower peek greeting — tune size/color/position here (canvas + /dev/blob). */
export const GREETING_FONT_SIZE_PX = 16;
export const GREETING_COLOR = "#3C2605";
export const GREETING_FONT_FAMILY = "var(--font-balsamiq-sans), sans-serif";
/** Horizontal offset (% of flower box width). */
export const GREETING_LEFT_PCT = 55;
/** Vertical offset (% from bottom of flower box) — raise to move text up. */
export const GREETING_BOTTOM_PCT = 64;

export const BLOOM_SCALE_STEP = 0.028;
export const BLOOM_GLOW_STEP = 0.05;
export const GLOW_RADIUS = 30;

export const GREETING_DURATION_S = 1.35;
export const TYPING_LEAN_DURATION_S = 1.35;
export const TYPING_LEAN_ROTATE_DEG = 2;
export const TYPING_LEAN_FLOAT_PX = -0.75;
export const TYPING_LEAF_SWAY_DURATION_S = 1.9;
export const TYPING_LEAF_SWAY_DEG = 2;

/** Smile expand — slightly longer with a soft bloom at the end. */
export const MOUTH_CHANGE_EXPAND_DURATION_S = 0.82;
/** Smile settle back — quicker, no overshoot. */
export const MOUTH_CHANGE_CONTRACT_DURATION_S = 0.58;
/** Non-smile expression swaps (sad, confused, …). */
export const MOUTH_CHANGE_DURATION_S = 0.68;
/** Shocked O-mouth closing into a smile after wake — gentle vertical settle. */
export const MOUTH_WAKE_SETTLE_DURATION_S = 0.88;
/** Initial vertical scale when an open shocked mouth closes into neutral. */
export const MOUTH_SHOCKED_OPEN_SCALE_Y = 1.2;

/** Sleep breathing — body shrinks/grows while the face is in sleep emotion. */
export const SLEEP_BREATH_DURATION_S = 4;
export const SLEEP_BREATH_SCALE_MIN = 0.962;
export const SLEEP_BREATH_SCALE_MAX = 0.992;
export const SLEEP_BREATH_LIFT_PX = -0.6;

/** Startled wake — gasp, stretch, eyes pop wide (pairs with `wake` pose). */
/** Sudden shocked pop, then mouth/eyes settle before returning to idle. */
export const WAKE_SURPRISE_MS = 680;
export const WAKE_DURATION_MS = 1_800;
export const WAKE_BODY_DURATION_S = 0.55;
export const WAKE_BODY_SCALE_PEAK = 1.025;
export const WAKE_BODY_LIFT_PX = -1.25;
export const WAKE_LEAF_DURATION_S = 0.58;
export const WAKE_LEAF_LIFT_PX = -2;
export const WAKE_LEAF_ROTATE_LIFT = 6;
