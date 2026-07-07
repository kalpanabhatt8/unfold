/** Haiku — moderate temperature for reflective prose. */
export const REFLECTION_MODEL = "claude-haiku-4-5-20251001";
export const REFLECTION_MAX_TOKENS = 200;
export const REFLECTION_TEMPERATURE = 0.3;

export const REFLECTION_MAX_QUOTES = 8;
export const REFLECTION_MAX_QUOTE_CHARS = 160;
export const REFLECTION_MAX_OBSERVATION_CHARS = 140;
export const REFLECTION_MAX_COMMON_THREAD_CHARS = 200;

/** Client fetch timeout for pattern reflections. */
export const REFLECTION_CLIENT_TIMEOUT_MS = 15_000;

export type ReflectionFailureReason =
  | "no_api_key"
  | "upstream_error"
  | "empty_response"
  | "invalid_output"
  | "failed_validation";
