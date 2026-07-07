import type { EntryAnalysisResult } from "@/lib/patterns/types";
import type { ExtractionFailureReason } from "@/lib/ai/pattern-extraction/constants";

/**
 * Extraction fallback strategy: no synthetic analysis — return null and retry
 * later via the reconciler. Never invent patterns or quotes.
 */
export function fallbackExtraction(
  reason: ExtractionFailureReason,
): EntryAnalysisResult {
  return { analysis: null, reason };
}
