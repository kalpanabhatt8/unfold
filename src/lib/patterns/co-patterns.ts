/**
 * Find mental patterns that frequently co-occur with a surfaced pattern in the
 * same entries — the "often alongside" line on pattern cards.
 */

import { listAnalyses } from "@/lib/patterns/analysis-store";
import { PATTERN_LABELS, type PatternName } from "@/lib/patterns/vocabulary";

const MIN_CO_RATIO = 0.5;
const MIN_CO_COUNT = 2;

/** Labels for co-patterns that appear alongside `name` often enough. */
export function deriveCoPatterns(
  name: PatternName,
  entryIds: string[],
): string[] {
  if (entryIds.length < 2) return [];

  const entrySet = new Set(entryIds);
  const analyses = listAnalyses().filter((a) => entrySet.has(a.entryId));

  const counts = new Map<PatternName, number>();
  for (const analysis of analyses) {
    const coInEntry = new Set<PatternName>();
    for (const match of analysis.patterns) {
      if (match.name !== name) coInEntry.add(match.name);
    }
    for (const co of coInEntry) {
      counts.set(co, (counts.get(co) ?? 0) + 1);
    }
  }

  const threshold = Math.max(
    MIN_CO_COUNT,
    Math.ceil(entryIds.length * MIN_CO_RATIO),
  );

  return [...counts.entries()]
    .filter(([, n]) => n >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([coName]) => PATTERN_LABELS[coName]);
}
