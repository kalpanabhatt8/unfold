/** Haiku - low temperature for binary crisis classification. */
export const CRISIS_MODEL = "claude-haiku-4-5-20251001";
export const CRISIS_MAX_TOKENS = 64;
export const CRISIS_TEMPERATURE = 0;

/** Client fetch timeout for crisis classification. */
export const CRISIS_CLIENT_TIMEOUT_MS = 12_000;

/**
 * Long entries: head + tail sampling so late crisis language is not dropped.
 * Matches extraction's word budget — still near-full for typical journals.
 */
export const CRISIS_INPUT_WORD_CAP = 1200;
export const CRISIS_HEAD_WORDS = 300;
export const CRISIS_TAIL_WORDS = 900;

export type CrisisRiskResult = {
  flagged: boolean;
  confidence: number;
};
