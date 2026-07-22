/**
 * Unit checks for overlap suppression policy.
 * Run: npx tsx scripts/test-overlap-policy.ts
 */

import {
  applyOverlapSuppression,
  compareSurvivorPriority,
  entryOverlapRatio,
  filterCoPatternsExcludingSuppressed,
  OVERLAP_SUPPRESSION_THRESHOLD,
  pickClusterSurvivor,
} from "../src/lib/patterns/overlap-policy";
import type {
  PatternEvidenceItem,
  SurfacedPattern,
} from "../src/lib/patterns/types";
import type { PatternName } from "../src/lib/patterns/vocabulary";

let passed = 0;
let failed = 0;

const assert = (label: string, condition: boolean, detail?: string) => {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const evidenceFor = (
  entryIds: string[],
  confidence = 0.8,
): PatternEvidenceItem[] =>
  entryIds.map((entryId, index) => ({
    entryId,
    entryTitle: `Entry ${index + 1}`,
    createdAt: index,
    quotes: ["quote"],
    confidence,
  }));

const mockSurfaced = (
  name: PatternName,
  entryIds: string[],
  confidence = 0.8,
): SurfacedPattern => {
  const evidence = evidenceFor(entryIds, confidence);
  return {
    name,
    entryCount: evidence.length,
    evidence,
    timeHint: null,
    coPatterns: [],
    foldedLabels: [],
    suppressedPatterns: [],
    display: null,
  };
};

const ids = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}`);

console.log("threshold constant");
{
  assert("default threshold is 0.65", OVERLAP_SUPPRESSION_THRESHOLD === 0.65);
}

console.log("1. subset collapse — smaller pattern folded");
{
  const shared = ids("shared", 5);
  const extra = ids("extra", 5);
  const input = [
    mockSurfaced("overthinking", [...shared, ...extra]),
    mockSurfaced("fear_of_judgment", shared),
  ];
  const result = applyOverlapSuppression(input);
  assert("one surfaced card", result.length === 1, `got ${result.length}`);
  assert(
    "survivor is larger bucket",
    result[0]?.name === "overthinking",
    result[0]?.name,
  );
  assert(
    "smaller pattern folded",
    result[0]?.suppressedPatterns.includes("fear_of_judgment") === true,
    JSON.stringify(result[0]?.suppressedPatterns),
  );
  assert(
    "folded label present",
    result[0]?.foldedLabels.includes("Fear of judgment") === true,
    JSON.stringify(result[0]?.foldedLabels),
  );
}

console.log("2. threshold boundary — 64% vs 65%");
{
  const shared64 = ids("b64", 16);
  const onlyA64 = ids("only-a-64", 9);
  const onlyB64 = ids("only-b-64", 9);
  const at64 = applyOverlapSuppression([
    mockSurfaced("comparison", [...shared64, ...onlyA64]),
    mockSurfaced("self_doubt", [...shared64, ...onlyB64]),
  ]);
  assert(
    "64% overlap keeps both cards",
    at64.length === 2,
    `overlap=${entryOverlapRatio(
      mockSurfaced("comparison", [...shared64, ...onlyA64]),
      mockSurfaced("self_doubt", [...shared64, ...onlyB64]),
    )} count=${at64.length}`,
  );

  const shared65 = ids("b65", 13);
  const padA = ids("only-a-65", 7);
  const padB = ids("only-b-65", 7);
  const at65 = applyOverlapSuppression([
    mockSurfaced("comparison", [...shared65, ...padA]),
    mockSurfaced("self_doubt", [...shared65, ...padB]),
  ]);
  assert(
    "65% overlap collapses to one card",
    at65.length === 1,
    `overlap=${entryOverlapRatio(
      mockSurfaced("comparison", [...shared65, ...padA]),
      mockSurfaced("self_doubt", [...shared65, ...padB]),
    )} count=${at65.length}`,
  );
}

console.log("3. transitive union-find cluster");
{
  const abShared = ids("ab", 4);
  const aOnly = ids("a-only", 1);
  const bcShared = ids("bc", 4);
  const cOnly = ids("c-only", 1);
  const input = [
    mockSurfaced("overthinking", [...abShared, ...aOnly]),
    mockSurfaced("fear_of_judgment", [...abShared, ...bcShared]),
    mockSurfaced("catastrophizing", [...bcShared, ...cOnly]),
  ];
  assert(
    "A-B overlap at threshold",
    entryOverlapRatio(input[0]!, input[1]!) >= OVERLAP_SUPPRESSION_THRESHOLD,
  );
  assert(
    "B-C overlap at threshold",
    entryOverlapRatio(input[1]!, input[2]!) >= OVERLAP_SUPPRESSION_THRESHOLD,
  );
  assert(
    "A-C direct overlap below threshold",
    entryOverlapRatio(input[0]!, input[2]!) < OVERLAP_SUPPRESSION_THRESHOLD,
  );

  const result = applyOverlapSuppression(input);
  assert("three-pattern chain is one cluster", result.length === 1, `${result.length}`);
  assert(
    "two patterns suppressed",
    result[0]?.suppressedPatterns.length === 2,
    JSON.stringify(result[0]?.suppressedPatterns),
  );
}

console.log("4. tie-break — specificity beats overthinking");
{
  const shared = ids("spec", 4);
  const members = [
    mockSurfaced("overthinking", shared, 0.95),
    mockSurfaced("catastrophizing", shared, 0.95),
  ];
  assert(
    "same entry count",
    members[0]!.entryCount === members[1]!.entryCount,
  );
  assert(
    "catastrophizing outranks overthinking",
    compareSurvivorPriority(members[1]!, members[0]!) < 0,
  );
  const result = applyOverlapSuppression(members);
  assert(
    "catastrophizing survives",
    result[0]?.name === "catastrophizing",
    result[0]?.name,
  );
}

console.log("5. tie-break — mean confidence");
{
  const shared = ids("conf", 4);
  const members = [
    mockSurfaced("comparison", shared, 0.95),
    mockSurfaced("self_doubt", shared, 0.6),
  ];
  assert(
    "comparison wins on confidence",
    pickClusterSurvivor(members).name === "comparison",
  );
}

console.log("6. tie-break — stable PATTERN_NAMES order");
{
  const shared = ids("order", 4);
  const members = [
    mockSurfaced("self_doubt", shared, 0.8),
    mockSurfaced("comparison", shared, 0.8),
  ];
  assert(
    "comparison wins on name order",
    pickClusterSurvivor(members).name === "comparison",
  );
}

console.log("7. singleton unchanged metadata shape");
{
  const result = applyOverlapSuppression([
    mockSurfaced("avoidance", ids("solo", 4)),
  ]);
  assert("singleton survives", result.length === 1);
  assert(
    "no suppressed patterns",
    result[0]?.suppressedPatterns.length === 0,
  );
  assert("no folded labels", result[0]?.foldedLabels.length === 0);
}

console.log("8. coPatterns excludes folded labels");
{
  const filtered = filterCoPatternsExcludingSuppressed(
    ["Fear of judgment", "Comparison"],
    ["fear_of_judgment"],
  );
  assert(
    "folded label stripped from coPatterns",
    filtered.length === 1 && filtered[0] === "Comparison",
    JSON.stringify(filtered),
  );

  const shared = ids("co", 5);
  const collapsed = applyOverlapSuppression([
    mockSurfaced("overthinking", shared),
    mockSurfaced("fear_of_judgment", shared),
  ]);
  assert(
    "folded label not duplicated in coPatterns",
    collapsed[0]?.coPatterns.includes("Fear of judgment") !== true,
    JSON.stringify(collapsed[0]?.coPatterns),
  );
}

console.log("");
if (failed === 0) {
  console.log(`All ${passed} overlap-policy checks passed.`);
} else {
  console.error(`${failed} failed, ${passed} passed.`);
  process.exit(1);
}
