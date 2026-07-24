import { renderArbitrationPromptBlock } from "@/lib/patterns/arbitration";
import {
  EXTRACTION_SHARED_EXAMPLES,
  EXTRACTION_SOLO_EXAMPLE_ORDER,
  MAX_EVIDENCE_PER_PATTERN,
  MAX_PATTERNS_PER_ENTRY,
  MAX_TOPICS_PER_ENTRY,
  PATTERN_CATALOG,
  PATTERN_CONFIDENCE_FLOOR,
  PATTERN_NAMES,
  type PatternExample,
  type PatternName,
  type SharedExtractionExample,
} from "@/lib/patterns/vocabulary";

/**
 * BEHAVIORAL CONSTRAINTS (pattern extraction):
 * - Closed vocabulary only — names from PATTERN_CATALOG / PATTERN_NAMES.
 * - Confidence floor, max patterns/topics/evidence — see vocabulary constants.
 * - Pattern behavioral tests live in PATTERN_CATALOG (definition + disambiguation
 *   + examples). Do NOT hardcode per-pattern meaning here; edit the catalog.
 * - Pairwise TIE-BREAKERS are rendered from arbitration.ts (ARBITRATION_RULES) —
 *   the SAME table enforced post-hoc in validation.ts (reconcilePatterns). Edit
 *   the rule there, never re-word tie-breakers only in this prompt.
 * - Run `npm run check:pattern-vocab` after catalog or this-file changes.
 */

const patternListForPrompt = PATTERN_NAMES.map((name) => {
  const spec = PATTERN_CATALOG[name];
  return `- ${name}: ${spec.definition}`;
}).join("\n");

const disambiguationBlock = PATTERN_NAMES.map((name) => {
  const spec = PATTERN_CATALOG[name];
  return `- ${spec.disambiguation}`;
}).join("\n");

function formatJsonRight(payload: unknown): string {
  return JSON.stringify(payload);
}

function renderSharedExample(
  example: SharedExtractionExample,
): string {
  if (example.kind === "none") {
    return `${example.heading}
Entry:
"""
${example.entry}
"""
Output:
${formatJsonRight({ topics: example.topics, patterns: [] })}`;
  }

  return `${example.heading}
Entry:
"""
${example.entry}
"""
Output:
${formatJsonRight({
  topics: example.topics,
  patterns: example.patterns.map((p) => ({
    name: p.name,
    confidence: p.confidence,
    evidence: p.evidence,
  })),
})}`;
}

function renderSoloExample(
  name: PatternName,
  example: PatternExample,
  index: number,
): string {
  const heading = `EXAMPLE ${index} (${name} — NOT overthinking)`;
  const wrongLine = example.wrong ? `Wrong: ${example.wrong}\nRight:\n` : "";
  const right = formatJsonRight({
    topics: example.topics,
    patterns: [
      {
        name,
        confidence: example.confidence,
        evidence: example.evidence,
      },
    ],
  });

  return `${heading}
Entry:
"""
${example.entry}
"""
${wrongLine}${right}`;
}

function buildExamplesBlock(): string {
  const parts: string[] = [];

  for (const shared of EXTRACTION_SHARED_EXAMPLES) {
    parts.push(renderSharedExample(shared));
  }

  let n = EXTRACTION_SHARED_EXAMPLES.length + 1;
  for (const name of EXTRACTION_SOLO_EXAMPLE_ORDER) {
    const example = PATTERN_CATALOG[name].examples[0];
    if (!example) continue;
    // Skip residual/empty overthinking-style placeholders.
    if (example.confidence <= 0 || example.evidence.length === 0) continue;
    parts.push(renderSoloExample(name, example, n));
    n += 1;
  }

  return parts.join("\n\n");
}

/** Pattern extraction prompt — structured JSON only, no creative writing. */
export function buildExtractionPrompt(text: string): string {
  return `You are Unfold's entry analyst. You read ONE private journal entry and identify the recurring MENTAL PATTERNS in how the person is thinking — not the topics, not the events.

Return:
- topics: 1–2 short things the entry is about.
- patterns: 0–3 mental patterns from the FIXED list below.

You are observing, not advising. Never give advice, reassurance, diagnosis, or therapy. Never infer beyond what the text supports. Do not write reflections or summaries.

MENTAL PATTERNS (use these names EXACTLY; never invent others):
${patternListForPrompt}

DISAMBIGUATION (pick the MOST SPECIFIC fit; do not use overthinking as a catch-all):
${disambiguationBlock}

TIE-BREAKERS (when two patterns both seem to fit, apply these before choosing):
${renderArbitrationPromptBlock()}

RULES:
- If no pattern is clearly present, return an empty "patterns" array. Do NOT force a match.
- Only include a pattern if your confidence is ${PATTERN_CONFIDENCE_FLOOR} or higher.
- At most ${MAX_PATTERNS_PER_ENTRY} patterns, highest confidence first.
- Prefer the specific pattern over overthinking when both could apply. Do not add overthinking alongside a specific pattern unless there is a SEPARATE loop that does not fit the specific one.
- evidence: 1–${MAX_EVIDENCE_PER_PATTERN} quotes copied VERBATIM from the entry (a phrase or sentence), for each pattern.
- topics: 1–${MAX_TOPICS_PER_ENTRY} short lowercase noun phrases (e.g. "career", "a friendship", "money").
- Output ONLY valid JSON in the exact schema below. No prose, no markdown, no code fences.

SCHEMA:
{
  "topics": ["<topic>"],
  "patterns": [
    { "name": "<pattern_name>", "confidence": 0.0, "evidence": ["<verbatim quote>"] }
  ]
}

${buildExamplesBlock()}

Now analyze this entry and respond with JSON only:
"""
${text}
"""`;
}
