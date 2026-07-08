import {
  PATTERN_LABELS,
  type PatternName,
} from "@/lib/patterns/vocabulary";
import type { PatternDisplay } from "@/lib/patterns/types";

/** Deterministic fallback when display generation fails — vocabulary label only. */
export function fallbackDisplay(
  name: PatternName,
  evidenceKey: string,
): PatternDisplay {
  return {
    displayTitle: PATTERN_LABELS[name],
    summary: null,
    sourceEvidenceKey: evidenceKey,
    createdAt: Date.now(),
  };
}
