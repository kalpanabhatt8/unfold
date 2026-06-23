import type { CompanionAnalysis } from "@/lib/companion-analysis";
import type { BlobEmotion } from "@/components/canvas/blob/types";

const DEBUG_STORAGE_KEY = "keeps:companion-debug";

/** Dev by default; override with localStorage or NEXT_PUBLIC_COMPANION_DEBUG. */
export const isCompanionDebugEnabled = (): boolean => {
  if (process.env.NEXT_PUBLIC_COMPANION_DEBUG === "true") return true;
  if (process.env.NEXT_PUBLIC_COMPANION_DEBUG === "false") return false;
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(DEBUG_STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  }
  return process.env.NODE_ENV === "development";
};

export type CompanionAnalysisSource = "claude" | "unavailable";

export type CompanionRawResponse = CompanionAnalysis & {
  _debug?: {
    source?: CompanionAnalysisSource;
    rawClaude?: string;
    fallbackReason?: string;
    claudeStatus?: number;
  };
};

export type CompanionApplyDecision = {
  contextSent: string;
  rawResponse: CompanionRawResponse;
  mappedEmotion: BlobEmotion;
  currentEmotion: BlobEmotion;
  confidenceGatePassed: boolean;
  transitionViaNeutral: boolean;
  transitionAllowed: boolean;
  finalEmotionApplied: BlobEmotion | null;
  blockedReason?: string;
  totalTextWords?: number;
  emotionAfterUpdate?: BlobEmotion;
};

export const logCompanionRawResponse = (
  raw: CompanionRawResponse,
  source: CompanionAnalysisSource
) => {
  if (!isCompanionDebugEnabled()) return;
  const { _debug: _ignored, ...llmFields } = raw;
  console.log("LLM response:", llmFields);
  console.log("Source:", source);
  if (raw._debug?.fallbackReason) {
    console.warn("Classification fallback:", raw._debug.fallbackReason);
  }
  if (raw._debug?.claudeStatus) {
    console.warn("Claude HTTP status:", raw._debug.claudeStatus);
  }
  if (raw._debug?.rawClaude) console.log("Raw Claude text:", raw._debug.rawClaude);
};

export const logCompanionApplyDecision = (decision: CompanionApplyDecision) => {
  if (!isCompanionDebugEnabled()) return;
  if (decision.totalTextWords !== undefined) {
    console.log("Total canvas words:", decision.totalTextWords);
  }
  console.log("LLM emotion label:", decision.rawResponse.emotion);
  console.log("Mapped emotion:", decision.mappedEmotion);
  console.log("Current emotion (before):", decision.currentEmotion);
  console.log("Confidence gate passed:", decision.confidenceGatePassed);
  console.log("Transition via neutral:", decision.transitionViaNeutral);
  console.log("Transition allowed:", decision.transitionAllowed);
  if (decision.blockedReason) {
    console.log("Blocked:", decision.blockedReason);
  }
  console.log("Final emotion applied:", decision.finalEmotionApplied ?? "(none)");
  if (decision.emotionAfterUpdate !== undefined) {
    console.log("Active emotion (after):", decision.emotionAfterUpdate);
  }
  console.groupEnd();
};

export const logCompanionEmotionChange = (
  source: string,
  from: BlobEmotion,
  to: BlobEmotion
) => {
  if (!isCompanionDebugEnabled()) return;
  console.log(`[companion emotion] ${source}: ${from} → ${to}`);
};

export const logCompanionEmotionOverride = (
  expected: BlobEmotion,
  actual: BlobEmotion,
  source: string
) => {
  if (!isCompanionDebugEnabled()) return;
  console.warn(
    `[companion emotion] override detected (${source}): expected ${expected}, active ${actual}`
  );
};

export const logCompanionServer = (
  contextPreview: string,
  detail: string,
  parsed: CompanionAnalysis | null,
  source: CompanionAnalysisSource
) => {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[companion] source=${source} detail=${detail}`);
  console.log(
    `[companion] context (${contextPreview.length} chars):`,
    contextPreview.slice(0, 200) + (contextPreview.length > 200 ? "…" : "")
  );
  console.log(`[companion] raw/detail:`, detail.slice(0, 300));
  console.log(`[companion] parsed:`, parsed);
};
