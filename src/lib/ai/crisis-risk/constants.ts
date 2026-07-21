/** Haiku — low temperature for binary crisis classification. */
export const CRISIS_MODEL = "claude-haiku-4-5-20251001";
export const CRISIS_MAX_TOKENS = 64;
export const CRISIS_TEMPERATURE = 0;

/** Client fetch timeout for crisis classification. */
export const CRISIS_CLIENT_TIMEOUT_MS = 12_000;

export type CrisisRiskResult = {
  flagged: boolean;
  confidence: number;
};
