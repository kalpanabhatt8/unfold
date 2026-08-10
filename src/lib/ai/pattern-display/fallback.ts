import {
  PATTERN_FALLBACK_HOOKS,
  PATTERN_NAMES,
  type PatternName,
} from "@/lib/patterns/vocabulary-public";
import type { PatternDisplay } from "@/lib/patterns/types";

/**
 * Tension-first fallbacks when hook generation fails - never psychology labels.
 * Hooks live in vocabulary-public so the client fallback path never pulls the
 * server catalog (definitions / examples).
 */
const PATTERN_HOOK_FALLBACKS: Record<PatternName, string> = Object.fromEntries(
  PATTERN_NAMES.map((name) => [name, PATTERN_FALLBACK_HOOKS[name]]),
) as Record<PatternName, string>;

export function fallbackDisplay(
  name: PatternName,
  evidenceKey: string,
): PatternDisplay {
  return {
    displayTitle: PATTERN_HOOK_FALLBACKS[name],
    summary: null,
    sourceEvidenceKey: evidenceKey,
    createdAt: Date.now(),
  };
}
