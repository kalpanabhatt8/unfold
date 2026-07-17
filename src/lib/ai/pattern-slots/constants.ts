/** Haiku — low temperature for terse, grounded lines. */
export const SLOT_MODEL = "claude-haiku-4-5-20251001";
/** Room for mechanism + reflection in one JSON response. */
export const SLOT_MAX_TOKENS = 360;
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

/**
 * Client abort for /api/pattern-slots. Discovery now batches mechanism +
 * reflection (~2–4s typical, one partial retry ~2s more). 20s leaves margin
 * without the old sequential 4-call worst case that blew past 15s.
 */
export const SLOT_CLIENT_TIMEOUT_MS = 20_000;
