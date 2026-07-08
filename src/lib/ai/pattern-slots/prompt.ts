import type { SlotGenerationInput } from "@/lib/ai/pattern-slots/input";
import {
  SLOT_MAX_LINE_CHARS,
  SLOT_MAX_LINE_WORDS,
  SLOT_MAX_QUESTION_CHARS,
} from "@/lib/ai/pattern-slots/constants";

const describeSlot = (
  slot: SlotGenerationInput["voiceSlots"][number],
  input: SlotGenerationInput,
): string => {
  const priorConnection = input.priorVoice.find((p) => p.role === "connection");

  if (slot.role === "ending" && slot.endingKind === "question") {
    return `Slot ${slot.index} (quiet ending): ONE short wondering question (≤${SLOT_MAX_QUESTION_CHARS} chars), must end with "?". Leave something open — do not explain or summarize.`;
  }
  if (slot.role === "ending") {
    return `Slot ${slot.index} (quiet ending): ONE soft closing line (≤${SLOT_MAX_LINE_WORDS} words). A whisper, not a conclusion. Must NOT repeat the connection or realization.`;
  }
  if (slot.role === "connection") {
    return `Slot ${slot.index} (connection): ONE line (≤${SLOT_MAX_LINE_WORDS} words) naming what links ALL the moments above — a thread the user hasn't named yet. Do NOT repeat, quote, or paraphrase their words. Do NOT summarize every quote.`;
  }
  if (slot.role === "realization") {
    const avoid = priorConnection
      ? ` The connection already said: "${priorConnection.text}" — go ONE step deeper; do NOT rephrase it.`
      : "";
    return `Slot ${slot.index} (realization): ONE line (≤${SLOT_MAX_LINE_WORDS} words) — the quiet insight these moments have earned, drawn from the WHOLE evidence set, not just the opening quote. New words, not theirs.${avoid}`;
  }
  return `Slot ${slot.index}: ONE terse observation (≤${SLOT_MAX_LINE_WORDS} words, ≤${SLOT_MAX_LINE_CHARS} chars). Name one concrete thing from the quotes — not a lesson, not a pattern label.`;
};

const priorVoiceBlock = (input: SlotGenerationInput): string => {
  if (input.priorVoice.length === 0) return "";
  return `\nAlready written (do NOT repeat or paraphrase):\n${input.priorVoice
    .map((p) => `- ${p.role}: "${p.text}"`)
    .join("\n")}\n`;
};

export function buildSlotPrompt(input: SlotGenerationInput): string {
  const { label, definition, quotes, voiceSlots } = input;

  const arcNote = input.shapeId.startsWith("recognition")
    ? "\nArc: the user's own quotes carry the reflection across several cards; you add at most a line or two. Base every line on the FULL set of quotes below, not just the first. Each line must reveal something genuinely new — never restate a previous line or the user's words.\n"
    : "";

  return `You write very small pieces of text for a private journal reflection. The application already placed the user's quotes across multiple cards — the journal is the primary voice, you are a quiet guide. You ONLY fill the numbered slots below.
${arcNote}
Pattern label (never use in your text): ${label}
Definition (never repeat or paraphrase): ${definition}
${priorVoiceBlock(input)}
Evidence quotes (for grounding only — do NOT repeat these words back):
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Slots to fill:
${voiceSlots.map((s) => describeSlot(s, input)).join("\n")}

Rules:
- Use as few words as possible — shorter is always better
- NEVER paraphrase or echo the user's quote text
- No advice, no therapy voice, no pattern names, no labels
- No summarizing all the evidence in one line
- No template bridges ("this shows that you", "this suggests that you")
- One realization per line — no "and", no semicolons, no second sentence
- Prefer plain observation over "You…" openings
- Questions must wonder about one detail, not explain

Return ONLY valid JSON:
[{"index":<slot index>,"text":"<your line>"}]`;
}

export function buildSlotRetryPrompt(
  input: SlotGenerationInput,
  rejection: string,
): string {
  return `${buildSlotPrompt(input)}

Your previous response was rejected: ${rejection}

Return a corrected JSON array only. Shorter. More concrete. Do not repeat the user's words.`;
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
  paraphrase: "A line repeated or paraphrased the user's quote text.",
  slot_echo: "A line repeated or paraphrased another voice slot — each card must say something new.",
  not_question: "A question slot did not end with '?'.",
  multiple_sentences: "A line contained more than one sentence.",
  clause_join: "A line joined multiple realizations with 'and' or 'but'.",
  you_opener: "A line opened with 'You' — prefer plain observation.",
};
