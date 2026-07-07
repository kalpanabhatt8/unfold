import { MAX_BOOK_TITLE_CHARS } from "@/lib/book-title";

/** Haiku — tuned for short creative labels at seal time. */
export const TITLE_MODEL = "claude-haiku-4-5-20251001";
export const TITLE_MAX_TOKENS = 32;

/** Fallback when journal content is too short for AI title generation. */
export const UNTITLED_ENTRY = "Untitled Entry";

/** Minimum word count before calling the title model. */
export const MIN_WORDS_FOR_AI_TITLE = 3;

export const PREFERRED_TITLE_WORDS_MIN = 2;
export const PREFERRED_TITLE_WORDS_MAX = 4;
export const MAX_TITLE_WORDS = 5;
export const MAX_TITLE_CHARS = MAX_BOOK_TITLE_CHARS;

/** Words sent to the title model. */
export const TITLE_INPUT_WORD_CAP = 500;

/** Client fetch timeout — covers server retry (two model calls). */
export const TITLE_CLIENT_TIMEOUT_MS = 8_000;
