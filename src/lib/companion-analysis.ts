import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import { collectJournalWordTokens } from "@/lib/canvas-word-count";
import type { CompanionEmotion } from "@/lib/companion-emotions";
import type { BlobEmotion } from "@/components/canvas/blob/types";
import { companionToBlobEmotion } from "@/components/canvas/blob/emotions";
import {
  COMPANION_CLASSIFY_WORD_CAP,
  COMPANION_CONTEXT_WORD_CAP,
  COMPANION_MIN_WORD_DELTA,
  COMPANION_MIN_WORDS,
} from "@/lib/companion-pause";

export type CompanionConfidence = "high" | "low";

export type CompanionAnalysis = {
  emotion: CompanionEmotion;
  confidence: CompanionConfidence;
};

export type CompanionAnalysisRequest = {
  text: string;
};

export type CompanionSessionMeta = {
  /** Words in the delta chunk sent for this classification. */
  deltaTextWords: number;
  /** Words in the capped classify window (≤ {@link COMPANION_CLASSIFY_WORD_CAP}). */
  classifyTextWords: number;
  classificationStrategy: "delta-chunk";
  /** Total words written this canvas visit. */
  sessionTextWords: number;
  totalTextWords: number;
  sessionBaselineTokenCount: number;
  analysisBaselineTokenCount: number;
};

/** @deprecated Use sessionBaselineTokenCount */
export type CompanionSessionMetaLegacy = {
  sessionTextWords: number;
  totalTextWords: number;
  baselineTokenCount: number;
};

const POSITIVE_FACES = new Set<BlobEmotion>(["love", "excited", "happy"]);
const NEGATIVE_FACES = new Set<BlobEmotion>(["sad", "confused", "shocked"]);

/** Trailing journal context — up to {@link COMPANION_CONTEXT_WORD_CAP} words. */
export const extractCompanionContext = (
  snapshot: CanvasSnapshot,
  maxWords = COMPANION_CONTEXT_WORD_CAP
): string => {
  const tokens = collectJournalWordTokens(snapshot);
  if (tokens.length === 0) return "";
  return tokens.slice(-maxWords).join(" ");
};

/** Word tokens written since the canvas session baseline (excludes pre-session text). */
export const extractCompanionSessionContext = (
  snapshot: CanvasSnapshot,
  baselineTokenCount = 0,
  maxWords = COMPANION_CONTEXT_WORD_CAP
): string => {
  const tokens = collectJournalWordTokens(snapshot);
  const sessionTokens = tokens.slice(
    Math.min(Math.max(0, baselineTokenCount), tokens.length)
  );
  if (sessionTokens.length === 0) return "";
  return sessionTokens.slice(-maxWords).join(" ");
};

export const countCompanionContextWords = (snapshot: CanvasSnapshot): number =>
  collectJournalWordTokens(snapshot).length;

export const countCompanionSessionWords = (
  snapshot: CanvasSnapshot,
  baselineTokenCount = 0
): number => {
  const total = collectJournalWordTokens(snapshot).length;
  return Math.max(0, total - Math.max(0, baselineTokenCount));
};

export const meetsCompanionWordThreshold = (snapshot: CanvasSnapshot): boolean =>
  countCompanionContextWords(snapshot) >= COMPANION_MIN_WORDS;

/** Words written since the last successful classification (delta only). */
export const extractCompanionDeltaContext = (
  snapshot: CanvasSnapshot,
  analysisBaselineTokenCount = 0,
  maxWords = COMPANION_CONTEXT_WORD_CAP
): string => {
  const tokens = collectJournalWordTokens(snapshot);
  const deltaTokens = tokens.slice(
    Math.min(Math.max(0, analysisBaselineTokenCount), tokens.length)
  );
  if (deltaTokens.length === 0) return "";
  return deltaTokens.slice(-maxWords).join(" ");
};

/**
 * Text sent to the classifier: new words since last react, capped at
 * {@link COMPANION_CLASSIFY_WORD_CAP} (most recent tail of the delta).
 */
export const extractCompanionClassifyContext = (
  snapshot: CanvasSnapshot,
  analysisBaselineTokenCount = 0,
  maxWords = COMPANION_CLASSIFY_WORD_CAP
): string => {
  const tokens = collectJournalWordTokens(snapshot);
  const deltaTokens = tokens.slice(
    Math.min(Math.max(0, analysisBaselineTokenCount), tokens.length)
  );
  if (deltaTokens.length === 0) return "";
  return deltaTokens.slice(-maxWords).join(" ");
};

export const countCompanionClassifyWords = (
  snapshot: CanvasSnapshot,
  analysisBaselineTokenCount = 0,
  maxWords = COMPANION_CLASSIFY_WORD_CAP
): number => {
  const tokens = collectJournalWordTokens(snapshot);
  const deltaTokens = tokens.slice(
    Math.min(Math.max(0, analysisBaselineTokenCount), tokens.length)
  );
  return Math.min(deltaTokens.length, maxWords);
};

export const countCompanionDeltaWords = (
  snapshot: CanvasSnapshot,
  analysisBaselineTokenCount = 0
): number => {
  const total = collectJournalWordTokens(snapshot).length;
  return Math.max(0, total - Math.max(0, analysisBaselineTokenCount));
};

export const meetsCompanionDeltaWordThreshold = (
  snapshot: CanvasSnapshot,
  analysisBaselineTokenCount: number,
  isFirstAnalysis: boolean
): boolean => {
  const delta = countCompanionDeltaWords(snapshot, analysisBaselineTokenCount);
  return isFirstAnalysis
    ? delta >= COMPANION_MIN_WORDS
    : delta >= COMPANION_MIN_WORD_DELTA;
};

export const meetsCompanionSessionWordThreshold = (
  snapshot: CanvasSnapshot,
  baselineTokenCount = 0
): boolean =>
  countCompanionSessionWords(snapshot, baselineTokenCount) >= COMPANION_MIN_WORDS;

/** Cross-valence jumps pass through neutral for a smoother face change. */
export const needsNeutralTransition = (
  from: BlobEmotion,
  to: BlobEmotion
): boolean => {
  if (from === to) return false;
  if (from === "neutral" || to === "neutral" || from === "sleep" || to === "sleep") {
    return false;
  }
  const fromPos = POSITIVE_FACES.has(from);
  const toPos = POSITIVE_FACES.has(to);
  const fromNeg = NEGATIVE_FACES.has(from);
  const toNeg = NEGATIVE_FACES.has(to);
  if (fromPos && toPos) return false;
  if (fromNeg && toNeg) return false;
  return (fromPos && toNeg) || (fromNeg && toPos);
};

export const companionAnalysisToBlob = (
  analysis: CompanionAnalysis
): BlobEmotion => companionToBlobEmotion(analysis.emotion);
