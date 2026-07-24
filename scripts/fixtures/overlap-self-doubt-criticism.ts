/**
 * Structural fixture: self_doubt vs self_criticism on a ~10-entry sample.
 * Entries 2 and 3 are the only shared votes — entry overlap = 2/4 = 0.5.
 *
 * Used by overlap-policy tests (Fix 3) and reusable for Fix 5 fixture sets.
 */

import type { EntryAnalysis } from "../../src/lib/patterns/types";
import type { JournalEntry } from "../../src/lib/journal-entries";
import type { PatternName } from "../../src/lib/patterns/vocabulary";

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 5, 1);

export const SELF_DOUBT_CRITICISM_SHARED_ENTRY_IDS = ["entry-2", "entry-3"] as const;

export type SelfDoubtCriticismFixture = {
  label: string;
  entries: JournalEntry[];
  analyses: EntryAnalysis[];
  /** Expected entry-overlap ratio (min bucket size). */
  expectedOverlap: number;
  expectedSurvivor: PatternName;
  expectedRelated: PatternName;
};

export function buildSelfDoubtCriticismFixture(): SelfDoubtCriticismFixture {
  /**
   * 6 analyzed entries (of a ~10-entry journal):
   *   self_doubt:      1, 2, 3, 5
   *   self_criticism:  2, 3, 4, 6
   * Shared: 2, 3 → overlap = 2/4 = 0.5
   */
  const entrySpecs: Array<{
    id: string;
    patterns: PatternName[];
    quotes: Partial<Record<PatternName, string>>;
  }> = [
    {
      id: "entry-1",
      patterns: ["self_doubt"],
      quotes: {
        self_doubt: "Maybe I'm just not cut out for shipping anything real",
      },
    },
    {
      id: "entry-2",
      patterns: ["self_doubt", "self_criticism"],
      quotes: {
        self_doubt: "calling myself unreliable, like one missed half-day erases every deadline",
        self_criticism:
          "calling myself unreliable, like one missed half-day erases every deadline",
      },
    },
    {
      id: "entry-3",
      patterns: ["self_doubt", "self_criticism"],
      quotes: {
        self_doubt: "I keep deciding I'm the weak link before anyone else does",
        self_criticism: "I keep deciding I'm the weak link before anyone else does",
      },
    },
    {
      id: "entry-4",
      patterns: ["self_criticism"],
      quotes: {
        self_criticism: "Harsh rerun of everything I said in the meeting",
      },
    },
    {
      id: "entry-5",
      patterns: ["self_doubt"],
      quotes: {
        self_doubt: "Not sure I can finish this without someone catching the gaps",
      },
    },
    {
      id: "entry-6",
      patterns: ["self_criticism"],
      quotes: {
        self_criticism: "Told myself I ruined the tone of the whole draft",
      },
    },
  ];

  const entries: JournalEntry[] = entrySpecs.map((spec, index) => ({
    id: spec.id,
    title: `Entry ${spec.id}`,
    createdAt: BASE + index * DAY,
    updatedAt: BASE + index * DAY,
    sealedAt: BASE + index * DAY,
  }));

  const analyses: EntryAnalysis[] = entrySpecs.map((spec) => ({
    entryId: spec.id,
    topics: ["work"],
    patterns: spec.patterns.map((name) => ({
      name,
      confidence: 0.86,
      evidence: [spec.quotes[name] ?? `quote for ${name}`],
    })),
  }));

  return {
    label: "self_doubt vs self_criticism (entries 2+3 overlap, ratio 0.5)",
    entries,
    analyses,
    expectedOverlap: 0.5,
    expectedSurvivor: "self_doubt",
    expectedRelated: "self_criticism",
  };
}
