/** Brief shake when the stamp meets the page. */
export const JOURNAL_SEAL_WOBBLE_MS = 350;

/** Soft aurora wash across the text. */
export const JOURNAL_SEAL_AURORA_MS = 950;

/** Total time from stamp impact until the entry is locked. */
export const JOURNAL_SEAL_ANIM_MS =
  JOURNAL_SEAL_WOBBLE_MS + JOURNAL_SEAL_AURORA_MS + 50;
