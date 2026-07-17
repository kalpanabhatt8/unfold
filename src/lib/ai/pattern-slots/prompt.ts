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
): string => {
  if (slot.role === "reflection") {
    return `Slot ${slot.index} (reflection): ONE observational wondering question about the pattern's shape (≤${SLOT_MAX_QUESTION_CHARS} chars), must end with "?". Pure curiosity about what is already happening — never suggest an action, alternative, or that the user should notice/stop/change anything. No advice, no conclusions, no therapy.

REJECT (corrective / suggests a different behavior, or presumes a negative outcome the journal never stated):
- "What would it feel like to leave it unopened for an hour?"
- "What would it look like to notice the shift before dismissing what comes next?"
- "What if you waited before checking again?"
- "How quickly does the worst version arrive once the first doubt appears?"

ACCEPT (observational / curious about the pattern itself — no change implied, no presumed downside):
- "Where does the pull to check show up most sharply in a day like this?"
- "What part of the loop feels most familiar when it starts again?"
- "When the first doubt shows up, what usually happens next in the loop?"`;
  }
  if (slot.role === "mechanism") {
    return `Slot ${slot.index} (mechanism): Replay how the user kept arriving here — reconstruct their loop, not a summary of it. ${SLOT_MIN_MECHANISM_SENTENCES}–${SLOT_MAX_MECHANISM_SENTENCES} short sentences (≤${SLOT_MAX_MECHANISM_CHARS} chars total). Each sentence is one step; cause should lead to effect; one step should naturally lead to the next. Stay close to the user's own words and concrete details from the evidence. Simple, conversational, human. No "You…".

The only question to answer: "How did the user keep arriving here?"
It should feel like replaying their day, not explaining it — and never like coaching them out of it.

Do:
- Replay the sequence of events
- Show cause → effect
- Stop before conclusions or judgments
- Name the pattern's shape descriptively, without implying anything is wrong

Do NOT:
- Summarize the evidence
- Invent emotions or psychology
- Explain what the behavior means
- Diagnose, advise, or moralize
- Imply the user should stop, notice, examine, or change something
- Suggest alternative behavior, even as a question
- Append citation brackets or quote numbers in the text (e.g. "[1,2,3]") — quote numbers are for the application only, never visible prose

REJECT (corrective / judgmental — implies something should be fixed):
- "The gap between 'stupid' and 'fixed three bugs' stays unexamined."
- "Opening and checking repeated across hours [1,2,3,4,5,6]"
- "The shift happens before dismissing what comes next."

ACCEPT (purely descriptive — names the shape, no correction implied):
- "A bug appeared. Nearby code got reorganized. Files needed new names. The deployment never moved."
- "The work felt too big to begin. Something smaller felt easier. That became something else. By the end of the day, the original task was still waiting."
- "A message sat unopened. Checking filled the gaps. The thread stayed unread."`;
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
    ? "\nArc: guided discovery. The user's quotes are the primary voice. You ask questions and replay how they kept arriving here — never interpret psychology, explain the user to themselves, or suggest they should do anything differently.\n"
    : "";

  return `You write very small pieces of text for a private journal reflection. The application already placed the user's quotes — you add questions and at most one mechanism passage that replays how the user kept arriving here.
${arcNote}
Pattern label (never use in your text): ${label}
Definition (never repeat or paraphrase): ${definition}
${priorVoiceBlock(input)}
Evidence quotes (for grounding only — do NOT repeat these words back; do NOT cite them as [1] or [1,2,3] in your text):
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Slots to fill:
${voiceSlots.map((s) => describeSlot(s)).join("\n")}

Rules:
- Use as few words as possible
- For mechanism slots: stay close to the user's words and concrete details from the evidence; do not copy full quotes verbatim
- For recognition/reflection: NEVER paraphrase or echo the user's quote text
- No advice, no therapy voice, no pattern names, no diagnoses
- No invented emotions or psychology; no explaining what the behavior means
- No motive-based phrasing ("because you", "trying to", "permission to")
- Never imply the user's thinking is a problem to correct — no "stays unexamined," "before dismissing," "notice the shift," or "what would it feel like to try X instead"
- Never suggest alternative behavior, even framed as a question
- Never presume a negative outcome the journal did not state — no "worst version," "spiral," "catastrophe," or similar
- Reflection questions must stay purely observational/curious about the pattern itself
- Never include raw citation brackets or quote-index lists in visible text (no "[1]", "[1,2]", "[1,2,3,4,5,6]")
- Reflection slots MUST end with "?"
- Mechanism slots must NOT end with "?" and must NOT start with "You"
- Mechanism slots must replay cause → effect; stop before conclusions or judgments

Return ONLY valid JSON:
[{"index":<slot index>,"text":"<your line>"}]`;
}

export function buildSlotRetryPrompt(
  input: SlotGenerationInput,
  rejection: string,
): string {
  return `${buildSlotPrompt(input)}

Your previous response was rejected: ${rejection}

Return a corrected JSON array only. Shorter. More concrete. Purely descriptive — no corrective framing, no suggested alternatives, no citation brackets.`;
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
  corrective_voice:
    "The text implied the user should notice, examine, stop, or change something — describe the pattern only, never coach.",
  citation_leak:
    "The text included raw citation brackets like [1,2,3]. Keep quote indexes out of visible prose.",
  template_voice: "The text used a templated insight bridge.",
  insight_voice: "The text over-explained or closed the loop.",
  interpretive_voice: "The text interpreted psychology instead of describing evidence.",
  paraphrase: "A line repeated or paraphrased the user's quote text.",
  slot_echo: "A line repeated or paraphrased another voice slot.",
  not_question: "A question slot did not end with '?'.",
  not_statement: "A mechanism slot ended with '?' or started with 'You'.",
  multiple_sentences: "A line contained more than one sentence.",
  too_few_sentences: "A mechanism slot needs at least two sentences.",
  too_many_sentences: "A mechanism slot used more than four sentences.",
  summary_voice: "The mechanism summarized or explained instead of replaying how the user kept arriving here.",
  clause_join: "A line joined multiple realizations with 'and' or 'but'.",
  you_opener: "A line opened with 'You'.",
};
