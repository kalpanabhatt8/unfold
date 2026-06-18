import type { BlobEmotion } from "./types";

/** Public asset roots — paths match /public/Images/character/ */
export const CHAR = "/Images/character";

/** Shared base parts (always present unless an emotion overrides that slot). */
export const BASE = {
  body: `${CHAR}/body.svg`,
  face: `${CHAR}/face.svg`,
  leftEye: `${CHAR}/left-eye.svg`,
  rightEye: `${CHAR}/right-eye.svg`,
  leftLeaf: `${CHAR}/leaf-left.svg`,
  rightLeaf: `${CHAR}/leaf-right.svg`,
  leftBlush: `${CHAR}/blush-left.svg`,
  rightBlush: `${CHAR}/blush-right.svg`,
} as const;

export type EmotionAssetSlot =
  | "body"
  | "mouth"
  | "leftEye"
  | "rightEye"
  | "lovebg"
  | "sleepZzz";

/** Per-emotion overrides — only list parts that differ from {@link BASE}. */
export const EMOTION_ASSETS: Record<
  BlobEmotion,
  Partial<Record<EmotionAssetSlot, string>>
> = {
  love: {
    body: `${CHAR}/love/body.svg`,
    mouth: `${CHAR}/love/mouth.svg`,
    lovebg: `${CHAR}/love/lovebg.svg`,
  },
  neutral: {
    mouth: `${CHAR}/neutral/mouth.svg`,
  },
  sad: {
    body: `${CHAR}/sad/body.svg`,
    mouth: `${CHAR}/sad/mouth.svg`,
  },
  sleep: {
    mouth: `${CHAR}/sleep/mouth.svg`,
    leftEye: `${CHAR}/sleep/left-eye.svg`,
    rightEye: `${CHAR}/sleep/right-eye.svg`,
    sleepZzz: `${CHAR}/sleep/sleepzz.svg`,
  },
  happy: {
    mouth: `${CHAR}/happy/mouth.svg`,
  },
};

/** Intrinsic SVG sizes (width × height from each file's viewBox). */
export const ASSET_SIZE = {
  body: { w: 50, h: 50 },
  face: { w: 31.4213, h: 31.4213 },
  leftEye: { w: 3, h: 3 },
  rightEye: { w: 2, h: 3 },
  sleepEye: { w: 3, h: 1 },
  leftBlush: { w: 3, h: 3 },
  mouth: {
    neutral: { w: 4, h: 2 },
    love: { w: 5, h: 3 },
    happy: { w: 5, h: 3 },
    sad: { w: 3, h: 1 },
    sleep: { w: 4, h: 2 },
  },
  lovebg: { w: 39, h: 17 },
  sleepZzz: { w: 5, h: 8 },
  leftLeaf: { w: 22, h: 23 },
  rightLeaf: { w: 22, h: 23 },
} as const;
