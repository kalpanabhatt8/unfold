/** Classifier labels — safe for server routes (no client imports). */

export const COMPANION_EMOTIONS = [
  "love",
  "excited",
  "neutral",
  "happy",
  "sad",
  "anxious",
  "tired",
  "confused",
  "shocked",
] as const;

export type CompanionEmotion = (typeof COMPANION_EMOTIONS)[number];

/** Blob-only — idle timer, not from the classifier. */
export const BLOB_IDLE_EMOTIONS = ["sleep"] as const;

/** Legacy labels from older prompts — normalized before mapping. */
export const LEGACY_COMPANION_EMOTION_MAP: Record<string, CompanionEmotion> = {
  heavy: "sad",
  angry: "sad",
  calm: "neutral",
  proud: "happy",
  accomplished: "happy",
  confident: "happy",
  smart: "happy",
};

export const normalizeCompanionEmotion = (
  value: unknown
): CompanionEmotion | null => {
  if (typeof value !== "string") return null;
  if ((COMPANION_EMOTIONS as readonly string[]).includes(value)) {
    return value as CompanionEmotion;
  }
  return LEGACY_COMPANION_EMOTION_MAP[value] ?? null;
};

export const isCompanionEmotion = (value: unknown): value is CompanionEmotion =>
  normalizeCompanionEmotion(value) !== null;
