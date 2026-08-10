/**
 * Phase 3 recurrence gate for cross-entry surfacing.
 * Run: npx tsx scripts/test-pattern-aggregate-recurrence.ts
 */

import { aggregateFromInputs } from "../src/lib/patterns/aggregate";
import { extractionProvenance } from "../src/lib/patterns/analysis-freshness";
import { decidePatternRecurrence } from "../src/lib/patterns/recurrence";
import type { EntryAnalysis } from "../src/lib/patterns/types";
import type { JournalEntry } from "../src/lib/journal-entries";
import {
  SURFACE_MIN_ENTRIES,
  SURFACE_MIN_PRIMARY_ENTRIES,
  SURFACE_VOTE_MIN_CONFIDENCE,
} from "../src/lib/patterns/vocabulary";

const ENTRY_TEXT = "journal body for aggregation tests";

let passed = 0;
let failed = 0;

const assert = (label: string, condition: boolean, detail?: string) => {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` - ${detail}` : ""}`);
  }
};

const entry = (id: string, extras?: Partial<JournalEntry>): JournalEntry => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  sealedAt: 1,
  searchText: ENTRY_TEXT,
  ...extras,
});

const analysis = (
  entryId: string,
  patterns: EntryAnalysis["patterns"],
  provenanceText: string = ENTRY_TEXT,
): EntryAnalysis => ({
  entryId,
  topics: [],
  patterns,
  ...extractionProvenance(provenanceText),
});

console.log("constants");
{
  assert("SURFACE_MIN_ENTRIES stays 3", SURFACE_MIN_ENTRIES === 3);
  assert(
    "vote confidence gate above entry floor",
    SURFACE_VOTE_MIN_CONFIDENCE > 0.5,
  );
  assert(
    "primary minimum is below entry minimum",
    SURFACE_MIN_PRIMARY_ENTRIES < SURFACE_MIN_ENTRIES &&
      SURFACE_MIN_PRIMARY_ENTRIES >= 1,
  );
}

console.log("three weak secondary tags do not surface");
{
  // Same shape as "possible avoidance in several entries" that should NOT
  // become "you have an avoidance pattern".
  const entries = [entry("e1"), entry("e2"), entry("e3")];
  const analyses = [
    analysis("e1", [
      { name: "fear_of_judgment", confidence: 0.95, evidence: ["worried what they think"] },
      { name: "avoidance", confidence: 0.7, evidence: ["put off sending it"] },
    ]),
    analysis("e2", [
      { name: "people_pleasing", confidence: 0.94, evidence: ["said yes again"] },
      { name: "avoidance", confidence: 0.72, evidence: ["didn't open the application"] },
    ]),
    analysis("e3", [
      { name: "self_criticism", confidence: 0.9, evidence: ["I messed it up"] },
      { name: "avoidance", confidence: 0.68, evidence: ["changed plans again"] },
    ]),
  ];

  const result = aggregateFromInputs(analyses, entries, {
    applyOverlapSuppression: false,
    logRecurrence: false,
  });
  const decision = result.recurrence.find((d) => d.name === "avoidance");
  assert("avoidance not surfaced", !result.surfaced.some((s) => s.name === "avoidance"));
  assert(
    "reject reason is insufficient_strong_votes or insufficient_primary_votes",
    decision?.reason === "insufficient_strong_votes" ||
      decision?.reason === "insufficient_primary_votes",
    decision?.reason,
  );
}

console.log("three strong but secondary-only tags do not surface");
{
  const entries = [entry("e1"), entry("e2"), entry("e3")];
  const analyses = [
    analysis("e1", [
      { name: "fear_of_judgment", confidence: 0.95, evidence: ["worried what they think"] },
      { name: "avoidance", confidence: 0.88, evidence: ["put off sending it"] },
    ]),
    analysis("e2", [
      { name: "people_pleasing", confidence: 0.94, evidence: ["said yes again"] },
      { name: "avoidance", confidence: 0.85, evidence: ["didn't open the application"] },
    ]),
    analysis("e3", [
      { name: "self_criticism", confidence: 0.92, evidence: ["I messed it up"] },
      { name: "avoidance", confidence: 0.8, evidence: ["walked away from the task"] },
    ]),
  ];

  const result = aggregateFromInputs(analyses, entries, {
    applyOverlapSuppression: false,
    logRecurrence: false,
  });
  const decision = result.recurrence.find((d) => d.name === "avoidance");
  assert("avoidance not surfaced", !result.surfaced.some((s) => s.name === "avoidance"));
  assert(
    "reject reason insufficient_primary_votes",
    decision?.reason === "insufficient_primary_votes",
    decision?.reason,
  );
  assert("strong vote count is 3", decision?.strongVotes === 3);
  assert("primary vote count is 0", decision?.primaryVotes === 0);
}

console.log("genuine recurring primary pattern still surfaces");
{
  const entries = [entry("e1"), entry("e2"), entry("e3"), entry("e4")];
  const analyses = [
    analysis("e1", [
      {
        name: "comparison",
        confidence: 0.95,
        evidence: ["She's already managing a team while I'm still trying"],
      },
    ]),
    analysis("e2", [
      {
        name: "comparison",
        confidence: 0.9,
        evidence: ["Everyone my age is already leading teams and I'm still here"],
      },
    ]),
    analysis("e3", [
      {
        name: "comparison",
        confidence: 0.88,
        evidence: ["I keep measuring mine against hers"],
      },
      {
        name: "self_doubt",
        confidence: 0.7,
        evidence: ["not sure I can do this"],
      },
    ]),
    analysis("e4", [
      {
        name: "catastrophizing",
        confidence: 0.93,
        evidence: ["if this fails everything collapses"],
      },
    ]),
  ];

  const result = aggregateFromInputs(analyses, entries, {
    applyOverlapSuppression: false,
    logRecurrence: false,
  });
  const comparison = result.surfaced.find((s) => s.name === "comparison");
  const decision = result.recurrence.find((d) => d.name === "comparison");
  assert("comparison surfaced", Boolean(comparison));
  assert("reason surfaced", decision?.reason === "surfaced");
  assert(
    "card evidence uses strong votes only",
    comparison?.entryCount === 3,
    `${comparison?.entryCount}`,
  );
  assert(
    "catastrophizing stays internal (one entry)",
    !result.surfaced.some((s) => s.name === "catastrophizing"),
  );
}

console.log("mixed primary + strong secondary can surface when gates met");
{
  // 2 primary + 1 strong secondary = enough for recurrence.
  const votes = [
    {
      isPrimary: true,
      item: {
        entryId: "a",
        entryTitle: "a",
        createdAt: 1,
        quotes: ["primary one"],
        confidence: 0.95,
      },
    },
    {
      isPrimary: true,
      item: {
        entryId: "b",
        entryTitle: "b",
        createdAt: 2,
        quotes: ["primary two"],
        confidence: 0.9,
      },
    },
    {
      isPrimary: false,
      item: {
        entryId: "c",
        entryTitle: "c",
        createdAt: 3,
        quotes: ["strong secondary"],
        confidence: 0.8,
      },
    },
  ];
  const { decision, evidence } = decidePatternRecurrence("avoidance", votes);
  assert("surfaces", decision.surfaced);
  assert("includes all three strong votes", evidence.length === 3);
}

console.log("quality-flagged entries never vote");
{
  const entries = [
    entry("e1"),
    entry("e2"),
    entry("e3", { qualityFlagged: true }),
  ];
  const analyses = [
    analysis("e1", [
      { name: "comparison", confidence: 0.95, evidence: ["I'm still here"] },
    ]),
    analysis("e2", [
      { name: "comparison", confidence: 0.9, evidence: ["so far behind"] },
    ]),
    analysis("e3", [
      { name: "comparison", confidence: 0.95, evidence: ["everyone else moved on"] },
    ]),
  ];
  const result = aggregateFromInputs(analyses, entries, {
    applyOverlapSuppression: false,
    logRecurrence: false,
  });
  assert(
    "does not surface with only two eligible entries",
    !result.surfaced.some((s) => s.name === "comparison"),
  );
}

console.log("stale promptVersion excluded from aggregation");
{
  const entries = [entry("e1"), entry("e2"), entry("e3")];
  const fresh = analysis("e1", [
    { name: "comparison", confidence: 0.95, evidence: ["I'm still here"] },
  ]);
  const staleV1: EntryAnalysis = {
    ...analysis("e2", [
      { name: "comparison", confidence: 0.9, evidence: ["so far behind"] },
    ]),
    promptVersion: "v1",
  };
  const missingVersion: EntryAnalysis = {
    entryId: "e3",
    topics: [],
    patterns: [
      { name: "comparison", confidence: 0.9, evidence: ["everyone else moved on"] },
    ],
    sourceContentHash: extractionProvenance(ENTRY_TEXT).sourceContentHash,
  };
  const result = aggregateFromInputs([fresh, staleV1, missingVersion], entries, {
    applyOverlapSuppression: false,
    logRecurrence: false,
  });
  assert("staleExcluded counts both non-current rows", result.staleExcluded === 2);
  assert(
    "comparison does not surface from one fresh + two stale",
    !result.surfaced.some((s) => s.name === "comparison"),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
