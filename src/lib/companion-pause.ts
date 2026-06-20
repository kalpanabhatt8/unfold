/** Pause tiers — flower listens first, reacts later. */

/** < 3s after last keystroke — writing / typing pose. */
export const COMPANION_PAUSE_WRITING_MS = 3_000;
/** 3–6s — listening pose (lean-in, neutral face). */
export const COMPANION_PAUSE_LISTENING_MS = 6_000;
/** 6–8s — react: classify delta chunk, apply emotion if confident. */
export const COMPANION_PAUSE_REACTING_MS = 8_000;
/** > 12s — milestone save only (no second classification). */
export const COMPANION_PAUSE_REFLECTING_MS = 12_000;

export const COMPANION_MIN_WORDS = 24;
/** Legacy full-entry cap — not used for pause-tier reactions. */
export const COMPANION_CONTEXT_WORD_CAP = 450;
/** Max words sent per classification — tail of the new chunk since last react. */
export const COMPANION_CLASSIFY_WORD_CAP = 50;
/** Skip API when fewer new words were written since the last analysis. */
export const COMPANION_MIN_WORD_DELTA = 8;

export const COMPANION_EMOTION_TRANSITION_MS = 400;
/** After a face change, block further emotion updates (poses still update). */
export const EMOTION_COOLDOWN_MS = 15_000;

/** @deprecated Reflect tier removed — emotion-only pipeline uses react at 6s. */
export type CompanionAnalysisMode = "react";
export type CompanionPausePhase =
  | "writing"
  | "listening"
  | "reacting";
