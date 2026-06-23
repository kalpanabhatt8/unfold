import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import { collectJournalWordTokens } from "@/lib/canvas-word-count";
import type { CompanionEmotion } from "@/lib/companion-emotions";
import type { BlobEmotion } from "@/components/canvas/blob/types";
import { companionToBlobEmotion } from "@/components/canvas/blob/emotions";
import { COMPANION_CLASSIFY_WORD_CAP } from "@/lib/companion-pause";

export type CompanionConfidence = "high" | "medium" | "low";

export type CompanionAnalysis = {
  emotion: CompanionEmotion;
  confidence: CompanionConfidence;
};

export type ClassificationStrategy = "delta" | "deletion" | "initial";

export type CompanionSessionMeta = {
  classificationStrategy: ClassificationStrategy;
  newWordsSinceLastAnalysis: number;
  wordsRemoved?: number;
  totalTextWords: number;
  classifyTextWords: number;
};

const POSITIVE_FACES = new Set<BlobEmotion>(["love", "excited", "happy"]);
const NEGATIVE_FACES = new Set<BlobEmotion>(["sad", "confused", "shocked"]);

/**
 * Text sent to the classifier — last up to {@link COMPANION_CLASSIFY_WORD_CAP} words
 * written since `sinceTokenIndex` (delta path).
 */
export const extractCompanionAnalyzeText = (
  snapshot: CanvasSnapshot,
  sinceTokenIndex = 0,
  maxWords = COMPANION_CLASSIFY_WORD_CAP
): string => {
  const tokens = collectJournalWordTokens(snapshot);
  const source =
    sinceTokenIndex > 0
      ? tokens.slice(Math.min(sinceTokenIndex, tokens.length))
      : tokens;
  if (source.length === 0) return "";
  return source.slice(-maxWords).join(" ");
};

/** Full canvas text for deletion re-classify (no word cap). */
export const extractFullCanvasAnalyzeText = (
  snapshot: CanvasSnapshot
): string => {
  const tokens = collectJournalWordTokens(snapshot);
  if (tokens.length === 0) return "";
  return tokens.join(" ");
};

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
