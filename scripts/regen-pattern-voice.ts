/**
 * Fresh voice generation for the two patterns currently showing reject-example
 * reflection questions. Uses grounded quote fixtures when DB/localStorage is
 * unavailable from this script.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/regen-pattern-voice.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { generateSlotFills } from "../src/lib/ai/pattern-slots/generate";
import { buildSlotPrompt } from "../src/lib/ai/pattern-slots/prompt";
import type { SlotGenerationInput } from "../src/lib/ai/pattern-slots/input";
import {
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
  type PatternName,
} from "../src/lib/patterns/vocabulary";
import { PASSAGE_CACHE_VERSION } from "../src/lib/patterns/passage-types";

type Fixture = {
  title: string;
  patternName: PatternName;
  oldReflectionShowing: string;
  quotes: string[];
};

const FIXTURES: Fixture[] = [
  {
    title: "Same morning four loops",
    patternName: "avoidance",
    oldReflectionShowing:
      "What would it feel like to leave it unopened for an hour?",
    quotes: [
      "I opened Slack before I even sat down.",
      "Closed the draft again. Opened email instead.",
      "Same tab cycle — portfolio, then tutorials, then Slack.",
      "Still hadn't touched the thing I said I'd start this morning.",
    ],
  },
  {
    title: "Three mornings same harsh verdict",
    patternName: "self_criticism",
    oldReflectionShowing:
      "How quickly does the worst version arrive once the first doubt appears?",
    quotes: [
      "Woke up and the first thought was that I'm behind again.",
      "Three bugs fixed and I still called myself stupid out loud.",
      "Same verdict before coffee — nothing I do is enough.",
    ],
  },
];

async function regenOne(fixture: Fixture, apiKey: string, showPrompt: boolean) {
  const input: SlotGenerationInput = {
    patternName: fixture.patternName,
    label: PATTERN_LABELS[fixture.patternName],
    definition: PATTERN_DEFINITIONS[fixture.patternName],
    quotes: fixture.quotes,
    shapeId: "discovery",
    priorVoice: [],
    voiceSlots: [
      {
        index: 1,
        kind: "line",
        endingKind: "line",
        role: "mechanism",
        precedingQuotes: fixture.quotes,
      },
      {
        index: 2,
        kind: "close",
        endingKind: "question",
        role: "reflection",
        precedingQuotes: fixture.quotes,
      },
    ],
  };

  if (showPrompt) {
    const prompt = buildSlotPrompt(input);
    const start = prompt.indexOf("Slot 2 (reflection)");
    const end = prompt.indexOf("\n\nRules:");
    console.log("\n======== CURRENT REFLECTION PROMPT (live) ========\n");
    console.log(prompt.slice(start >= 0 ? start : 0, end >= 0 ? end : undefined));
    console.log("\n======== END REFLECTION PROMPT ========\n");
  }

  const result = await generateSlotFills(apiKey, input);
  const mechanism = result.fills.find((f) => f.index === 1)?.text ?? null;
  const reflection = result.fills.find((f) => f.index === 2)?.text ?? null;

  console.log(`\n========== ${fixture.title} (${fixture.patternName}) ==========`);
  console.log("WAS showing:", fixture.oldReflectionShowing);
  console.log("NEW mechanism:", mechanism ?? "(none)");
  console.log("NEW reflection:", reflection ?? "(none)");
  if (result.rejected.length) {
    console.log(
      "rejected samples:",
      result.rejected.map((r) => `${r.reason}: ${r.text}`),
    );
  }

  const banned = [
    "leave it unopened",
    "notice the shift",
    "before dismissing",
    "worst version",
    "what would it feel like",
    "what would it look like",
  ];
  const hit = banned.filter((b) =>
    (reflection ?? "").toLowerCase().includes(b),
  );
  if (hit.length) {
    console.log("⚠ still contains banned phrasing:", hit);
  } else if (reflection) {
    console.log("✓ reflection clears banned phrasing checks");
  }
}

async function main() {
  console.log("PASSAGE_CACHE_VERSION =", PASSAGE_CACHE_VERSION);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY in .env.local");
    process.exit(1);
  }

  for (let i = 0; i < FIXTURES.length; i++) {
    await regenOne(FIXTURES[i], apiKey, i === 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
