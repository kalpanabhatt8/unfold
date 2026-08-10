/**
 * TEMPORARY — assemble a full per-entry / aggregate debug report from local data.
 * Delete after the extraction/aggregation experiment.
 */

import {
  aggregateAnalyses,
  aggregateFromInputs,
} from "@/lib/patterns/aggregate";
import { getAnalysis, listAnalyses } from "@/lib/patterns/analysis-store";
import { buildDiscoveryArc } from "@/lib/patterns/discovery-arc";
import { readAllEntries, type JournalEntry } from "@/lib/journal-entries";
import { readEntryText } from "@/lib/patterns/entry-text";
import {
  getPipelineDebug,
  type PatternPipelineDebugRecord,
} from "@/lib/patterns/pattern-pipeline-debug-store";
import { getCachedPassage } from "@/lib/patterns/passage-store";
import { getCachedDisplay } from "@/lib/patterns/pattern-display-store";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import type { RecurrenceDecision } from "@/lib/patterns/recurrence";
import type { PatternName } from "@/lib/patterns/vocabulary-public";

const unavailable = (reason: string) =>
  ({ available: false as const, reason });

export type EntryPipelineDebugReport = {
  entry: {
    id: string;
    title: string;
    text: string;
    sealedAt?: number;
    qualityFlagged?: boolean;
    crisisFlagged?: boolean;
  };
  rawLLM:
    | { available: true; model: string; response: string }
    | { available: false; reason: string };
  parsedExtraction: unknown;
  validation: unknown;
  arbitration: unknown;
  finalAnalysis: unknown;
  aggregation: {
    contributingPatterns: Array<{
      pattern: string;
      confidence: number;
      evidence: string[];
      surfaces: boolean;
      entryCountForPattern: number;
      recurrenceReason: RecurrenceDecision["reason"] | null;
    }>;
    surfacedPatterns: Array<{
      pattern: string;
      entryCount: number;
      thisEntryIncluded: boolean;
    }>;
    recurrence: RecurrenceDecision[];
  };
  generatedSlots: {
    available: boolean;
    reason?: string;
    byPattern: Array<{
      pattern: string;
      displayTitle: string | null;
      moments: string[];
      loop: string | null;
      question: string | null;
    }>;
  };
  debugCapture: PatternPipelineDebugRecord | null;
};

export type FullPipelineDebugExport = {
  exportedAt: string;
  note: string;
  aggregationOverview: {
    analyzedEntryCount: number;
    staleExcluded: number;
    surfaced: Array<{
      pattern: string;
      entryCount: number;
      entries: Array<{
        entryId: string;
        confidence: number;
        evidence: string[];
      }>;
    }>;
    /** Why each candidate pattern was surfaced or held back. */
    recurrence: RecurrenceDecision[];
  };
  entries: EntryPipelineDebugReport[];
};

export function buildEntryPipelineDebugReport(
  entry: JournalEntry,
): EntryPipelineDebugReport {
  const text = readEntryText(entry.id) || entry.searchText || "";
  const analysis = getAnalysis(entry.id);
  const debug = getPipelineDebug(entry.id);
  const aggregate = aggregateFromInputs(listAnalyses(), readAllEntries(), {
    logRecurrence: false,
  });

  const contributingPatterns =
    analysis?.patterns.map((p) => {
      const surfaced = aggregate.surfaced.find((s) => s.name === p.name);
      const recurrence = aggregate.recurrence.find((d) => d.name === p.name);
      return {
        pattern: p.name,
        confidence: p.confidence,
        evidence: p.evidence,
        surfaces: Boolean(surfaced),
        entryCountForPattern: surfaced?.entryCount ?? 0,
        recurrenceReason: recurrence?.reason ?? null,
      };
    }) ?? [];

  const surfacedPatterns = aggregate.surfaced.map((s) => ({
    pattern: s.name,
    entryCount: s.entryCount,
    thisEntryIncluded: s.evidence.some((e) => e.entryId === entry.id),
  }));

  const byPattern: EntryPipelineDebugReport["generatedSlots"]["byPattern"] = [];
  for (const s of aggregate.surfaced) {
    if (!s.evidence.some((e) => e.entryId === entry.id)) continue;
    const passage = getCachedPassage(s.name as PatternName);
    const evidenceKey = buildEvidenceKey(s.evidence);
    const display = getCachedDisplay(s.name, evidenceKey);
    if (!passage) {
      byPattern.push({
        pattern: s.name,
        displayTitle: display?.displayTitle ?? null,
        moments: s.evidence
          .filter((e) => e.entryId === entry.id)
          .flatMap((e) => e.quotes),
        loop: null,
        question: null,
      });
      continue;
    }
    const arc = buildDiscoveryArc(
      passage.slots,
      display?.displayTitle ?? s.name,
      "",
      passage.shapeId,
    );
    byPattern.push({
      pattern: s.name,
      displayTitle: display?.displayTitle ?? null,
      moments: arc.evidence.visible.map((q) => q.text),
      loop: arc.mechanism?.text ?? null,
      question: arc.reflection.question || null,
    });
  }

  return {
    entry: {
      id: entry.id,
      title: entry.title || "(untitled)",
      text,
      sealedAt: entry.sealedAt ?? undefined,
      qualityFlagged: entry.qualityFlagged,
      crisisFlagged: entry.crisisFlagged,
    },
    rawLLM: debug?.extraction.rawLLM.available
      ? {
          available: true,
          model: debug.extraction.model,
          response: debug.extraction.rawLLM.response,
        }
      : unavailable(
          "Not available — raw LLM was not captured for this entry. Use “Re-run extraction (debug)” on the debug page (stores trace only; does not change product analysis unless you choose to).",
        ),
    parsedExtraction: debug?.extraction.parsedExtraction ??
      unavailable("Not available — no debug capture for this entry yet."),
    validation: debug?.extraction.validation ??
      unavailable("Not available — no debug capture for this entry yet."),
    arbitration: debug?.extraction.arbitration ??
      unavailable("Not available — no debug capture for this entry yet."),
    finalAnalysis: analysis
      ? {
          available: true,
          source: "persisted EntryAnalysis (post validation + arbitration)",
          topics: analysis.topics,
          patterns: analysis.patterns,
        }
      : unavailable(
          entry.qualityFlagged || entry.crisisFlagged
            ? "No analysis — entry was quality/crisis flagged before extraction."
            : "No persisted EntryAnalysis for this entry.",
        ),
    aggregation: {
      contributingPatterns,
      surfacedPatterns,
      recurrence: aggregate.recurrence,
    },
    generatedSlots: {
      available: byPattern.length > 0,
      reason:
        byPattern.length === 0
          ? "This entry does not contribute to any currently surfaced pattern, or passages are not generated yet."
          : undefined,
      byPattern,
    },
    debugCapture: debug,
  };
}

export function buildFullPipelineDebugExport(): FullPipelineDebugExport {
  const entries = readAllEntries().sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );
  const aggregate = aggregateFromInputs(listAnalyses(), entries, {
    logRecurrence: false,
  });

  return {
    exportedAt: new Date().toISOString(),
    note: "TEMPORARY pattern pipeline debug export. Raw LLM / validation / arbitration only present when a debug capture exists (dev seal or manual re-run).",
    aggregationOverview: {
      analyzedEntryCount: aggregate.analyzedEntryCount,
      staleExcluded: aggregate.staleExcluded,
      surfaced: aggregate.surfaced.map((s) => ({
        pattern: s.name,
        entryCount: s.entryCount,
        entries: s.evidence.map((e) => ({
          entryId: e.entryId,
          confidence: e.confidence,
          evidence: e.quotes,
        })),
      })),
      recurrence: aggregate.recurrence,
    },
    entries: entries.map(buildEntryPipelineDebugReport),
  };
}

/** Sanity: analyses count for the debug page header. */
export function debugStoreCounts(): {
  entries: number;
  analyses: number;
  debugCaptures: number;
  surfaced: number;
} {
  return {
    entries: readAllEntries().length,
    analyses: listAnalyses().length,
    debugCaptures: readAllEntries().filter((e) => getPipelineDebug(e.id)).length,
    surfaced: aggregateAnalyses().surfaced.length,
  };
}
