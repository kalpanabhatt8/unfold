/**
 * Build the Patterns list from Postgres — bypasses client localStorage entirely.
 */

import { listServerReadyPatternsFromSnapshot } from "@/lib/patterns/server-ready-from-snapshot";
import { pullPatterns as pullPatternLayer } from "@/lib/server/patterns";
import type { SurfacedPattern } from "@/lib/patterns/types";
import type { PatternDisplay } from "@/lib/patterns/types";
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

  return {
    patterns,
    snapshot: { states, passages, displays },
    meta: pull.meta ?? {
      states: states.length,
      passages: passages.length,
      displays: displays.length,
    },
  };
};
