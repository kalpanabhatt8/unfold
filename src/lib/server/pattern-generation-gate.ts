import "server-only";

import {
  PATTERN_GENERATION_MIN_SEALED_ENTRIES,
  PATTERN_GENERATION_MIN_TOTAL_WORDS,
} from "@/lib/patterns/generation-gate-public";
import { countWords } from "@/lib/patterns/entry-text";
import { resolveEntryText } from "@/lib/server/entry-text";
import { db } from "@/lib/server/db";

export type PatternGenerationGate = {
  sealedCount: number;
  totalWords: number;
  latestSealAt: Date | null;
  patternsGeneratedAt: Date | null;
  /** All three thresholds met (entry count, words, stale vs last seal). */
  needsGeneration: boolean;
  skipReason: string | null;
};

const countSealedWords = (text: string): number => countWords(text);

export const evaluatePatternGenerationGate = async (
  userId: string,
  options?: { bypassThresholds?: boolean },
): Promise<PatternGenerationGate> => {
  const [user, sealedRows] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { patternsGeneratedAt: true },
    }),
    db.journalEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        sealedAt: { not: null },
        crisisFlagged: false,
        qualityFlagged: false,
      },
      select: { searchText: true, content: true, sealedAt: true },
      orderBy: { sealedAt: "desc" },
    }),
  ]);

  const sealedCount = sealedRows.length;
  let totalWords = 0;
  let latestSealAt: Date | null = null;

  for (const row of sealedRows) {
    totalWords += countSealedWords(resolveEntryText(row));
    if (!latestSealAt && row.sealedAt) latestSealAt = row.sealedAt;
  }

  const patternsGeneratedAt = user?.patternsGeneratedAt ?? null;

  if (options?.bypassThresholds) {
    const stale =
      latestSealAt !== null &&
      (patternsGeneratedAt === null ||
        patternsGeneratedAt.getTime() < latestSealAt.getTime());
    return {
      sealedCount,
      totalWords,
      latestSealAt,
      patternsGeneratedAt,
      needsGeneration: stale,
      skipReason: stale ? null : "patterns_current",
    };
  }

  if (sealedCount < PATTERN_GENERATION_MIN_SEALED_ENTRIES) {
    return {
      sealedCount,
      totalWords,
      latestSealAt,
      patternsGeneratedAt,
      needsGeneration: false,
      skipReason: "insufficient_entries",
    };
  }

  if (totalWords < PATTERN_GENERATION_MIN_TOTAL_WORDS) {
    return {
      sealedCount,
      totalWords,
      latestSealAt,
      patternsGeneratedAt,
      needsGeneration: false,
      skipReason: "insufficient_words",
    };
  }

  if (!latestSealAt) {
    return {
      sealedCount,
      totalWords,
      latestSealAt,
      patternsGeneratedAt,
      needsGeneration: false,
      skipReason: "no_sealed_entries",
    };
  }

  if (
    patternsGeneratedAt !== null &&
    patternsGeneratedAt.getTime() >= latestSealAt.getTime()
  ) {
    return {
      sealedCount,
      totalWords,
      latestSealAt,
      patternsGeneratedAt,
      needsGeneration: false,
      skipReason: "patterns_current",
    };
  }

  return {
    sealedCount,
    totalWords,
    latestSealAt,
    patternsGeneratedAt,
    needsGeneration: true,
    skipReason: null,
  };
};

export const markPatternsGenerated = async (
  userId: string,
  at: Date,
): Promise<void> => {
  await db.user.upsert({
    where: { id: userId },
    create: { id: userId, patternsGeneratedAt: at },
    update: { patternsGeneratedAt: at },
  });
};
