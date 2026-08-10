/**
 * Unfold - cross-entry aggregation for the Patterns page.
 *
 * Pure + local (no LLM). Rolls stored per-entry analyses into surfaced
 * patterns. Entry-level tags may be broad; surfacing applies a conservative
 * recurrence gate (see recurrence.ts) before a pattern becomes user-visible.
 * One distinct entry = at most one vote per pattern.
 */

import { readAllEntries, type JournalEntry } from "@/lib/journal-entries";
import { resolveBookDisplayTitle } from "@/lib/book-title";
import { isAnalysisCurrent } from "@/lib/patterns/analysis-freshness";
import { listAnalyses } from "@/lib/patterns/analysis-store";
import { applyOverlapSuppression } from "@/lib/patterns/overlap-policy";
import {
  decidePatternRecurrence,
  logRecurrenceDecision,
  type RecurrenceDecision,
  type RecurrenceVote,
} from "@/lib/patterns/recurrence";
import { deriveTimeHint } from "@/lib/patterns/time-hint";
import type { PatternName } from "@/lib/patterns/vocabulary";
import type {
  EntryAnalysis,
  PatternEvidenceItem,
  PatternsAggregate,
  SurfacedPattern,
} from "@/lib/patterns/types";

export type AggregateFromInputsResult = PatternsAggregate & {
  /** Per-pattern recurrence decisions (debug / tests). */
  recurrence: RecurrenceDecision[];
  /** Analyses skipped because promptVersion/hash is not current. */
  staleExcluded: number;
};

/** Build surfaced patterns from analyses + entries (test/replay helper). */
export function aggregateFromInputs(
  analyses: EntryAnalysis[],
  entries: JournalEntry[],
  options?: { applyOverlapSuppression?: boolean; logRecurrence?: boolean },
): AggregateFromInputsResult {
  const entriesById = new Map<string, JournalEntry>(
    entries.map((entry) => [entry.id, entry]),
  );

  const byPattern = new Map<PatternName, RecurrenceVote[]>();
  let staleExcluded = 0;
  let freshAnalyzed = 0;

  for (const analysis of analyses) {
    const entry = entriesById.get(analysis.entryId);
    if (!entry) continue; // entry deleted - drop its analysis contribution
    if (entry.crisisFlagged === true) continue; // never count crisis-flagged entries
    if (entry.qualityFlagged === true) continue; // never count quality-flagged entries

    const entryText = entry.searchText ?? "";
    if (!isAnalysisCurrent(analysis, entryText)) {
      staleExcluded += 1;
      if (
        options?.logRecurrence ??
        (typeof process !== "undefined" &&
          process.env.NODE_ENV === "development")
      ) {
        console.info(
          `[pattern-aggregate] exclude_stale entry=${analysis.entryId} promptVersion=${analysis.promptVersion ?? "(missing)"}`,
        );
      }
      continue;
    }
    freshAnalyzed += 1;

    // Dedupe patterns within an entry (should already be unique) so each
    // entry contributes at most one vote per pattern.
    const seen = new Set<PatternName>();
    const maxConfidence = analysis.patterns.reduce(
      (max, pattern) => Math.max(max, pattern.confidence),
      0,
    );

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

      const vote: RecurrenceVote = {
        item,
        isPrimary: pattern.confidence >= maxConfidence,
      };

      const bucket = byPattern.get(pattern.name);
      if (bucket) bucket.push(vote);
      else byPattern.set(pattern.name, [vote]);
    }
  }

  const surfaced: SurfacedPattern[] = [];
  const recurrence: RecurrenceDecision[] = [];
  const shouldLog =
    options?.logRecurrence ??
    (typeof process !== "undefined" &&
      process.env.NODE_ENV === "development");

  for (const [name, votes] of byPattern) {
    const { decision, evidence } = decidePatternRecurrence(name, votes);
    recurrence.push(decision);
    if (shouldLog) logRecurrenceDecision(decision);
    if (!decision.surfaced) continue;

    surfaced.push({
      name,
      entryCount: evidence.length,
      evidence,
      timeHint: deriveTimeHint(evidence),
      coPatterns: [],
      foldedLabels: [],
      suppressedPatterns: [],
      relatedPatterns: [],
      display: null,
    });
  }

  surfaced.sort((a, b) => b.entryCount - a.entryCount);
  recurrence.sort((a, b) => a.name.localeCompare(b.name));

  const applySuppression = options?.applyOverlapSuppression !== false;

  return {
    analyzedEntryCount: freshAnalyzed,
    surfaced: applySuppression ? applyOverlapSuppression(surfaced) : surfaced,
    recurrence,
    staleExcluded,
  };
}

export function aggregateAnalyses(): PatternsAggregate {
  const { analyzedEntryCount, surfaced } = aggregateFromInputs(
    listAnalyses(),
    readAllEntries(),
  );
  return { analyzedEntryCount, surfaced };
}
