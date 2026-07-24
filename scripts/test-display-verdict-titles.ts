/**
 * Anti-verdict display-title validation.
 * Run: npx tsx --tsconfig tsconfig.json scripts/test-display-verdict-titles.ts
 */

import { DISPLAY_REJECTION_MESSAGES } from "../src/lib/ai/pattern-display/prompt";
import {
  isVerdictTitle,
  validateDisplay,
} from "../src/lib/ai/pattern-display/validation";

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

const KNOWN_BAD = [
  "Can't Just Say Thank You",
  "They Chose Wrong",
  "I'm Not Good At This",
] as const;

const KNOWN_GOOD = [
  "The Correction That Wouldn't Stop",
  "The Verdict Before the Facts",
] as const;

/** Quotes that ground known-good titles without tripping quote_copy overlap. */
const GROUNDING_QUOTES = [
  "kept looping the same correction overnight",
  "facts were still missing when the call came",
];

console.log("known-bad titles must fail validation");
{
  for (const title of KNOWN_BAD) {
    assert(`isVerdictTitle: ${title}`, isVerdictTitle(title));
    const result = validateDisplay(
      { displayTitle: title, summary: null },
      GROUNDING_QUOTES,
      "Self-criticism",
      "harsh self-talk or blaming themselves.",
    );
    assert(
      `validateDisplay rejects: ${title}`,
      result.ok === false && result.reason === "verdict_voice",
      result.ok ? "ok=true" : `reason=${result.reason}`,
    );
  }
}

console.log("known-good titles must pass validation");
{
  for (const title of KNOWN_GOOD) {
    assert(`not isVerdictTitle: ${title}`, !isVerdictTitle(title));
    const result = validateDisplay(
      { displayTitle: title, summary: null },
      GROUNDING_QUOTES,
      "Self-criticism",
      "harsh self-talk or blaming themselves.",
    );
    assert(
      `validateDisplay accepts: ${title}`,
      result.ok === true,
      result.ok ? undefined : `reason=${result.reason}`,
    );
  }
}

console.log("retry message wiring");
{
  assert(
    "verdict_voice has a rejection message for retry prompts",
    typeof DISPLAY_REJECTION_MESSAGES.verdict_voice === "string" &&
      DISPLAY_REJECTION_MESSAGES.verdict_voice.includes("settled trait"),
  );
}

console.log("process framing exempts absolute language");
{
  assert(
    "Can't stop before it starts — process exempt",
    !isVerdictTitle("Can't Stop Before It Starts"),
  );
  assert(
    "Never settles after praise — process exempt",
    !isVerdictTitle("Never Settles After Praise"),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
