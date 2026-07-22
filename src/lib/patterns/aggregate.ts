/**
 * Unfold — cross-entry aggregation for the Patterns page.
 *
 * Pure + local (no LLM). Rolls stored per-entry analyses into surfaced
 * patterns: count DISTINCT entries per pattern, keep only those crossing
 * SURFACE_MIN_ENTRIES, attach date-anchored evidence. One entry = one vote.
 */

import { readAllEntries, type JournalEntry } from "@/lib/journal-entries";
import { resolveBookDisplayTitle } from "@/lib/book-title";
import { listAnalyses } from "@/lib/patterns/analysis-store";
import { applyOverlapSuppression } from "@/lib/patterns/overlap-policy";
import { deriveTimeHint } from "@/lib/patterns/time-hint";
import { SURFACE_MIN_ENTRIES, type PatternName } from "@/lib/patterns/vocabulary";
import type {
  EntryAnalysis,
  PatternEvidenceItem,
  PatternsAggregate,
  SurfacedPattern,
} from "@/lib/patterns/types";

/** Build surfaced patterns from analyses + entries (test/replay helper). */
export function aggregateFromInputs(
  analyses: EntryAnalysis[],
  entries: JournalEntry[],
  options?: { applyOverlapSuppression?: boolean },
): PatternsAggregate {
  const entriesById = new Map<string, JournalEntry>(
    entries.map((entry) => [entry.id, entry]),
  );

  const byPattern = new Map<PatternName, PatternEvidenceItem[]>();

  for (const analysis of analyses) {
    const entry = entriesById.get(analysis.entryId);
    if (!entry) continue; // entry deleted — drop its analysis contribution
    if (entry.crisisFlagged === true) continue; // never count crisis-flagged entries
    if (entry.qualityFlagged === true) continue; // never count quality-flagged entries

    // Dedupe patterns within an entry (should already be unique) so each
    // entry contributes at most one vote per pattern.
    const seen = new Set<PatternName>();
    for (const pattern of analysis.patterns) {
      if (seen.has(pattern.name)) continue;
      seen.add(pattern.name);

      const item: PatternEvidenceItem = {
        entryId: analysis.entryId,
        entryTitle: resolveBookDisplayTitle(entry.title),
        createdAt: entry.createdAt,
        sealedAt: typeof entry.sealedAt === "number" ? entry.sealedAt : undefined,
        lastEditedAt: entry.lastEditedAt,
        quotes: pattern.evidence,
        confidence: pattern.confidence,
      };

      const bucket = byPattern.get(pattern.name);
      if (bucket) bucket.push(item);
      else byPattern.set(pattern.name, [item]);
    }
  }

  const surfaced: SurfacedPattern[] = [];
  for (const [name, evidence] of byPattern) {
    if (evidence.length < SURFACE_MIN_ENTRIES) continue;
    evidence.sort(
      (a, b) =>
        (b.sealedAt ?? b.lastEditedAt ?? b.createdAt) -
        (a.sealedAt ?? a.lastEditedAt ?? a.createdAt),
    );
    surfaced.push({
      name,
      entryCount: evidence.length,
      evidence,
      timeHint: deriveTimeHint(evidence),
      coPatterns: [],
      foldedLabels: [],
      suppressedPatterns: [],
      display: null,
    });
  }

  surfaced.sort((a, b) => b.entryCount - a.entryCount);

  const applySuppression = options?.applyOverlapSuppression !== false;

  return {
    analyzedEntryCount: analyses.length,
    surfaced: applySuppression ? applyOverlapSuppression(surfaced) : surfaced,
  };
}

export function aggregateAnalyses(): PatternsAggregate {
  return aggregateFromInputs(listAnalyses(), readAllEntries());
}
