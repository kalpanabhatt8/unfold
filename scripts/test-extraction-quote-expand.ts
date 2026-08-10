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
    console.error(`  ✗ ${label}${detail ? ` - ${detail}` : ""}`);
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

console.log("Entry 5 regression: merged non-contiguous evidence must not drop pattern");
{
  // Exact Entry 5 body (newline-separated sentences) + exact raw LLM evidence
  // that previously failed with no_verbatim_evidence.
  const source = [
    "The recruiter hasn't replied to my email yet.",
    "It's only been one day, but my brain has already decided something went wrong.",
    "Maybe they hated the portfolio.",
    "Maybe they found someone better.",
    "Maybe I completely misunderstood the interview.",
    "If this opportunity disappears, I'll probably be stuck doing work I don't like for another year.",
    "Then I'll fall behind everyone else and won't be able to get the kind of job I actually want.",
    "I know this is an enormous chain of assumptions from one unanswered email.",
    "Still, once I start imagining how badly it could go, it's difficult to stop.",
  ].join("\n");

  const raw = {
    topics: ["job opportunity", "recruiter response"],
    patterns: [
      {
        name: "catastrophizing",
        confidence: 0.95,
        evidence: [
          "Maybe they hated the portfolio. Maybe they found someone better.",
          "If this opportunity disappears, I'll probably be stuck doing work I don't like for another year. Then I'll fall behind everyone else",
        ],
      },
      {
        name: "comparison",
        confidence: 0.78,
        evidence: [
          "Then I'll fall behind everyone else and won't be able to get the kind of job I actually want",
        ],
      },
    ],
  };

  const payload = validateExtraction(raw, source);
  const names = payload?.patterns.map((p) => p.name) ?? [];

  assert("validateExtraction returns a payload", payload !== null);
  assert(
    "catastrophizing is NOT discarded",
    names.includes("catastrophizing"),
    `patterns=${JSON.stringify(names)}`,
  );
  assert(
    "comparison still accepted",
    names.includes("comparison"),
    `patterns=${JSON.stringify(names)}`,
  );

  const cat = payload?.patterns.find((p) => p.name === "catastrophizing");
  assert(
    "catastrophizing keeps confidence 0.95",
    cat?.confidence === 0.95,
    `got ${cat?.confidence}`,
  );
  assert(
    "catastrophizing has grounded evidence",
    (cat?.evidence.length ?? 0) >= 1,
    `evidence=${JSON.stringify(cat?.evidence)}`,
  );
  assert(
    "every catastrophizing quote is a contiguous source substring (case-insensitive)",
    (cat?.evidence ?? []).every((q) =>
      source.toLowerCase().includes(q.toLowerCase()),
    ),
    `evidence=${JSON.stringify(cat?.evidence)}`,
  );
}

console.log("contiguous valid evidence still accepted");
{
  const source =
    "Maybe they hated the portfolio.\nMaybe they found someone better.";
  const payload = validateExtraction(
    {
      topics: [],
      patterns: [
        {
          name: "catastrophizing",
          confidence: 0.9,
          evidence: ["Maybe they hated the portfolio."],
        },
      ],
    },
    source,
  );
  assert(
    "single contiguous sentence accepted",
    payload?.patterns[0]?.name === "catastrophizing" &&
      (payload?.patterns[0]?.evidence.length ?? 0) === 1,
  );
}

console.log("fabricated evidence rejected");
{
  const source =
    "Maybe they hated the portfolio.\nMaybe they found someone better.";
  const payload = validateExtraction(
    {
      topics: [],
      patterns: [
        {
          name: "catastrophizing",
          confidence: 0.95,
          evidence: [
            "The universe will collapse and everyone will know I failed forever.",
          ],
        },
      ],
    },
    source,
  );
  assert(
    "fully fabricated evidence drops the pattern",
    (payload?.patterns.length ?? 0) === 0,
    `patterns=${JSON.stringify(payload?.patterns)}`,
  );
}

console.log("paraphrased evidence rejected");
{
  const source =
    "Maybe they hated the portfolio.\nMaybe they found someone better.";
  const payload = validateExtraction(
    {
      topics: [],
      patterns: [
        {
          name: "catastrophizing",
          confidence: 0.95,
          evidence: [
            "Perhaps they disliked my portfolio and chose a stronger candidate.",
          ],
        },
      ],
    },
    source,
  );
  assert(
    "paraphrase (not present verbatim) drops the pattern",
    (payload?.patterns.length ?? 0) === 0,
    `patterns=${JSON.stringify(payload?.patterns)}`,
  );
}

console.log("mixed merged evidence keeps only verbatim pieces");
{
  const source =
    "Maybe they hated the portfolio.\nMaybe they found someone better.";
  const payload = validateExtraction(
    {
      topics: [],
      patterns: [
        {
          name: "catastrophizing",
          confidence: 0.9,
          evidence: [
            "Maybe they hated the portfolio. Aliens will erase my career forever.",
          ],
        },
      ],
    },
    source,
  );
  const evidence = payload?.patterns[0]?.evidence ?? [];
  assert("pattern survives via the real piece", evidence.length >= 1);
  assert(
    "fabricated half is not kept",
    evidence.every((q) => !/aliens/i.test(q)),
    `evidence=${JSON.stringify(evidence)}`,
  );
  assert(
    "kept quote is grounded",
    evidence.every((q) => source.toLowerCase().includes(q.toLowerCase())),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
