/**
 * Whisper phrases — short Gen Z reactions shown beside the sunflower
 * after an emotion change. 2–5 words, warm, natural, non-robotic.
 */

import type { BlobEmotion } from "./types";

const WHISPER_POOLS: Partial<Record<BlobEmotion, readonly string[]>> = {
  happy: [
    "slay honestly",
    "that's the vibe",
    "love that for you",
    "okay but cute",
    "we love to see it",
  ],
  sad: [
    "that sounds heavy",
    "that's a lot tbh",
    "hey, i'm here",
    "valid feelings fr",
    "that makes sense tho",
  ],
  confused: [
    "breathe okay",
    "one thing at a time",
    "no rush genuinely",
    "it's okay to not know",
    "you're figuring it out",
  ],
  excited: [
    "omg yes!!",
    "let's go fr",
    "that energy tho",
    "okay i feel it",
    "big deal energy",
  ],
  love: [
    "wholesome fr",
    "heart so full",
    "that's everything",
    "so much warmth",
    "this is so sweet",
  ],
  shocked: [
    "wait what",
    "okay wow",
    "that's a lot",
    "no way actually",
    "????? okay",
  ],
  neutral: [
    "i'm listening",
    "take your time",
    "here for it",
    "go on then",
    "mm yeah",
  ],
};

let lastWhisperByEmotion: Partial<Record<BlobEmotion, string>> = {};

/** Picks a random whisper phrase, avoiding repeats for the same emotion. */
export function pickWhisper(emotion: BlobEmotion): string | null {
  const pool = WHISPER_POOLS[emotion];
  if (!pool?.length) return null;

  const last = lastWhisperByEmotion[emotion];
  const candidates = last ? pool.filter((p) => p !== last) : [...pool];
  const source = candidates.length > 0 ? candidates : [...pool];
  const picked = source[Math.floor(Math.random() * source.length)]!;

  lastWhisperByEmotion[emotion] = picked;
  return picked;
}
