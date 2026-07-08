/**
 * Review planner shape selection across synthetic fixtures.
 * Run: npx tsx scripts/review-pattern-shapes.ts
 */
import { reviewAllFixtures, reviewFixture, SHAPE_FIXTURES } from "../src/lib/patterns/shape-review";

const results = reviewAllFixtures();

console.log("\nPattern shape review\n" + "─".repeat(60));

for (const r of results) {
  const isolated = reviewFixture(
    SHAPE_FIXTURES.find((f) => f.id === r.fixtureId)!,
  );
  // "recognition" asserts the recognition *family* (line / question / deep),
  // not a specific ending — the planner picks the ending by seed + diversity.
  const familyMatch =
    r.expectShape === "recognition" &&
    isolated.shapeId.startsWith("recognition");
  const match = r.expectShape
    ? isolated.shapeId === r.expectShape || familyMatch
      ? "✓"
      : `≈ sequential:${r.shapeId} isolated:${isolated.shapeId} (expected ${r.expectShape})`
    : "·";
  console.log(
    `\n${r.fixtureId} ${match}\n  lifecycle: ${r.lifecycle}\n  shape: ${r.shapeId} (${r.depthTier}, end:${r.endingKind})\n  slots: ${r.slotKinds.join(" → ")}\n  quotes: ${r.quoteCount}, voice: ${r.voiceSlots}${r.notes ? `\n  note: ${r.notes}` : ""}`,
  );
}

console.log("\n" + "─".repeat(60));
