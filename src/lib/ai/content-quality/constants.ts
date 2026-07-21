/** Haiku — low temperature for binary content-quality classification. */
export const QUALITY_MODEL = "claude-haiku-4-5-20251001";
export const QUALITY_MAX_TOKENS = 64;
export const QUALITY_TEMPERATURE = 0;

/** Client fetch timeout for content-quality classification. */
export const QUALITY_CLIENT_TIMEOUT_MS = 12_000;

/**
 * Only skip pattern extraction when flagged AND confidence meets this floor.
 * Encodes under-flagging in code: uncertain flags below the floor are ignored.
 */
export const QUALITY_FLAG_CONFIDENCE_FLOOR = 0.7;

export type ContentQualityResult = {
  flagged: boolean;
  confidence: number;
};

/** Same skip rule as `notifyEntryCompleted` — under-flag via confidence floor. */
export function shouldSkipPatternExtractionForQuality(
  quality: ContentQualityResult,
): boolean {
  return (
    quality.flagged === true &&
    quality.confidence >= QUALITY_FLAG_CONFIDENCE_FLOOR
  );
}
