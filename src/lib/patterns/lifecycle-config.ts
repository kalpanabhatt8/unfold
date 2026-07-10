/**
 * Unfold — tunable thresholds for pattern lifecycle classification.
 *
 * Single source of truth for every day-based constant the classifier uses.
 * Calibrate here without touching classifier logic.
 *
 * Reasoning behind the defaults:
 *
 * RECENT_WINDOW (14d) — "about two journaling weeks." Long enough that a
 * weekend gap or a slow week doesn't flip a pattern, short enough that a
 * pattern quiet for half a month reads as genuinely inactive while the user
 * is still writing elsewhere. Used with SURFACE_MIN_ENTRIES to bound
 * `emerging`: young patterns below minimum surface depth stay evidence-only;
 * patterns at SURFACE_MIN_ENTRIES or above graduate to strengthening/recognition.
 *
 * HALF_LIFE (21d) — three weeks, slightly longer than the recent window.
 * Older evidence still counts but fades smoothly; a burst from a month ago
 * doesn't dominate today's stage. Used only for the `strength` signal today
 * (diagnostics / future tuning), not a hard classifier gate.
 *
 * RETURN_GAP (30d) — "~a month of silence" before fresh evidence reads as
 * a return rather than steady continuation. Chosen to sit above RECENT_WINDOW
 * so a two-week pause is normal quiet, not a narrative return.
 *
 * MIN_DWELL (3d) — anti-flicker hold. With 3–8 evidence points, raw
 * classification can wobble on every reload; three days is long enough to feel
 * stable, short enough that a real shift (new entry) still lands within a
 * week once evidence changes.
 *
 * RETURNING_MAX_RECENT (2) — a return is transient. More than two fresh
 * points after a long gap means momentum again → graduate to strengthening.
 */

/** Recent vs prior boundary; also the global-inactivity horizon for resting. */
export const RECENT_WINDOW_DAYS = 14;

/** Strength-decay half-life for the diagnostic `strength` signal. */
export const HALF_LIFE_DAYS = 21;

/** Quiet span before fresh evidence after a gap reads as returning. */
export const RETURN_GAP_DAYS = 30;

/** Minimum days a lifecycle stage must be held before it can change. */
export const MIN_DWELL_DAYS = 3;

/** Fresh points after a gap still count as returning, not strengthening. */
export const RETURNING_MAX_RECENT = 2;

/**
 * Minimum gap between paired entries for temporal juxtaposition shapes.
 * Decoupled from RETURN_GAP — a 2-week contrast is meaningful for drift;
 * returning lifecycle still prefers the largest available gap.
 */
export const PAIR_MIN_GAP_DAYS = 14;

/** Half-life for quote-selection recency weight (may match HALF_LIFE_DAYS). */
export const QUOTE_SELECTION_HALF_LIFE_DAYS = 21;

/** Weighted blend for legacy ranking — passage quote selection now uses innerExperienceScore in evidence-signals.ts. */
export const QUOTE_CONFIDENCE_WEIGHT = 0.6;
export const QUOTE_RECENCY_WEIGHT = 0.4;
