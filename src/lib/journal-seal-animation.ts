/** Stamp press finishes; aurora waits this long from seal begin (~0.5s). */
export const JOURNAL_SEAL_AURORA_START_MS = 500;

/** One left → right aurora sweep; fade is baked into the gradient. */
export const JOURNAL_SEAL_AURORA_MS = 1800;

/** Fallback if animationend does not fire (from aurora start). */
export const JOURNAL_SEAL_ANIM_MS = JOURNAL_SEAL_AURORA_MS + 40;
