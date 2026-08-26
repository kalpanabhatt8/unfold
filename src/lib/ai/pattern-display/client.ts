import { BROWSER_PATTERN_AI_DISABLED } from "@/lib/ai/server-only-policy";
import { fallbackDisplay } from "@/lib/ai/pattern-display/fallback";
import { getCachedDisplay } from "@/lib/patterns/pattern-display-store";
import type { PatternDisplay } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary-public";

export type PatternDisplayInput = {
  name: PatternName;
  evidenceKey: string;
  quotes: string[];
};

/** Display copy is generated server-side — browser reads sync cache only. */
export async function fetchPatternDisplay(
  input: PatternDisplayInput,
): Promise<PatternDisplay> {
  const cached = getCachedDisplay(input.name, input.evidenceKey);
  if (cached) return cached;
  return fallbackDisplay(input.name, input.evidenceKey);
}
