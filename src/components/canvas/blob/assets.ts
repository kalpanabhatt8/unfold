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
  confused: {
    mouth: `${CHAR}/confused/mouth.svg`,
  },
};

/** Intrinsic SVG sizes (width × height from each file's viewBox). */
export const ASSET_SIZE = {
  body: { w: 50, h: 50 },
  face: { w: 31.4213, h: 31.4213 },
  leftEye: { w: 3, h: 3 },
  rightEye: { w: 3, h: 3 },
  sleepEye: { w: 3, h: 1 },
  leftBlush: { w: 3, h: 3 },
  mouth: {
    neutral: { w: 4, h: 2 },
    love: { w: 5, h: 3 },
    happy: { w: 5, h: 3 },
    sad: { w: 3, h: 1 },
    sleep: { w: 4, h: 2 },
    confused: { w: 4, h: 2 },
  },
  lovebg: { w: 39, h: 17 },
  sleepZzz: { w: 5, h: 8 },
  leftLeaf: { w: 22, h: 23 },
  rightLeaf: { w: 22, h: 23 },
} as const;

/** Single “z” letter from sleep/sleepzz.svg — animated one at a time. */
export const SLEEP_Z_LETTER = {
  d: "M0.56 6.888C0.458667 6.90133 0.382667 6.91067 0.332 6.916C0.281333 6.91867 0.242667 6.91467 0.216 6.904C0.192 6.89333 0.165333 6.87467 0.136 6.848C0.112 6.82667 0.102667 6.80133 0.108 6.772C0.116 6.74267 0.161333 6.68533 0.244 6.6C0.294667 6.53867 0.346667 6.48133 0.4 6.428C0.453333 6.372 0.501333 6.32667 0.544 6.292C0.562667 6.276 0.584 6.26 0.608 6.244C0.632 6.22533 0.670667 6.19733 0.724 6.16C0.777333 6.12267 0.856 6.06933 0.96 6C1.01067 5.96 1.05067 5.92933 1.08 5.908C1.10933 5.88667 1.13333 5.86933 1.152 5.856C1.17333 5.84 1.19467 5.824 1.216 5.808C1.19733 5.80533 1.156 5.80133 1.092 5.796C1.03067 5.79067 0.973333 5.79067 0.92 5.796C0.845333 5.796 0.797333 5.796 0.776 5.796C0.754667 5.79333 0.733333 5.78933 0.712 5.784H0.652C0.638667 5.784 0.614667 5.77867 0.58 5.768C0.545333 5.75467 0.513333 5.73867 0.484 5.72C0.454667 5.70133 0.438667 5.68267 0.436 5.664C0.436 5.664 0.444 5.66 0.46 5.652C0.476 5.64133 0.489333 5.63067 0.5 5.62C0.521333 5.60667 0.537333 5.596 0.548 5.588C0.561333 5.58 0.573333 5.58133 0.584 5.592C0.584 5.592 0.609333 5.592 0.66 5.592C0.710667 5.58933 0.768 5.58667 0.832 5.584C0.986667 5.58667 1.1 5.592 1.172 5.6C1.24667 5.60533 1.30133 5.616 1.336 5.632C1.37333 5.648 1.40933 5.672 1.444 5.704C1.48667 5.74667 1.504 5.788 1.496 5.828C1.488 5.868 1.46933 5.904 1.44 5.936C1.42933 5.94667 1.41867 5.95867 1.408 5.972C1.4 5.98267 1.392 5.988 1.384 5.988C1.384 5.988 1.36533 6 1.328 6.024C1.29067 6.048 1.24533 6.07733 1.192 6.112C1.14133 6.14667 1.09067 6.17867 1.04 6.208C0.992 6.23733 0.962667 6.25867 0.952 6.272C0.933333 6.28267 0.910667 6.29733 0.884 6.316C0.857333 6.332 0.838667 6.34533 0.828 6.356C0.82 6.36667 0.801333 6.38533 0.772 6.412C0.745333 6.43867 0.716 6.46267 0.684 6.484C0.66 6.50533 0.630667 6.532 0.596 6.564C0.564 6.596 0.536 6.624 0.512 6.648C0.488 6.672 0.476 6.684 0.476 6.684C0.476 6.684 0.502667 6.68133 0.556 6.676C0.609333 6.668 0.676 6.66133 0.756 6.656C0.836 6.648 0.914667 6.64667 0.992 6.652C1.11733 6.64933 1.216 6.64667 1.288 6.644C1.36267 6.63867 1.41867 6.63733 1.456 6.64C1.496 6.64 1.52667 6.64533 1.548 6.656C1.56667 6.66133 1.58267 6.672 1.596 6.688C1.612 6.704 1.62267 6.72133 1.628 6.74C1.636 6.756 1.63733 6.768 1.632 6.776C1.62133 6.776 1.58 6.78 1.508 6.788C1.436 6.79333 1.35333 6.79867 1.26 6.804C1.13733 6.81467 1.01867 6.828 0.904 6.844C0.789333 6.86 0.674667 6.87467 0.56 6.888Z",
  fill: "#9A6336",
  anchor: { x: 0.9, y: 6.85 },
} as const;
