/**
 * Server-ready pattern list + page phase resolution tests.
 * Run: npx tsx --tsconfig tsconfig.json scripts/test-server-ready-patterns.ts
 */

import { aggregateFromInputs } from "../src/lib/patterns/aggregate";
import { isAnalysisCurrent } from "../src/lib/patterns/analysis-freshness";
import { resolvePatternsPagePhase } from "../src/lib/patterns/pattern-list-phase";
import { isServerReadyPatternVisible } from "../src/lib/patterns/server-ready-patterns";
import type { JournalEntry } from "../src/lib/journal-entries";
import type { EntryAnalysis, PatternDisplay } from "../src/lib/patterns/types";
import type { PatternPassage } from "../src/lib/patterns/passage-types";
import type { PatternName } from "../src/lib/patterns/vocabulary-public";

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

const SAMPLE_QUOTE = {
  entryId: "e1",
  entryTitle: "Again",
  text: "kept putting it off until tomorrow",
  confidence: 0.9,
  anchorTs: 1_700_000_000_000,
};

const buildPassage = (name: PatternName): PatternPassage => ({
  name,
  shapeId: "discovery",
  signature: "sig",
  depthTier: "recognition",
  endingKind: "question",
  lifecycle: "strong",
  cacheKey: `v6\x1ee1|e2|e3\x1estrong\x1esig`,
  createdAt: Date.now(),
  slots: [
    {
      kind: "moments",
      quotes: [
        SAMPLE_QUOTE,
        { ...SAMPLE_QUOTE, entryId: "e2" },
        { ...SAMPLE_QUOTE, entryId: "e3" },
      ],
    },
    { kind: "line", text: "The stall keeps returning before the send." },
    {
      kind: "close",
      endingKind: "question",
      text: "What would change if you sent it?",
      quote: null,
    },
  ],
});

const buildDisplay = (): PatternDisplay => ({
  displayTitle: "Left Until Tomorrow.",
  summary: null,
  sourceEvidenceKey: "e1|e2|e3",
  createdAt: Date.now(),
});

console.log("1. Server has patterns but local analysis is stale/mismatched");
{
  const entry: JournalEntry = {
    id: "e1",
    title: "Again",
    createdAt: 1,
    updatedAt: 2,
    sealedAt: 3,
    searchText: "different text than analysis hash",
  };
  const analysis: EntryAnalysis = {
    entryId: "e1",
    topics: ["work"],
    patterns: [],
    promptVersion: "v0",
    sourceContentHash: "mismatch",
  };
  assert("analysis is stale on hash mismatch", !isAnalysisCurrent(analysis, entry.searchText ?? ""));
  const agg = aggregateFromInputs([analysis], [entry]);
  assert("client aggregate surfaced is empty", agg.surfaced.length === 0);
  assert(
    "server-ready visibility does not need aggregate",
    isServerReadyPatternVisible("avoidance", buildPassage("avoidance"), buildDisplay()),
  );
}

console.log("2. Titles/voice still generating (incomplete passage)");
{
  const incomplete = buildPassage("overthinking");
  incomplete.slots = [
    { kind: "moments", quotes: [SAMPLE_QUOTE] },
    { kind: "line", text: null },
    { kind: "close", endingKind: "question", text: null, quote: null },
  ];
  assert(
    "incomplete passage is not server-ready visible",
    !isServerReadyPatternVisible("overthinking", incomplete, buildDisplay()),
  );
}

console.log("3. Everything complete on server artifacts");
{
  assert(
    "complete discovery passage is server-ready visible",
    isServerReadyPatternVisible("avoidance", buildPassage("avoidance"), buildDisplay()),
  );
}

console.log("4. No patterns — page phase before hydration");
{
  assert("null aggregate is loading", resolvePatternsPagePhase(null) === "loading");
}

console.log("5. No patterns — empty aggregate after hydration would be empty");
{
  assert(
    "empty aggregate before hydration is loading",
    resolvePatternsPagePhase({ analyzedEntryCount: 0, surfaced: [] }) === "loading",
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
