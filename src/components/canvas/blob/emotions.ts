import type { BlobEmotion } from "./types";
import { ASSET_SIZE, BASE, EMOTION_ASSETS } from "./assets";
import type { CompanionEmotion } from "@/lib/companion-ai";
import { MOUTH_CX, MOUTH_CY, MOUTH_EMOTION_OFFSET } from "./layout";

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
  if (emotion === "anxious") return ASSET_SIZE.mouth.anxious;
  if (emotion === "tired") return ASSET_SIZE.mouth.tired;
  if (emotion === "love") return ASSET_SIZE.mouth.love;
  if (emotion === "excited") return ASSET_SIZE.mouth.excited;
  if (emotion === "happy") return ASSET_SIZE.mouth.happy;
  if (emotion === "sleep") return ASSET_SIZE.mouth.sleep;
  if (emotion === "confused") return ASSET_SIZE.mouth.confused;
  if (emotion === "shocked") return ASSET_SIZE.mouth.shocked;
  if (emotion === "smart") return ASSET_SIZE.mouth.smart;
  return ASSET_SIZE.mouth.neutral;
}

/** Top-left corner for the mouth image — matches neutral smile anchor. */
export function mouthPosition(emotion: BlobEmotion) {
  const mouth = mouthSize(emotion);
  const off = MOUTH_EMOTION_OFFSET[emotion] ?? { dx: 0, dy: 0 };
  return {
    x: MOUTH_CX - mouth.w / 2 + off.dx,
    y: MOUTH_CY - mouth.h / 2 + off.dy,
  };
}

export function eyeSize(emotion: BlobEmotion, side: "left" | "right") {
  if (emotion === "sleep") return ASSET_SIZE.sleepEye;
  return side === "left" ? ASSET_SIZE.leftEye : ASSET_SIZE.rightEye;
}

/** Map companion classifier labels onto character faces (1:1). */
export function companionToBlobEmotion(emotion: CompanionEmotion): BlobEmotion {
  switch (emotion) {
    case "love":
      return "love";
    case "excited":
      return "excited";
    case "happy":
      return "happy";
    case "sad":
      return "sad";
    case "confused":
      return "confused";
    case "shocked":
      return "shocked";
    case "neutral":
    default:
      return "neutral";
  }
}

export const BLOB_EMOTIONS = [
  "love",
  "excited",
  "neutral",
  "happy",
  "sad",
  "anxious",
  "tired",
  "sleep",
  "confused",
  "shocked",
  "smart",
] as const satisfies readonly BlobEmotion[];

export const BLOB_POSES = [
  "idle",
  "enter",
  "typing",
  "listening",
  "peek",
  "jump",
  "bloom",
  "wake",
] as const;
