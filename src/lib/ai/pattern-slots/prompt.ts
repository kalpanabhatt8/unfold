/**
 * Loop (mechanism) + reflection slot generation prompts.
 *
 * BEHAVIORAL CONSTRAINTS — do not revert without explicit review:
 * - Evidence quotes are "islands" shown verbatim in the UI; the Loop names
 *   generic bridges (the recurring shape), never a montage of quote incidents.
 * - Programmatic guard: validation.ts → stitchesIncidents (incident_stitch).
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
    return `Slot ${slot.index} (Loop / mechanism): Build BRIDGES between evidence islands — name the recurring shape of how the user kept arriving here, not a montage of separate entry incidents.

The numbered evidence quotes are already shown to the user as Moments from different entries. Your job is NOT to restate, compress, or walk through those specific incidents in order. Your job is to describe the generic loop — the shift or pressure that keeps repeating — in plain language.

Think: Evidence = islands (already visible). Loop = one abstracted chain that could apply across many of those moments.

Write ${SLOT_MIN_MECHANISM_SENTENCES}–${SLOT_MAX_MECHANISM_SENTENCES} short sentences (≤${SLOT_MAX_MECHANISM_CHARS} chars total). Each sentence is one step in the recurring shape; cause should lead to effect; one step should naturally lead to the next. Simple, conversational, human. No "You…".

The only question to answer: "How did the user keep arriving here?"
It should feel like naming a familiar pattern, not replaying a highlight reel of their journal — and never like coaching them out of it.

Compressed / telegraphic style is fine (dropping "I"/"you" is ok), but every sentence must still parse as a complete grammatical clause.

Do:
- Describe the recurring loop in generic terms (roles, pressures, hesitations — not quote-specific objects)
- Show cause → effect inside that shape
- Stop before conclusions or judgments
- Stay grounded in what the evidence shows, without naming each incident

Do NOT:
- Stitch separate entry incidents into an implied timeline or montage
- Restate, compress, or closely paraphrase the specific actions/objects from individual quotes
- Summarize the evidence as a list of things that happened
- Invent emotions or psychology
- Explain what the behavior means
- Diagnose, advise, or moralize
- Append citation brackets or quote numbers in the text (e.g. "[1,2,3]")

REJECT — incident_stitch (stitches separate entry incidents into a fake causal sequence):
- "Saw someone's number posted. Saw a feature shipped. Saw a week away become a year's measure."
- "Saw a salary posted, then did the math on years of experience. Saw their launch go live. Counted how far behind I was."

REJECT (paraphrase / restating islands — each line is a shorter rewrite of a quote):
- Evidence: "I kept watching tutorials." / "I reorganized my folders."
- ● Watching tutorials.
- ● Reorganizing folders.

REJECT (corrective / judgmental):
- "The gap between 'stupid' and 'fixed three bugs' stays unexamined."
- "Opening and checking repeated across hours [1,2,3,4,5,6]"

ACCEPT (generic abstracted loop shape — one recurring pattern, not a montage):
- "Someone asked for help or time. Saying no felt harder than it should. The yes came out instead."
- "Learning started feeling safer than beginning."
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
    ? "\nArc: guided discovery. The user's quotes are the primary voice — already shown verbatim. You name the generic loop shape between them (bridges, not islands), ask questions, and never interpret psychology or suggest they should do anything differently.\n"
    : "";

  return `You write very small pieces of text for a private journal reflection. The application already placed the user's quotes — you add questions and at most one mechanism passage that names how they kept arriving here in generic terms.
${arcNote}
Pattern label (never use in your text): ${label}
Definition (never repeat or paraphrase): ${definition}
${priorVoiceBlock(input)}
Evidence quotes (islands — already shown verbatim; for grounding only — do NOT restate these incidents; do NOT cite them as [1] or [1,2,3] in your text):
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Slots to fill:
${voiceSlots.map((s) => describeSlot(s)).join("\n")}

Rules:
- Use as few words as possible
- For mechanism slots: describe the generic recurring loop shape — NOT a montage of quote-specific incidents from separate entries
- For mechanism slots: do NOT restate concrete actions, objects, or phrases from individual quotes as sequential steps
- For mechanism slots: compressed phrasing is fine, but every sentence must still be a complete grammatical clause
- For recognition/reflection: NEVER paraphrase or echo the user's quote text
- No advice, no therapy voice, no pattern names, no diagnoses
- No invented emotions or psychology; no explaining what the behavior means
- No motive-based phrasing ("because you", "trying to", "permission to")
- Never imply the user's thinking is a problem to correct
- Never suggest alternative behavior, even framed as a question
- Never presume a negative outcome the journal did not state
- Reflection questions must stay purely observational/curious about the pattern itself
- Never include raw citation brackets or quote-index lists in visible text
- Reflection slots MUST end with "?"
- Mechanism slots must NOT end with "?" and must NOT start with "You"
- Mechanism slots must show cause → effect inside the recurring shape; stop before conclusions or judgments
- Never use em dashes (—) or en dashes (–) in mechanism or question text; use a comma or period instead

Return ONLY valid JSON:
[{"index":<slot index>,"text":"<your line>"}]`;
}

const RETRY_COACHING: Record<string, string> = {
  incident_stitch:
    "Your Loop stitched separate entry incidents into a timeline. The quotes are already shown — describe the generic recurring shape (bridges), not a montage of those specific moments. No sequential 'Saw X / Saw Y / Saw Z' from different entries.",
};

export function buildSlotRetryPrompt(
  input: SlotGenerationInput,
  rejection: string,
): string {
  const coaching = RETRY_COACHING[rejection] ?? rejection;
  const toneHint =
    rejection === "incident_stitch"
      ? "More abstract. Name the recurring shape — not quote-specific incidents."
      : "Shorter. Purely descriptive — no corrective framing, no suggested alternatives, no citation brackets.";

  return `${buildSlotPrompt(input)}

Your previous response was rejected: ${coaching}

Return a corrected JSON array only. ${toneHint}`;
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
  summary_voice: "The mechanism summarized or explained instead of naming the recurring loop shape.",
  incident_stitch:
    "The Loop stitched separate entry incidents into a montage timeline instead of describing the generic recurring shape.",
  clause_join: "A line joined multiple realizations with 'and' or 'but'.",
  you_opener: "A line opened with 'You'.",
};
