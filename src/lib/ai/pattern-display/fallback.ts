import {
  PATTERN_CATALOG,
  PATTERN_NAMES,
  type PatternName,
} from "@/lib/patterns/vocabulary";
import type { PatternDisplay } from "@/lib/patterns/types";

/**
 * Tension-first fallbacks when hook generation fails — never psychology labels.
 * Derived from PATTERN_CATALOG so the hook lives beside the pattern it belongs
 * to (single source); `check:pattern-vocab` guards each hook against echoing the
 * definition or label.
 */
const PATTERN_HOOK_FALLBACKS: Record<PatternName, string> = Object.fromEntries(
  PATTERN_NAMES.map((name) => [name, PATTERN_CATALOG[name].fallbackHook]),
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
