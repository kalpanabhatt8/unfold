/** Body / movement layer — animations stay running while emotion swaps face assets. */
export type BlobPose =
  | "idle"
  | "enter"
  | "typing"
  | "listening"
  | "peek"
  | "jump"
  | "bloom"
  | "wake";

/**
 * Face layer — each emotion folder only contains parts that differ from base.
 * Folders: /public/Images/character/{emotion}/
 */
export type BlobEmotion =
  | "love"
  | "excited"
  | "neutral"
  | "sad"
  | "anxious"
  | "tired"
  | "sleep"
  | "happy"
  | "confused"
  | "shocked"
  | "smart";

export type BloomLevel = 0 | 1 | 2 | 3;

export type BlobCharacterProps = {
  pose: BlobPose;
  emotion?: BlobEmotion;
  size?: number;
  className?: string;
  hidden?: boolean;
  bloomLevel?: BloomLevel;
  /** Tap raised leaves during `jump` pose (high-five). */
  onHighFive?: () => void;
  /** Hover / tap while `emotion === "sleep"` — startled wake. */
  onWake?: () => void;
  debugLayout?: boolean;
};
