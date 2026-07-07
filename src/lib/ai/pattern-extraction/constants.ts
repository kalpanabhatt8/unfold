/** Haiku — low temperature for structured classification. */
export const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";
export const EXTRACTION_MAX_TOKENS = 500;
export const EXTRACTION_TEMPERATURE = 0.2;

/** Long entries: head + tail sampling (extraction-specific strategy). */
export const EXTRACTION_INPUT_WORD_CAP = 1200;
export const EXTRACTION_HEAD_WORDS = 300;
export const EXTRACTION_TAIL_WORDS = 900;

export const EXTRACTION_MAX_EVIDENCE_CHARS = 140;

/** Client fetch timeout for entry analysis. */
export const EXTRACTION_CLIENT_TIMEOUT_MS = 12_000;

export type ExtractionFailureReason =
  | "no_api_key"
  | "upstream_error"
  | "empty_response"
  | "invalid_output";
