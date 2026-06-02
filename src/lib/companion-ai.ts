import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import {
  countWordsFromSnapshot,
  extractJournalPlainText,
} from "@/lib/canvas-word-count";

/**
 * The eight tones the sunflower can notice. This is the single source of truth
 * — the local detector, the Gemini route, and the blob's animation states all
 * agree on exactly these values.
 */
export const COMPANION_EMOTIONS = [
  "heavy",
  "anxious",
  "angry",
  "confused",
  "tired",
  "happy",
  "calm",
  "neutral",
] as const;

export type CompanionEmotion = (typeof COMPANION_EMOTIONS)[number];

export const isCompanionEmotion = (value: unknown): value is CompanionEmotion =>
  typeof value === "string" &&
  (COMPANION_EMOTIONS as readonly string[]).includes(value);

export type CompanionResponse = {
  emotion: CompanionEmotion;
  line: string;
};

/** Enough words written to be worth a quiet reaction (strictly word-gated). */
export const COMPANION_MIN_WORDS = 20;
/** Trigger 1: pause after writing before the companion reacts (idle 0–15s). */
export const COMPANION_INACTIVITY_MS = 15_000;
/** Trigger 2: total session writing time before the companion checks in. */
export const COMPANION_LONG_WRITING_MS = 10 * 60_000;
/** Never interrupt mid-sentence — wait for this gap in typing before reacting. */
export const COMPANION_TYPING_GAP_MS = 2_000;
/** Past this, give up on the API and use the local keyword fallback instead. */
const COMPANION_API_TIMEOUT_MS = 3_000;

export const meetsCompanionThreshold = (snapshot: CanvasSnapshot): boolean => {
  const text = extractJournalPlainText(snapshot).trim();
  if (!text) return false;
  return countWordsFromSnapshot(snapshot) >= COMPANION_MIN_WORDS;
};

export const fetchCompanionResponse = async (
  snapshot: CanvasSnapshot
): Promise<CompanionResponse> => {
  const text = extractJournalPlainText(snapshot);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    COMPANION_API_TIMEOUT_MS
  );

  let res: Response;
  try {
    res = await fetch("/api/companion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(`Companion API failed (${res.status})`);
  }

  const data = (await res.json()) as CompanionResponse;
  if (!isCompanionEmotion(data.emotion)) {
    throw new Error("Invalid companion emotion");
  }
  if (typeof data.line !== "string" || !data.line.trim()) {
    throw new Error("Invalid companion line");
  }

  return { emotion: data.emotion, line: data.line.trim() };
};
