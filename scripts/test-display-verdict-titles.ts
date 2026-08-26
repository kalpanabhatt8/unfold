/**
 * Anti-verdict display-title validation.
 * Run: npx tsx --tsconfig tsconfig.json scripts/test-display-verdict-titles.ts
 */

import { DISPLAY_REJECTION_MESSAGES } from "../src/lib/ai/pattern-display/constants";
import {
  isPoeticMetaphorTitle,
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
    console.error(`  ✗ ${label}${detail ? ` - ${detail}` : ""}`);
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
  assert(
    "poetic_voice has a rejection message for retry prompts",
    typeof DISPLAY_REJECTION_MESSAGES.poetic_voice === "string" &&
      DISPLAY_REJECTION_MESSAGES.poetic_voice.includes("poetic"),
  );
}

console.log("process framing exempts absolute language");
{
  assert(
    "Can't stop before it starts - process exempt",
    !isVerdictTitle("Can't Stop Before It Starts"),
  );
  assert(
    "Never settles after praise - process exempt",
    !isVerdictTitle("Never Settles After Praise"),
  );
}

console.log("overly poetic metaphors must fail");
{
  const poetic = [
    "The Garden That Wouldn't Bloom",
    "Echoes in the Fog",
    "A Tide of Unspoken Light",
  ] as const;
  for (const title of poetic) {
    assert(`isPoeticMetaphorTitle: ${title}`, isPoeticMetaphorTitle(title, GROUNDING_QUOTES));
    const result = validateDisplay(
      { displayTitle: title, summary: null },
      GROUNDING_QUOTES,
      "Self-criticism",
      "harsh self-talk or blaming themselves.",
    );
    assert(
      `validateDisplay rejects poetic: ${title}`,
      result.ok === false && result.reason === "poetic_voice",
      result.ok ? "ok=true" : `reason=${result.reason}`,
    );
  }
}

console.log("scene detail from the quotes is not treated as metaphor");
{
  const quotes = ["I sat in the fog outside the office and still hadn't sent it"];
  assert(
    "fog from quotes is allowed",
    !isPoeticMetaphorTitle("The Fog Didn't Lift", quotes),
  );
  const result = validateDisplay(
    { displayTitle: "The Fog Didn't Lift", summary: null },
    quotes,
    "Avoidance",
    "putting off a feared action by doing something easier nearby.",
  );
  assert(
    "validateDisplay accepts grounded fog title",
    result.ok === true,
    result.ok ? undefined : `reason=${result.reason}`,
  );
}

console.log("clinical labels and generic self-help must fail");
{
  const clinical = validateDisplay(
    { displayTitle: "Anxiety Before Sending", summary: null },
    GROUNDING_QUOTES,
    "Fear of judgment",
    "watching imagined reactions before speaking or sending.",
  );
  assert(
    "clinical label rejected",
    clinical.ok === false && clinical.reason === "label_voice",
    clinical.ok ? "ok=true" : `reason=${clinical.reason}`,
  );
  const selfHelp = validateDisplay(
    { displayTitle: "Learning to Let Go", summary: null },
    GROUNDING_QUOTES,
    "Avoidance",
    "putting off a feared action by doing something easier nearby.",
  );
  assert(
    "self-help rejected",
    selfHelp.ok === false && selfHelp.reason === "banned_voice",
    selfHelp.ok ? "ok=true" : `reason=${selfHelp.reason}`,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
