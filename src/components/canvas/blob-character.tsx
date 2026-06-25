/**
 * Barrel — public API for the sunflower companion.
 * Implementation lives in ./blob/
 */
export { default } from "./blob/blob-character";
export { useBlobState } from "./blob/use-blob-state";
export type { UseBlobStateOptions } from "./blob/use-blob-state";
export { GREETING_DURATION_MS } from "./blob/use-blob-state";

export type {
  BlobPose,
  BlobEmotion,
  BloomLevel,
  BlobCharacterProps,
} from "./blob/types";

export {
  BLOB_EMOTIONS,
  BLOB_POSES,
  companionToBlobEmotion,
} from "./blob/emotions";

export type { CompanionEmotion } from "@/lib/companion-emotions";
