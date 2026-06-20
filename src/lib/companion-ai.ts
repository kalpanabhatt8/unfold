import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import {
  extractCompanionContext,
  meetsCompanionWordThreshold,
} from "@/lib/companion-analysis";
import {
  COMPANION_CONTEXT_WORD_CAP,
  COMPANION_MIN_WORDS,
} from "@/lib/companion-pause";

export {
  COMPANION_EMOTIONS,
  isCompanionEmotion,
  normalizeCompanionEmotion,
  type CompanionEmotion,
} from "@/lib/companion-emotions";

export {
  COMPANION_CLASSIFY_WORD_CAP,
  COMPANION_CONTEXT_WORD_CAP,
  COMPANION_EMOTION_TRANSITION_MS,
  COMPANION_MIN_WORD_DELTA,
  COMPANION_MIN_WORDS,
  COMPANION_PAUSE_LISTENING_MS,
  COMPANION_PAUSE_REACTING_MS,
  COMPANION_PAUSE_REFLECTING_MS,
  COMPANION_PAUSE_WRITING_MS,
  EMOTION_COOLDOWN_MS,
  type CompanionAnalysisMode,
  type CompanionPausePhase,
} from "@/lib/companion-pause";

export {
  companionAnalysisToBlob,
  countCompanionContextWords,
  countCompanionClassifyWords,
  countCompanionDeltaWords,
  countCompanionSessionWords,
  extractCompanionClassifyContext,
  extractCompanionContext,
  extractCompanionDeltaContext,
  extractCompanionSessionContext,
  meetsCompanionDeltaWordThreshold,
  meetsCompanionWordThreshold,
  meetsCompanionSessionWordThreshold,
  needsNeutralTransition,
  type CompanionAnalysis,
  type CompanionAnalysisRequest,
  type CompanionConfidence,
  type CompanionSessionMeta,
} from "@/lib/companion-analysis";

/** @deprecated Use extractCompanionContext */
export const getEmotionWindowText = (snapshot: CanvasSnapshot): string =>
  extractCompanionContext(snapshot);

/** @deprecated Pause tiers replaced tail-change detection */
export type EmotionDetectionState = {
  hasDetectedBefore: boolean;
  lastClassifiedTail: string;
};

/** @deprecated Pause tiers handle thresholds */
export const meetsEmotionDetectionThreshold = (
  snapshot: CanvasSnapshot
): boolean => meetsCompanionWordThreshold(snapshot);

/** Legacy aliases — pause tiers supersede these */
export const COMPANION_EMOTION_MIN_WORDS = COMPANION_MIN_WORDS;
export const COMPANION_EMOTION_WINDOW_WORDS = COMPANION_CONTEXT_WORD_CAP;
export const COMPANION_INACTIVITY_MS = 3_000;
export const COMPANION_SUBSEQUENT_INACTIVITY_MS = 3_000;
export const COMPANION_BULK_PASTE_WORD_DELTA = 999;
export const COMPANION_BULK_PASTE_INACTIVITY_MS = 3_000;

export const emotionDetectionPauseMs = (): number => 3_000;

export const meetsCompanionThreshold = meetsCompanionWordThreshold;
