import type { BlobEmotion, BlobPose } from "./types";

export type BodyKind = "bob" | "still" | "lean" | "bounce" | "wave";
export type LeafKind = "still" | "sway" | "perk" | "greeting" | "highfive" | "hidden";
export type ExtrasKind = "none" | "sparkle-burst";
export type EyeBlink = "idle" | "typing" | "none";

export type PoseConfig = {
  body: BodyKind;
  leaves: LeafKind;
  extras: ExtrasKind;
  eyeBlink: EyeBlink;
  /** Mouth expression while in this pose (defaults to current emotion). */
  mouthEmotion?: BlobEmotion;
};

export const POSES: Record<BlobPose, PoseConfig> = {
  idle: {
    body: "bob",
    leaves: "still",
    extras: "none",
    eyeBlink: "idle",
  },
  enter: {
    body: "wave",
    leaves: "greeting",
    extras: "none",
    eyeBlink: "idle",
  },
  typing: {
    body: "lean",
    leaves: "sway",
    extras: "none",
    eyeBlink: "typing",
  },
  peek: {
    body: "still",
    leaves: "hidden",
    extras: "none",
    eyeBlink: "idle",
    mouthEmotion: "happy",
  },
  jump: {
    body: "bounce",
    leaves: "highfive",
    extras: "sparkle-burst",
    eyeBlink: "none",
  },
  bloom: {
    body: "bounce",
    leaves: "perk",
    extras: "sparkle-burst",
    eyeBlink: "none",
  },
};
