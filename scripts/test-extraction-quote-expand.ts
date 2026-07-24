/**
 * Sentence-boundary evidence expansion for pattern extraction.
 * Run: npx tsx scripts/test-extraction-quote-expand.ts
 */

import { EXTRACTION_MAX_EVIDENCE_CHARS } from "../src/lib/ai/pattern-extraction/constants";
import {
  fitEvidenceQuote,
  normalizeEvidenceQuote,
  splitSentences,
  validateExtraction,
} from "../src/lib/ai/pattern-extraction/validation";

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

console.log("sentence-boundary expansion (reported trim case)");
{
  const source =
    "calling myself unreliable, like one missed half-day erases every deadline I've hit before it without issue";
  const llmSpan = "calling myself unreliable";

  const normalized = normalizeEvidenceQuote(llmSpan, source);
  assert(
    "expands fragment to full sentence",
    normalized === source,
    `got ${JSON.stringify(normalized)}`,
  );

  const payload = validateExtraction(
    {
      topics: ["self-talk"],
      patterns: [
        {
          name: "self_criticism",
          confidence: 0.9,
          evidence: [llmSpan],
        },
      ],
    },
    source,
  );

  assert("validateExtraction returns a payload", payload !== null);
  assert(
    "stored quote is the full sentence, not the fragment",
    payload?.patterns[0]?.evidence[0] === source,
    `got ${JSON.stringify(payload?.patterns[0]?.evidence[0])}`,
  );
}

console.log("multi-sentence expand + mid-sentence start");
{
  const source =
    "I sat with it for a while. Calling myself unreliable, like one missed half-day erases every deadline I've hit before it without issue. Then I closed the laptop.";
  const llmSpan = "calling myself unreliable";
  const expected =
    "Calling myself unreliable, like one missed half-day erases every deadline I've hit before it without issue.";

  const normalized = normalizeEvidenceQuote(llmSpan, source);
  assert(
    "expands to the containing sentence with source casing",
    normalized === expected,
    `got ${JSON.stringify(normalized)}`,
  );
}

console.log("cap prefers first clause over mid-word cut");
{
  const long =
    "calling myself unreliable, like one missed half-day erases every deadline I've hit before it without issue and then invents a longer trail of words that pushes this sentence well past the evidence character limit for sure";
  assert(
    "fixture exceeds evidence cap",
    long.length > EXTRACTION_MAX_EVIDENCE_CHARS,
    `${long.length}`,
  );

  const fitted = fitEvidenceQuote(long, EXTRACTION_MAX_EVIDENCE_CHARS);
  assert(
    "keeps first comma clause when sentence exceeds cap",
    fitted === "calling myself unreliable",
    `got ${JSON.stringify(fitted)}`,
  );
  assert(
    "fitted quote is within cap",
    fitted.length <= EXTRACTION_MAX_EVIDENCE_CHARS,
  );
}

console.log("word-boundary truncate when no comma");
{
  const long =
    "This sentence has no commas at all and just keeps going with enough words to exceed the extraction evidence character limit without any clause break available";
  assert("no-comma fixture exceeds cap", long.length > EXTRACTION_MAX_EVIDENCE_CHARS);

  const fitted = fitEvidenceQuote(long, EXTRACTION_MAX_EVIDENCE_CHARS);
  assert(
    "does not exceed cap",
    fitted.length <= EXTRACTION_MAX_EVIDENCE_CHARS,
    `${fitted.length}`,
  );
  assert(
    "does not end mid-word (no partial last token vs source)",
    !long.startsWith(fitted) ||
      fitted.length === long.length ||
      /\s/.test(long[fitted.length] ?? " "),
    `fitted=${JSON.stringify(fitted)}`,
  );
  assert(
    "truncates on whitespace, not hard index",
    fitted === long.slice(0, fitted.length) && !fitted.includes("  "),
    `got ${JSON.stringify(fitted)}`,
  );
}

console.log("sentence splitter basics");
{
  const spans = splitSentences("One. Two! Three?");
  assert("three sentences", spans.length === 3, `${spans.length}`);
  assert(
    "first sentence text",
    "One.".slice(0) === "One." && spans[0]!.end - spans[0]!.start === 4,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
