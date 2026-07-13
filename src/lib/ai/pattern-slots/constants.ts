/** Haiku — low temperature for terse, grounded lines. */
export const SLOT_MODEL = "claude-haiku-4-5-20251001";
export const SLOT_MAX_TOKENS = 320;
export const SLOT_TEMPERATURE = 0.3;

export const SLOT_MAX_QUOTES = 8;
export const SLOT_MAX_QUOTE_CHARS = 160;

/** Voice slot word budgets — enforced in validation. */
export const SLOT_MAX_LINE_WORDS = 12;
export const SLOT_MAX_LINE_CHARS = 72;
export const SLOT_MAX_QUESTION_CHARS = 80;
/** Mechanism slot replays the event chain — 2–4 short sentences. */
export const SLOT_MIN_MECHANISM_SENTENCES = 2;
export const SLOT_MAX_MECHANISM_SENTENCES = 4;
export const SLOT_MAX_MECHANISM_WORDS = 42;
export const SLOT_MAX_MECHANISM_CHARS = 200;
/** Total AI words allowed across all voice slots in one passage. */
export const SLOT_MAX_PASSAGE_AI_WORDS = 64;

export const SLOT_CLIENT_TIMEOUT_MS = 15_000;
