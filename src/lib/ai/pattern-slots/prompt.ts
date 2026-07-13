/**
 * Loop (mechanism) generation prompt.
 *
 * Evidence moments are islands. The Loop builds the bridges between them —
 * each line names what carried the user from one moment into the next,
 * never a shorter rewrite of either quote.
 */

import type { SlotGenerationInput } from "@/lib/ai/pattern-slots/input";
import {
  SLOT_MAX_LINE_WORDS,
  SLOT_MAX_MECHANISM_CHARS,
  SLOT_MAX_MECHANISM_SENTENCES,
  SLOT_MAX_QUESTION_CHARS,
  SLOT_MIN_MECHANISM_SENTENCES,
} from "@/lib/ai/pattern-slots/constants";

const describeSlot = (
  slot: SlotGenerationInput["voiceSlots"][number],
  quoteCount: number,
): string => {
  if (slot.role === "reflection") {
    return `Slot ${slot.index} (reflection): ONE forward-looking wondering question (≤${SLOT_MAX_QUESTION_CHARS} chars), must end with "?". Curiosity only — no advice, no conclusions, no therapy.`;
  }
  if (slot.role === "mechanism") {
    return `Slot ${slot.index} (Loop / mechanism): Build BRIDGES between evidence islands.

The numbered evidence quotes are already shown to the user as Moments. Your job is NOT to rewrite those quotes in shorter words. Your job is to describe what carried the user FROM one moment INTO the next.

Think: Evidence = islands. Loop = bridges between adjacent islands.

Write ${SLOT_MIN_MECHANISM_SENTENCES}–${SLOT_MAX_MECHANISM_SENTENCES} short sentences (≤${SLOT_MAX_MECHANISM_CHARS} chars total). Each sentence is one bridge between adjacent moments (cite those quote numbers).

BAD (paraphrase / restating islands):
Evidence: "I kept watching tutorials." / "I reorganized my folders."
● Watching tutorials.
● Reorganizing folders.

GOOD (bridge / transition between islands):
● Learning started feeling safer than beginning.

Rules for each sentence:
- Describe the TRANSITION between two adjacent moments — the shift, pressure, or small move that carried the user from one into the next.
- Do NOT restate, compress, or closely paraphrase either quote.
- Do NOT name the same concrete actions/objects from a quote as the whole sentence (that is paraphrasing).
- Prefer naming the felt shift or carrying force between moments (e.g. avoidance becoming preparation, starting feeling unsafe, tending the edges instead of the center) while staying grounded in what the quotes show.
- Follow chronological order (quote 1 is earliest). Prefer adjacent pairs: [1,2], then [2,3], etc.
- You may continue one small, believable step beyond the final evidence, but never invent events or conclusions the journal does not support.
- FINAL LINE (critical): stay inside the user's ongoing experience — the loop is still unfolding. Do NOT summarize, conclude, narrate the day's close, or assess what happened.
  BAD (verdict / looking back): "Nothing had changed." / "The portfolio never moved." / "By evening…" / "In the end…" / "By the end…" / "Still waiting."
  GOOD (still inside): name the next unfinished reach, hesitation, or continuing pull — present and unfinished, not explained.
- Plain, concrete language. No psychological/therapy vocabulary. No "You…". No second-person meaning-making.

Return this slot as:
{"index":${slot.index},"text":"<all sentences joined>","steps":[{"text":"<bridge 1>","quoteIndexes":[1,2]},{"text":"<bridge 2>","quoteIndexes":[2,3]}]}`;
  }
  return `Slot ${slot.index}: ONE terse line (≤${SLOT_MAX_LINE_WORDS} words).`;
};

const priorVoiceBlock = (input: SlotGenerationInput): string => {
  if (input.priorVoice.length === 0) return "";
  return `\nAlready written (do NOT repeat or paraphrase):\n${input.priorVoice
    .map((p) => `- ${p.role}: "${p.text}"`)
    .join("\n")}\n`;
};

export function buildSlotPrompt(input: SlotGenerationInput): string {
  const { label, definition, quotes, voiceSlots } = input;
  const hasLoop = voiceSlots.some((s) => s.role === "mechanism");

  const arcNote = input.shapeId === "discovery"
    ? "\nArc: guided discovery. Moments (quotes) are islands already on screen. The Loop only builds bridges BETWEEN adjacent islands — never a shorter rewrite of either island.\n"
    : "";

  const evidenceBlock = quotes
    .map((q, i) => `${i + 1}. "${q}"`)
    .join("\n");

  const returnShape = hasLoop
    ? `Return ONLY valid JSON. Reflection slots: {"index":n,"text":"..."}. Loop slots MUST include steps with quoteIndexes (adjacent pairs preferred):
[{"index":<n>,"text":"<joined sentences>","steps":[{"text":"<bridge>","quoteIndexes":[1,2]},...]}]`
    : `Return ONLY valid JSON:
[{"index":<slot index>,"text":"<your line>"}]`;

  return `You write very small pieces of text for a private journal reflection. The application already placed the user's quotes as Moments (islands). You add at most one Loop — the bridges between adjacent moments — and optional questions.
${arcNote}
Pattern label (never use in your text): ${label}
Definition (never repeat or paraphrase): ${definition}
${priorVoiceBlock(input)}
Evidence quotes in chronological order (earliest = 1) — these are islands, not text to compress:
${evidenceBlock}

Slots to fill:
${voiceSlots.map((s) => describeSlot(s, quotes.length)).join("\n")}

Rules:
- Use as few words as possible
- For Loop slots: each line is a BRIDGE between adjacent moments (what carried the user from one into the next). Never rewrite a quote in shorter words. Cite quoteIndexes per step. Final line stays inside the ongoing experience — never a verdict about what happened.
- For recognition/reflection: NEVER paraphrase or echo the user's quote text
- No advice, no therapy voice, no pattern names, no diagnoses
- No invented emotions or psychology; no explaining what the behavior means
- No motive-based phrasing ("because you", "trying to", "permission to")
- Reflection slots MUST end with "?"
- Loop slots must NOT end with "?" and must NOT start with "You"

${returnShape}`;
}

export function buildSlotRetryPrompt(
  input: SlotGenerationInput,
  rejection: string,
): string {
  return `${buildSlotPrompt(input)}

Your previous response was rejected: ${rejection}

Return a corrected JSON array only. For Loop slots: write bridges between adjacent evidence islands — describe the transition that carried the user from one moment into the next. Do not restate or compress any quote. The final line must stay inside the ongoing experience (still unfolding) — never "nothing had changed," "never moved," "by evening," "in the end," or any summary of what happened. Include steps with quoteIndexes.`;
}

export const SLOT_REJECTION_MESSAGES: Record<string, string> = {
  empty: "One or more slots were empty.",
  parsing_error: "The response was not valid JSON.",
  too_long: "One or more lines were too long.",
  too_many_words: "A line slot had too many words.",
  too_many_ai_words: "The passage used too many AI words overall.",
  not_grounded: "A line was not grounded in the provided quotes.",
  definition_echo: "A line repeated the pattern definition.",
  label_echo: "A line used the pattern label.",
  advice_voice: "The text sounded like advice or therapy.",
  template_voice: "The text used a templated insight bridge.",
  insight_voice: "The text over-explained or closed the loop.",
  interpretive_voice: "The text interpreted psychology instead of describing evidence.",
  paraphrase:
    "A Loop line restated a single quote instead of describing the transition between moments.",
  slot_echo: "A line repeated or paraphrased another voice slot.",
  not_question: "A question slot did not end with '?'.",
  not_statement: "A mechanism slot ended with '?' or started with 'You'.",
  multiple_sentences: "A line contained more than one sentence.",
  too_few_sentences: "A mechanism slot needs at least two sentences.",
  too_many_sentences: "A mechanism slot used more than four sentences.",
  summary_voice: "The Loop summarized instead of connecting adjacent moments.",
  verdict_ending:
    "The Loop's final line summarized what happened (verdict) instead of staying inside the ongoing experience. Rewrite the last sentence so the loop still feels unfinished — no 'nothing had changed,' 'never moved,' 'by evening,' or 'in the end.'",
  missing_steps: "A Loop slot must return steps with quoteIndexes for each sentence.",
  order_violation:
    "Loop steps must follow chronological evidence order (quote indexes non-decreasing).",
  clause_join: "A line joined multiple realizations with 'and' or 'but'.",
  you_opener: "A line opened with 'You'.",
};
