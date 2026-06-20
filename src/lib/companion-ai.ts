import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import {
  countWordsFromSnapshot,
  extractEmotionWindowFromSnapshot,
} from "@/lib/canvas-word-count";

/**
 * The nine tones Gemini classifies. Shared by the client hook and API route.
 */
export const COMPANION_EMOTIONS = [
  "heavy",
  "anxious",
  "angry",
  "confused",
  "shocked",
  "tired",
  "happy",
  "calm",
  "neutral",
] as const;

export type CompanionEmotion = (typeof COMPANION_EMOTIONS)[number];

export const isCompanionEmotion = (value: unknown): value is CompanionEmotion =>
  typeof value === "string" &&
  (COMPANION_EMOTIONS as readonly string[]).includes(value);

/** Minimum words on canvas before the companion reads the journal. */
export const COMPANION_EMOTION_MIN_WORDS = 10;
/** Trailing word window sent to Gemini (uses all words when the entry is shorter). */
export const COMPANION_EMOTION_WINDOW_WORDS = 24;
/** @deprecated Use COMPANION_EMOTION_MIN_WORDS */
export const COMPANION_MIN_WORDS = COMPANION_EMOTION_MIN_WORDS;
/** First pause after typing before reading the canvas. */
export const COMPANION_INACTIVITY_MS = 750;
/** Pause once the companion has already reacted once (same cap). */
export const COMPANION_SUBSEQUENT_INACTIVITY_MS = 750;
/** Words added in one burst — treat as paste, shorter debounce before Gemini. */
export const COMPANION_BULK_PASTE_WORD_DELTA = 8;
export const COMPANION_BULK_PASTE_INACTIVITY_MS = 200;

const COMPANION_API_TIMEOUT_MS = 8_000;

export type EmotionDetectionState = {
  hasDetectedBefore: boolean;
  /** Last classified trailing window — re-run when this changes (incl. deletes). */
  lastClassifiedTail: string;
};

export const getEmotionWindowText = (snapshot: CanvasSnapshot): string =>
  extractEmotionWindowFromSnapshot(
    snapshot,
    COMPANION_EMOTION_WINDOW_WORDS
  );

export const meetsEmotionDetectionThreshold = (
  snapshot: CanvasSnapshot,
  state: EmotionDetectionState
): boolean => {
  const total = countWordsFromSnapshot(snapshot);
  if (total < COMPANION_EMOTION_MIN_WORDS) return false;

  const tail = getEmotionWindowText(snapshot);
  if (!tail.trim()) return false;

  if (!state.hasDetectedBefore) return true;
  return tail !== state.lastClassifiedTail;
};

export const emotionDetectionPauseMs = (
  hasDetectedBefore: boolean
): number =>
  hasDetectedBefore
    ? COMPANION_SUBSEQUENT_INACTIVITY_MS
    : COMPANION_INACTIVITY_MS;

/** @deprecated Use meetsEmotionDetectionThreshold */
export const meetsCompanionThreshold = (snapshot: CanvasSnapshot): boolean =>
  meetsEmotionDetectionThreshold(snapshot, {
    hasDetectedBefore: false,
    lastClassifiedTail: "",
  });

/** Classify the trailing journal window (one automatic retry). */
export const fetchCompanionEmotion = async (
  emotionText: string
): Promise<CompanionEmotion> => {
  const text = emotionText.trim();
  if (!text) {
    throw new Error("Empty emotion window");
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      COMPANION_API_TIMEOUT_MS
    );

    try {
      const res = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Companion API failed (${res.status})`);
      }

      const data = (await res.json()) as { emotion?: unknown };
      if (!isCompanionEmotion(data.emotion)) {
        throw new Error("Invalid companion emotion");
      }

      return data.emotion;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((r) => window.setTimeout(r, 400));
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError;
};
