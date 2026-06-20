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

export type CompanionDebugSkipReason =
  | "below_word_threshold"
  | "duplicate_context"
  | "insufficient_word_delta"
  | "analysis_in_flight"
  | "stale_generation"
  | "context_changed_during_request"
  | "emotion_cooldown";

export type CompanionAnalysisSource = "gemini" | "local" | "api_fallback";

export type CompanionRawResponse = CompanionAnalysis & {
  _debug?: {
    source?: CompanionAnalysisSource;
    rawGemini?: string;
    fallbackReason?: string;
    geminiStatus?: number;
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
  sessionTextWords?: number;
  totalTextWords?: number;
  baselineTokenCount?: number;
  emotionAfterUpdate?: BlobEmotion;
};

export const logCompanionSkipped = (
  reason: CompanionDebugSkipReason,
  details?: Record<string, unknown>
) => {
  if (!isCompanionDebugEnabled()) return;
  console.groupCollapsed("%c🌻 Companion classify skipped", "color:#888");
  console.log("Reason:", reason);
  if (details) console.log("Details:", details);
  console.groupEnd();
};

export const logCompanionAnalysisStart = (
  contextSent: string,
  details?: Record<string, unknown>
): (() => void) => {
  if (!isCompanionDebugEnabled()) return () => {};
  console.group("%c🌻 Companion classify started", "color:#c9a227;font-weight:bold");
  console.log("Strategy: delta-chunk (new text since last react, max 50 words)");
  console.log("Delta chunk sent:", contextSent);
  if (details) {
    for (const [key, value] of Object.entries(details)) {
      console.log(`${key}:`, value);
    }
  }
  return () => console.groupEnd();
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
    const reason = raw._debug.fallbackReason;
    if (reason === "gemini_quota_exceeded") {
      console.warn(
        "%c🌻 Gemini quota exceeded (429) — using local classifier. Set COMPANION_FORCE_LOCAL=true in .env.local to skip Gemini calls during dev.",
        "color:#c0392b;font-weight:bold"
      );
    } else {
      console.warn("Fallback reason:", reason);
    }
  }
  if (raw._debug?.geminiStatus) {
    console.warn("Gemini HTTP status:", raw._debug.geminiStatus);
  }
  if (raw._debug?.rawGemini) console.log("Raw Gemini text:", raw._debug.rawGemini);
};

export const logCompanionApplyDecision = (decision: CompanionApplyDecision) => {
  if (!isCompanionDebugEnabled()) return;
  if (decision.sessionTextWords !== undefined) {
    console.log("Delta text words:", decision.sessionTextWords);
  }
  if (decision.totalTextWords !== undefined) {
    console.log("Total canvas words:", decision.totalTextWords);
  }
  if (decision.baselineTokenCount !== undefined) {
    console.log("Session baseline tokens:", decision.baselineTokenCount);
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

export const logCompanionSessionReset = (details: Record<string, unknown>) => {
  if (!isCompanionDebugEnabled()) return;
  console.group("%c🌻 Companion session reset", "color:#6b8e23;font-weight:bold");
  for (const [key, value] of Object.entries(details)) {
    console.log(`${key}:`, value);
  }
  console.groupEnd();
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
