import type { BlobEmotion } from "./types";
import { ASSET_SIZE, BASE, EMOTION_ASSETS } from "./assets";
import type { CompanionEmotion } from "@/lib/companion-ai";

export function resolveBodySrc(emotion: BlobEmotion): string {
  return EMOTION_ASSETS[emotion].body ?? BASE.body;
}

export function resolveEyeSrc(
  emotion: BlobEmotion,
  side: "left" | "right"
): string {
  const slot = side === "left" ? "leftEye" : "rightEye";
  return EMOTION_ASSETS[emotion][slot] ?? BASE[slot];
}

export function resolveMouthSrc(emotion: BlobEmotion): string {
  return EMOTION_ASSETS[emotion].mouth ?? EMOTION_ASSETS.neutral.mouth!;
}

export function mouthSize(emotion: BlobEmotion) {
  if (emotion === "sad") return ASSET_SIZE.mouth.sad;
  if (emotion === "love") return ASSET_SIZE.mouth.love;
  if (emotion === "happy") return ASSET_SIZE.mouth.happy;
  if (emotion === "sleep") return ASSET_SIZE.mouth.sleep;
  if (emotion === "confused") return ASSET_SIZE.mouth.confused;
  return ASSET_SIZE.mouth.neutral;
}

export function eyeSize(emotion: BlobEmotion, side: "left" | "right") {
  if (emotion === "sleep") return ASSET_SIZE.sleepEye;
  return side === "left" ? ASSET_SIZE.leftEye : ASSET_SIZE.rightEye;
}

const LOVE_WORDS = /\b(love|loved|loving|heart|hearts|adore|adored)\b/i;

/** Map Gemini companion tones onto character asset folders. */
export function companionToBlobEmotion(
  emotion: CompanionEmotion,
  text?: string
): BlobEmotion {
  if (emotion === "happy" && text && LOVE_WORDS.test(text)) {
    return "love";
  }

  switch (emotion) {
    case "happy":
      return "happy";
    case "tired":
      return "sad";
    case "heavy":
    case "angry":
    case "anxious":
      return "sad";
    case "confused":
      return "confused";
    case "neutral":
    case "calm":
    default:
      return "neutral";
  }
}

export const BLOB_EMOTIONS = [
  "love",
  "neutral",
  "sad",
  "sleep",
  "happy",
  "confused",
] as const satisfies readonly BlobEmotion[];

export const BLOB_POSES = [
  "idle",
  "enter",
  "typing",
  "peek",
  "jump",
  "bloom",
] as const;
