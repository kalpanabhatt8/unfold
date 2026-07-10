import type { PatternName } from "@/lib/patterns/vocabulary";
import type { PatternDisplay } from "@/lib/patterns/types";

/** Tension-first fallbacks when hook generation fails — never psychology labels. */
const PATTERN_HOOK_FALLBACKS: Record<PatternName, string> = {
  comparison: "Already Behind?",
  self_doubt: "Not Ready Yet?",
  overthinking: "Still Not Settled.",
  perfectionism: "Almost Finished.",
  avoidance: "Left Until Tomorrow.",
  catastrophizing: "What If Worst?",
  people_pleasing: "Their Comfort First?",
  fear_of_judgment: "Who's Watching?",
  self_criticism: "My Fault Again?",
  all_or_nothing: "No Middle Ground?",
};

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
