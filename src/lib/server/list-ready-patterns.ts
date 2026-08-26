/**
 * Build the Patterns list from Postgres — bypasses client localStorage entirely.
 */

import { listServerReadyPatternsFromSnapshot } from "@/lib/patterns/server-ready-patterns";
import {
  PATTERN_GENERATION_MIN_SEALED_ENTRIES,
} from "@/lib/patterns/generation-gate-public";
import { pullPatterns as pullPatternLayer } from "@/lib/server/patterns";
import { db } from "@/lib/server/db";
import { isPatternGenerationInflight } from "@/lib/server/pattern-pipeline";
import type { PatternDisplay, SurfacedPattern } from "@/lib/patterns/types";
import type { PatternPassage } from "@/lib/patterns/passage-types";
import type { PatternState } from "@/lib/patterns/pattern-state";
import { isPatternName } from "@/lib/patterns/vocabulary-public";

export type ReadyPatternsPayload = {
  patterns: SurfacedPattern[];
  snapshot: {
    states: PatternState[];
    passages: PatternPassage[];
    displays: Array<{
      patternName: string;
      evidenceKey: string;
      displayTitle: string;
      summary: string | null;
      createdAt: number;
    }>;
  };
  meta: { states: number; passages: number; displays: number };
  /** Helps diagnose prod/dev Clerk userId mismatches — same email, different ids. */
  debug: {
    userId: string;
    sealedEntryCount: number;
    analysisCount: number;
  };
  /** True when the server kicked off generation — client should poll. */
  generating: boolean;
};

export const listReadyPatternsForUser = async (
  userId: string,
): Promise<ReadyPatternsPayload> => {
  const pull = await pullPatternLayer(userId);
  const states = pull.states;
  const passages = pull.passages;
  const displays = pull.displays.map((row) => ({
    patternName: row.patternName,
    evidenceKey: row.evidenceKey,
    displayTitle: row.displayTitle,
    summary: row.summary,
    createdAt: row.createdAt,
  }));

  const displayRecords: Array<{
    patternName: PatternPassage["name"];
    display: PatternDisplay;
  }> = [];
  for (const row of displays) {
    if (!isPatternName(row.patternName)) continue;
    displayRecords.push({
      patternName: row.patternName,
      display: {
        displayTitle: row.displayTitle,
        summary: row.summary,
        sourceEvidenceKey: row.evidenceKey,
        createdAt: row.createdAt,
      },
    });
  }

  const patterns = listServerReadyPatternsFromSnapshot({
    states,
    passages,
    displays: displayRecords,
  });

  const [sealedEntryCount, analysisCount] = await Promise.all([
    db.journalEntry.count({
      where: { userId, deletedAt: null, sealedAt: { not: null } },
    }),
    db.entryAnalysis.count({ where: { userId } }),
  ]);

  return {
    patterns,
    snapshot: { states, passages, displays },
    meta: pull.meta ?? {
      states: states.length,
      passages: passages.length,
      displays: displays.length,
    },
    debug: { userId, sealedEntryCount, analysisCount },
    generating: false,
  };
};

/** True when this account should run generation (caller schedules via `after()`). */
export const shouldSchedulePatternGeneration = (
  payload: ReadyPatternsPayload,
): boolean => {
  const { userId, sealedEntryCount } = payload.debug;
  if (payload.patterns.length > 0) return false;
  if (isPatternGenerationInflight(userId)) return false;
  if (sealedEntryCount < PATTERN_GENERATION_MIN_SEALED_ENTRIES) return false;
  return true;
};

export const isPatternGenerationActiveForPayload = (
  payload: ReadyPatternsPayload,
): boolean =>
  isPatternGenerationInflight(payload.debug.userId) ||
  shouldSchedulePatternGeneration(payload);

export const listReadyPatternsForUserWithGeneration = async (
  userId: string,
): Promise<ReadyPatternsPayload> => {
  const payload = await listReadyPatternsForUser(userId);
  const generating = isPatternGenerationActiveForPayload(payload);
  return { ...payload, generating };
};
