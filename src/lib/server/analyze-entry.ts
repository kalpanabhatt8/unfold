import "server-only";

import { classifyContentQuality } from "@/lib/ai/content-quality/generate";
import { shouldSkipPatternExtractionForQuality } from "@/lib/ai/content-quality/constants";
import { classifyCrisisRisk } from "@/lib/ai/crisis-risk/generate";
import { extractPatterns } from "@/lib/ai/pattern-extraction/generate";
import { extractionProvenance, isAnalysisCurrent } from "@/lib/patterns/analysis-freshness";
import type { EntryAnalysis, PatternMatch } from "@/lib/patterns/types";
import { isPatternName } from "@/lib/patterns/vocabulary-public";
import { db } from "@/lib/server/db";
import { resolveEntryText } from "@/lib/server/entry-text";
import { pushAnalyses } from "@/lib/server/patterns";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const parsePatterns = (raw: unknown): PatternMatch[] => {
  if (!Array.isArray(raw)) return [];
  const patterns: PatternMatch[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (!isPatternName(item.name)) continue;
    if (typeof item.confidence !== "number") continue;
    if (!Array.isArray(item.evidence)) continue;
    patterns.push({
      name: item.name,
      confidence: item.confidence,
      evidence: item.evidence.filter((q): q is string => typeof q === "string"),
    });
  }
  return patterns;
};

const dbAnalysisToEntryAnalysis = (row: {
  entryId: string;
  topics: string[];
  patterns: unknown;
  sourceContentHash: string | null;
  promptVersion: string | null;
  modelId: string | null;
}): EntryAnalysis => ({
  entryId: row.entryId,
  topics: row.topics,
  patterns: parsePatterns(row.patterns),
  sourceContentHash: row.sourceContentHash ?? undefined,
  promptVersion: row.promptVersion ?? undefined,
  modelId: row.modelId ?? undefined,
});

/** True when a sealed entry still needs extraction under the current prompt version. */
export const entryNeedsAnalysis = (
  text: string,
  analysis: EntryAnalysis | null,
): boolean => {
  if (!text.trim()) return false;
  if (!analysis) return true;
  return !isAnalysisCurrent(analysis, text);
};

/**
 * Server-side port of `notifyEntryCompleted`: crisis → quality → extraction.
 * Persists analyses and entry flags directly to Postgres.
 */
export async function analyzeEntryOnServer(
  userId: string,
  entryId: string,
  apiKey: string,
): Promise<boolean> {
  const entry = await db.journalEntry.findFirst({
    where: { id: entryId, userId, deletedAt: null },
    include: { analysis: true },
  });
  if (!entry || !entry.sealedAt) return false;
  if (entry.crisisFlagged || entry.qualityFlagged) return false;

  const text = resolveEntryText(entry);
  if (!text.trim()) return false;

  const existing = entry.analysis
    ? dbAnalysisToEntryAnalysis(entry.analysis)
    : null;
  if (existing && isAnalysisCurrent(existing, text)) return false;

  try {
    let crisisFlagged = false;
    try {
      const crisis = await classifyCrisisRisk(apiKey, text);
      crisisFlagged = crisis.flagged === true;
    } catch (error) {
      console.error("[server-analyze] crisis classify failed", {
        userId,
        entryId,
        error,
      });
    }
    if (crisisFlagged) {
      await db.journalEntry.updateMany({
        where: { id: entryId, userId },
        data: { crisisFlagged: true, crisisFlaggedAt: new Date() },
      });
      console.info("[server-analyze] crisis flagged", { userId, entryId });
      return false;
    }

    let qualitySkip = false;
    try {
      const quality = await classifyContentQuality(apiKey, text);
      qualitySkip = shouldSkipPatternExtractionForQuality(quality);
    } catch (error) {
      console.error("[server-analyze] quality classify failed", {
        userId,
        entryId,
        error,
      });
    }
    if (qualitySkip) {
      await db.journalEntry.updateMany({
        where: { id: entryId, userId },
        data: { qualityFlagged: true, qualityFlaggedAt: new Date() },
      });
      console.info("[server-analyze] quality flagged", { userId, entryId });
      return false;
    }

    const result = await extractPatterns(apiKey, text);
    if (!result.analysis) {
      console.warn("[server-analyze] extraction failed", { userId, entryId });
      return false;
    }

    await pushAnalyses(userId, [
      {
        entryId,
        topics: result.analysis.topics,
        patterns: result.analysis.patterns,
        ...extractionProvenance(text),
      },
    ]);

    console.info("[server-analyze] ok", { userId, entryId });
    return true;
  } catch (error) {
    console.error("[server-analyze] error", { userId, entryId, error });
    return false;
  }
}

export { dbAnalysisToEntryAnalysis };
