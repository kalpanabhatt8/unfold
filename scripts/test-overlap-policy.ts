/**
 * Unit checks for overlap suppression policy.
 * Run: npx tsx --tsconfig tsconfig.json scripts/test-overlap-policy.ts
 */

import { aggregateFromInputs } from "../src/lib/patterns/aggregate";
import {
  cosineSimilarity,
  embedMechanismText,
  MECHANISM_SIMILARITY_THRESHOLD,
} from "../src/lib/patterns/mechanism-embed";
import {
  applyOverlapSuppression,
  compareSurvivorPriority,
  entryOverlapRatio,
  filterCoPatternsExcludingSuppressed,
  formatRelatedPatternsLine,
  OVERLAP_SUPPRESSION_THRESHOLD,
  pickClusterSurvivor,
  shouldFoldPair,
} from "../src/lib/patterns/overlap-policy";
import type {
  PatternEvidenceItem,
  SurfacedPattern,
} from "../src/lib/patterns/types";
import type { PatternName } from "../src/lib/patterns/vocabulary";
import { buildSelfDoubtCriticismFixture } from "./fixtures/overlap-self-doubt-criticism";

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
  quote = "quote",
): PatternEvidenceItem[] =>
  entryIds.map((entryId, index) => ({
    entryId,
    entryTitle: `Entry ${index + 1}`,
    createdAt: index,
    quotes: [quote],
    confidence,
  }));

const mockSurfaced = (
  name: PatternName,
  entryIds: string[],
  confidence = 0.8,
  quote = `distinct loop language for ${name} ${entryIds.join(" ")}`,
): SurfacedPattern => {
  const evidence = evidenceFor(entryIds, confidence, quote);
  return {
    name,
    entryCount: evidence.length,
    evidence,
    timeHint: null,
    coPatterns: [],
    foldedLabels: [],
    suppressedPatterns: [],
    relatedPatterns: [],
    display: null,
  };
};

const ids = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}`);

console.log("threshold constants");
{
  assert("entry-overlap threshold is 0.5", OVERLAP_SUPPRESSION_THRESHOLD === 0.5);
  assert(
    "mechanism similarity threshold is 0.85",
    MECHANISM_SIMILARITY_THRESHOLD === 0.85,
  );
}

console.log("1. subset collapse — smaller pattern folded + relatedPatterns");
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
  assert(
    "relatedPatterns retains suppressed ref",
    result[0]?.relatedPatterns.some(
      (r) => r.name === "fear_of_judgment" && r.label === "Fear of judgment",
    ) === true,
    JSON.stringify(result[0]?.relatedPatterns),
  );
  assert(
    "UI related line",
    formatRelatedPatternsLine(result[0]!.relatedPatterns) ===
      "also shows up in: Fear of judgment",
  );
}

console.log("2. threshold boundary — 49% vs 50%");
{
  // 16/33 ≈ 0.485 < 0.5
  const shared49 = ids("b49", 16);
  const onlyA49 = ids("only-a-49", 17);
  const onlyB49 = ids("only-b-49", 17);
  const a49 = mockSurfaced("comparison", [...shared49, ...onlyA49]);
  const b49 = mockSurfaced("self_doubt", [...shared49, ...onlyB49]);
  const at49 = applyOverlapSuppression([a49, b49], {
    // Disable mechanism path so this isolates entry-overlap threshold.
    mechanismThreshold: 1.01,
  });
  assert(
    "49% overlap keeps both cards",
    at49.length === 2,
    `overlap=${entryOverlapRatio(a49, b49)} count=${at49.length}`,
  );

  // 2/4 = 0.5
  const shared50 = ids("b50", 2);
  const padA = ids("only-a-50", 2);
  const padB = ids("only-b-50", 2);
  const a50 = mockSurfaced("comparison", [...shared50, ...padA]);
  const b50 = mockSurfaced("self_doubt", [...shared50, ...padB]);
  const at50 = applyOverlapSuppression([a50, b50], {
    mechanismThreshold: 1.01,
  });
  assert(
    "50% overlap collapses to one card",
    at50.length === 1,
    `overlap=${entryOverlapRatio(a50, b50)} count=${at50.length}`,
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

  const result = applyOverlapSuppression(input, { mechanismThreshold: 1.01 });
  assert("three-pattern chain is one cluster", result.length === 1, `${result.length}`);
  assert(
    "two patterns suppressed",
    result[0]?.suppressedPatterns.length === 2,
    JSON.stringify(result[0]?.suppressedPatterns),
  );
  assert(
    "both retained as relatedPatterns",
    result[0]?.relatedPatterns.length === 2,
    JSON.stringify(result[0]?.relatedPatterns),
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
  const result = applyOverlapSuppression(members, { mechanismThreshold: 1.01 });
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
  assert("no relatedPatterns", result[0]?.relatedPatterns.length === 0);
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
  ], { mechanismThreshold: 1.01 });
  assert(
    "folded label not duplicated in coPatterns",
    collapsed[0]?.coPatterns.includes("Fear of judgment") !== true,
    JSON.stringify(collapsed[0]?.coPatterns),
  );
}

console.log("9. mechanism similarity fold without high entry overlap");
{
  const sharedLoop =
    "the same unreliable loop keeps rewriting every deadline into proof I am not enough";
  const a = mockSurfaced(
    "self_doubt",
    ids("mech-a", 4),
    0.85,
    sharedLoop,
  );
  const b = mockSurfaced(
    "self_criticism",
    ids("mech-b", 4),
    0.85,
    sharedLoop,
  );
  assert(
    "entry overlap below 0.5",
    entryOverlapRatio(a, b) < OVERLAP_SUPPRESSION_THRESHOLD,
    `${entryOverlapRatio(a, b)}`,
  );
  const sim = cosineSimilarity(
    embedMechanismText(sharedLoop),
    embedMechanismText(sharedLoop),
  );
  assert("identical loop text cosine is 1", sim >= 0.999, `${sim}`);
  assert(
    "shouldFoldPair trips on mechanism",
    shouldFoldPair(a, b, { entryThreshold: 0.5 }),
  );
  const result = applyOverlapSuppression([a, b]);
  assert("mechanism-similar pair collapses", result.length === 1, `${result.length}`);
  assert(
    "suppressed retained as relatedPatterns",
    result[0]!.relatedPatterns.length === 1,
    JSON.stringify(result[0]?.relatedPatterns),
  );
}

console.log("10. unrelated mechanisms do not over-fold at low entry overlap");
{
  const a = mockSurfaced(
    "avoidance",
    [...ids("unrel-shared", 1), ...ids("unrel-a", 3)],
    0.8,
    "watched three videos instead of opening the document that mattered",
  );
  const b = mockSurfaced(
    "comparison",
    [...ids("unrel-shared", 1), ...ids("unrel-b", 3)],
    0.8,
    "checked their promotion post and felt behind before starting my own work",
  );
  assert(
    "entry overlap is 0.25",
    Math.abs(entryOverlapRatio(a, b) - 0.25) < 0.001,
    `${entryOverlapRatio(a, b)}`,
  );
  assert(
    "shouldFoldPair is false",
    shouldFoldPair(a, b) === false,
  );
  const result = applyOverlapSuppression([a, b]);
  assert("both cards remain", result.length === 2, `${result.length}`);
}

console.log("11. fixture — self_doubt vs self_criticism (entries 2+3)");
{
  const fixture = buildSelfDoubtCriticismFixture();
  const before = aggregateFromInputs(fixture.analyses, fixture.entries, {
    applyOverlapSuppression: false,
  });
  const doubt = before.surfaced.find((p) => p.name === "self_doubt");
  const criticism = before.surfaced.find((p) => p.name === "self_criticism");
  assert("both patterns surface before fold", Boolean(doubt && criticism));
  const overlap = entryOverlapRatio(doubt!, criticism!);
  assert(
    "entry overlap is 0.5",
    Math.abs(overlap - fixture.expectedOverlap) < 0.001,
    `${overlap}`,
  );

  const after = aggregateFromInputs(fixture.analyses, fixture.entries, {
    applyOverlapSuppression: true,
  });
  assert("fold collapses to one card", after.surfaced.length === 1, `${after.surfaced.length}`);
  const survivor = after.surfaced[0]!;
  assert(
    "survivor is self_doubt",
    survivor.name === fixture.expectedSurvivor,
    survivor.name,
  );
  assert(
    "self_criticism suppressed but not deleted",
    survivor.suppressedPatterns.includes(fixture.expectedRelated),
    JSON.stringify(survivor.suppressedPatterns),
  );
  assert(
    "relatedPatterns keeps Self-criticism ref",
    survivor.relatedPatterns.some(
      (r) =>
        r.name === fixture.expectedRelated && r.label === "Self-criticism",
    ),
    JSON.stringify(survivor.relatedPatterns),
  );
  assert(
    "UI line uses also shows up in",
    formatRelatedPatternsLine(survivor.relatedPatterns) ===
      "also shows up in: Self-criticism",
  );
}

console.log("");
if (failed === 0) {
  console.log(`All ${passed} overlap-policy checks passed.`);
} else {
  console.error(`${failed} failed, ${passed} passed.`);
  process.exit(1);
}
