/**
 * Live Loop generation test — comparison pattern (incident-stitch regression).
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/test-loop-stitch-fix.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { generateSlotFills } from "../src/lib/ai/pattern-slots/generate";
import { stitchesIncidents } from "../src/lib/ai/pattern-slots/incident-stitch";
import type { SlotGenerationInput } from "../src/lib/ai/pattern-slots/input";
import {
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
} from "../src/lib/patterns/vocabulary";

/** Quotes from the comparison-pattern card that produced the bad montage Loop. */
const COMPARISON_QUOTES = [
  "Someone posted their salary on LinkedIn and I did the math on years of experience.",
  "A feature I'd been sketching shipped on Product Hunt before I started.",
  "A week away from my goal somehow became a year's measure of being behind.",
];

const BAD_MONTAGE =
  "Saw someone's number posted. Saw a feature shipped. Saw a week away become a year's measure.";

function buildInput(): SlotGenerationInput {
  return {
    patternName: "comparison",
    label: PATTERN_LABELS.comparison,
    definition: PATTERN_DEFINITIONS.comparison,
    quotes: COMPARISON_QUOTES,
    shapeId: "discovery",
    priorVoice: [],
    voiceSlots: [
      {
        index: 1,
        kind: "line",
        endingKind: "line",
        role: "mechanism",
        precedingQuotes: COMPARISON_QUOTES,
      },
    ],
  };
}

async function main() {
  console.log("=== Unit check: bad montage flagged ===");
  console.log(
    "stitchesIncidents(bad):",
    stitchesIncidents(BAD_MONTAGE, COMPARISON_QUOTES),
  );

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("\nMissing ANTHROPIC_API_KEY — skipping live generation.");
    process.exit(1);
  }

  console.log("\n=== Live Loop generation (comparison) ===");
  console.log("Evidence quotes:");
  COMPARISON_QUOTES.forEach((q, i) => console.log(`  ${i + 1}. "${q}"`));

  const result = await generateSlotFills(apiKey, buildInput());
  const mechanism = result.fills.find((f) => f.index === 1)?.text ?? null;

  console.log("\nGenerated Loop:");
  console.log(mechanism ?? "(none — generation failed)");

  if (result.rejected.length) {
    console.log("\nRejected during generation:");
    for (const r of result.rejected) {
      console.log(`  [${r.reason}] ${r.text}`);
    }
  }

  if (!mechanism) {
    console.error("\n✗ No mechanism generated");
    process.exit(1);
  }

  const isMontage = stitchesIncidents(mechanism, COMPARISON_QUOTES);
  const sawOpenerCount = mechanism
    .split(/(?<=[.!?])\s+/)
    .filter((s) => /^Saw\b/i.test(s.trim())).length;

  console.log("\n=== Assessment ===");
  console.log(`Montage detector: ${isMontage ? "FAIL (still stitches)" : "PASS (generic shape)"}`);
  console.log(`'Saw …' opener sentences: ${sawOpenerCount}`);

  if (isMontage) {
    console.error("\n✗ Loop still looks like incident stitching");
    process.exit(1);
  }

  console.log("\n✓ Loop passes montage checks");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
