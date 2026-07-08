import type { SlotGenerationInput } from "@/lib/ai/pattern-slots/input";
import {
  SLOT_MAX_LINE_CHARS,
  SLOT_MAX_LINE_WORDS,
  SLOT_MAX_QUESTION_CHARS,
} from "@/lib/ai/pattern-slots/constants";

const describeSlot = (
  slot: SlotGenerationInput["voiceSlots"][number],
): string => {
  if (slot.role === "reflection") {
    return `Slot ${slot.index} (reflection): ONE forward-looking wondering question (≤${SLOT_MAX_QUESTION_CHARS} chars), must end with "?". Curiosity only — no advice, no conclusions, no therapy.`;
  }
  if (slot.role === "recognition") {
    return `Slot ${slot.index} (recognition): ONE open question (≤${SLOT_MAX_QUESTION_CHARS} chars), must end with "?". Invite the user to notice what connects the moments — do NOT answer, interpret, or explain.`;
  }
  if (slot.role === "observation") {
    return `Slot ${slot.index} (observation): ONE short line (≤${SLOT_MAX_LINE_WORDS} words) describing what happened across the evidence — structural, behavioral, concrete. Describe the entries, not the person. No "You…", no psychology, no why.`;
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

  const arcNote = input.shapeId === "discovery"
    ? "\nArc: guided discovery. The user's quotes are the primary voice. You ask questions and optionally describe what the evidence shows — never interpret psychology or explain the user to themselves.\n"
    : "";

  return `You write very small pieces of text for a private journal reflection. The application already placed the user's quotes — you add questions and at most one evidence-grounded observation.
${arcNote}
Pattern label (never use in your text): ${label}
Definition (never repeat or paraphrase): ${definition}
${priorVoiceBlock(input)}
Evidence quotes (for grounding only — do NOT repeat these words back):
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Slots to fill:
${voiceSlots.map((s) => describeSlot(s)).join("\n")}

Rules:
- Use as few words as possible
- NEVER paraphrase or echo the user's quote text
- No advice, no therapy voice, no pattern names, no diagnoses
- No motive-based phrasing ("because you", "trying to", "permission to")
- Recognition and reflection slots MUST end with "?"
- Observation slots must NOT end with "?" and must NOT start with "You"
- Prefer behavioral descriptions over inner-state claims

Return ONLY valid JSON:
[{"index":<slot index>,"text":"<your line>"}]`;
}

export function buildSlotRetryPrompt(
  input: SlotGenerationInput,
  rejection: string,
): string {
  return `${buildSlotPrompt(input)}

Your previous response was rejected: ${rejection}

Return a corrected JSON array only. Shorter. More concrete.`;
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
  paraphrase: "A line repeated or paraphrased the user's quote text.",
  slot_echo: "A line repeated or paraphrased another voice slot.",
  not_question: "A question slot did not end with '?'.",
  not_statement: "An observation slot ended with '?' or started with 'You'.",
  multiple_sentences: "A line contained more than one sentence.",
  clause_join: "A line joined multiple realizations with 'and' or 'but'.",
  you_opener: "A line opened with 'You'.",
};
