/**
 * Loop (mechanism) + reflection slot generation prompts.
 *
 * BEHAVIORAL CONSTRAINTS - do not revert without explicit review:
 * - Evidence quotes are "islands" shown verbatim in the UI; the Loop names
 *   generic bridges (the recurring shape), never a montage of quote incidents.
 * - Programmatic guard: validation.ts → stitchesIncidents (incident_stitch).
 * - Loop is an observational reading of the writing, not a diagnosis of the
 *   person (no "you always…", "your mind…", trait claims).
 * - Reflection questions must be traceable to a concrete evidence fragment;
 *   validators: not_grounded, label_echo, slot_echo (mechanism paraphrase).
 * - Form variety: mechanism beat count/length and reflection openings must
 *   vary across patterns - never default to a fixed 3-beat / "When…" template.
 */

import "server-only";

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
    return `Slot ${slot.index} (reflection): ONE open wondering question (≤${SLOT_MAX_QUESTION_CHARS} chars), must end with "?".

The question MUST start from something the user actually wrote - a concrete fragment from the evidence quotes (a phrase, image, or moment). Wonder about THAT. Do not name the pattern. Do not restate or paraphrase the Loop/mechanism. Do not tell the user what they feel or what the answer should be.

Pure curiosity - never suggest an action, alternative, or that the user should notice/stop/change anything. No advice, no conclusions, no therapy.

Variety (form only - content rules unchanged):
- Vary the grammatical opening. Do NOT default to "When X, what usually happens / comes next / signals Y?"
- Prefer openings that cite the writing: You mentioned…, You wrote…, You kept…, After…, Once…
- Stay observational and neutral - variety is syntax, not advice or verdict

REJECT (assumes the pattern / restates the Loop / ungrounded):
- "How does the comparison shift when you encounter someone else's success?"
- "What part of the loop feels most familiar when it starts again?"
- "Where does the pull to check show up most sharply in a day like this?"
- "What would it feel like to leave it unopened for an hour?"
- "How quickly does the worst version arrive once the first doubt appears?"

ACCEPT (cites a concrete fragment from the evidence; open; no pattern label):
- "You wondered why you're still here. What was that bringing up?"
- "You kept thinking about the funding. What brought it back?"
- "You said it felt more like a fact this time. What felt different?"`;
  }
  if (slot.role === "mechanism") {
    return `Slot ${slot.index} (Loop / mechanism): Build BRIDGES between evidence islands - an observational reading of how these moments relate, not a montage of separate entry incidents, and not a diagnosis of who the person is.

The numbered evidence quotes are already shown to the user as Moments from different entries. Your job is NOT to restate, compress, or walk through those specific incidents in order. Your job is to describe the recurring shape visible in the writing - the shift or pressure that keeps showing up - in plain language.

Think: Evidence = islands (already visible). Loop = one abstracted observational chain that could apply across many of those moments. This is one reading of the writing, not a settled fact about the person.

Write ${SLOT_MIN_MECHANISM_SENTENCES}–${SLOT_MAX_MECHANISM_SENTENCES} sentences (≤${SLOT_MAX_MECHANISM_CHARS} chars total). Each sentence is one step in the recurring shape; one step should naturally lead to the next. Simple, conversational, human. Do not open with "You".

Variety (form only - content rules unchanged):
- Choose ${SLOT_MIN_MECHANISM_SENTENCES}, 3, or ${SLOT_MAX_MECHANISM_SENTENCES} beats to fit THIS loop - do NOT default to exactly 3 every time
- Vary sentence length - mix a short punchy beat with a longer one; avoid three evenly clipped declaratives of similar length
- Stay insightful and specific to the evidence shape - not vague, not diagnostic

The only question to answer: "What recurring relationship between these moments shows up in the writing?"
It should feel like noticing something in the journal, not naming a personality trait - and never like coaching them out of it.

Compressed / telegraphic style is fine (dropping "I"/"you" is ok), but every sentence must still parse as a complete grammatical clause.

Do:
- Describe the recurring loop as an observation of the writing (roles, pressures, hesitations - not quote-specific objects)
- Show how one step leads into the next inside that shape
- Stop before conclusions, judgments, or identity claims
- Stay grounded in what the evidence shows, without naming each incident

Do NOT:
- Stitch separate entry incidents into an implied timeline or montage
- Restate, compress, or closely paraphrase the specific actions/objects from individual quotes
- Summarize the evidence as a list of things that happened
- Invent emotions, motives, psychology, or internal mechanisms ("your mind reaches for…")
- Explain what the behavior means about the person
- Use trait language: "you always…", "you tend to…", "you are someone who…", "you compare yourself…"
- Diagnose, advise, or moralize
- Append citation brackets or quote numbers in the text (e.g. "[1,2,3]")
- Write every loop as three equal-length beats (that reads as a fixed template)

REJECT - incident_stitch (stitches separate entry incidents into a fake causal sequence):
- "Saw someone's number posted. Saw a feature shipped. Saw a week away become a year's measure."
- "Saw a salary posted, then did the math on years of experience. Saw their launch go live. Counted how far behind I was."

REJECT (paraphrase / restating islands - each line is a shorter rewrite of a quote):
- Evidence: "I kept watching tutorials." / "I reorganized my folders."
- ● Watching tutorials.
- ● Reorganizing folders.

REJECT (declarative trait / invented psychology):
- "You compare yourself to other people's progress."
- "You always measure your worth against peers."
- "Your mind reaches for a measuring rod whenever someone else succeeds."

REJECT (corrective / judgmental):
- "The gap between 'stupid' and 'fixed three bugs' stays unexamined."
- "Opening and checking repeated across hours [1,2,3,4,5,6]"

ACCEPT (observational reading of the writing - insightful, not diagnostic; beat count and length deliberately varied):
- 2 beats: "When another person's progress shows up in the writing, attention turns toward where you are. The next thought is already about the gap."
- 2 beats, uneven length: "A message sat unopened. Checking filled every gap until the thread was still unread."
- 3 beats: "Someone asked for help or time. Saying no felt harder than it should. The yes came out instead."
- 4 beats, last longer: "The work felt too big to begin. Something smaller felt easier. That became something else. By the end of the day, the original task was still waiting."
- 2 beats, short: "Learning started feeling safer than shipping. The start stayed postponed."`;
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
    ? "\nArc: guided discovery. The user's quotes are the primary voice - already shown verbatim. The Loop is one observational reading of how those moments relate (bridges, not islands). The question starts from a concrete fragment of their writing. Never diagnose the person or suggest they should do anything differently.\n"
    : "";

  return `You write very small pieces of text for a private journal reflection. The application already placed the user's quotes - you add questions and at most one mechanism passage that names an observational reading of how they keep arriving here.
${arcNote}
Pattern label (never use in your text): ${label}
Definition (never repeat or paraphrase): ${definition}
${priorVoiceBlock(input)}
Evidence quotes (islands - already shown verbatim; for grounding only - do NOT restate these incidents as a montage; do NOT cite them as [1] or [1,2,3] in your text):
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Slots to fill:
${voiceSlots.map((s) => describeSlot(s)).join("\n")}

Rules:
- Use as few words as possible
- For mechanism slots: observational reading of the writing's recurring shape - NOT a montage of quote-specific incidents, NOT a trait diagnosis
- For mechanism slots: do NOT restate concrete actions, objects, or phrases from individual quotes as sequential steps
- For mechanism slots: compressed phrasing is fine, but every sentence must still be a complete grammatical clause
- For mechanism slots: vary beat count (${SLOT_MIN_MECHANISM_SENTENCES}–${SLOT_MAX_MECHANISM_SENTENCES}, not always 3) and sentence length - avoid a fixed equal-beat template
- For mechanism slots: never "you always…", "you tend to…", "your mind…", "you are someone who…"
- For reflection: MUST cite a concrete fragment from the evidence quotes; do NOT name the pattern label; do NOT restate the Loop
- For reflection: vary the grammatical opening - do not default to "When X, what usually happens/comes next/signals Y?"
- No advice, no therapy voice, no pattern names, no diagnoses
- No invented emotions or psychology; no explaining what the behavior means about the person
- No motive-based phrasing ("because you", "trying to", "permission to")
- Never imply the user's thinking is a problem to correct
- Never suggest alternative behavior, even framed as a question
- Never presume a negative outcome the journal did not state
- Never include raw citation brackets or quote-index lists in visible text
- Reflection slots MUST end with "?"
- Mechanism slots must NOT end with "?" and must NOT start with "You"
- Mechanism slots must show how one step leads into the next inside the recurring shape; stop before conclusions or judgments
- Never use em dashes (-) or en dashes (–) in mechanism or question text; use a comma or period instead

Return ONLY valid JSON:
[{"index":<slot index>,"text":"<your line>"}]`;
}

const RETRY_COACHING: Record<string, string> = {
  incident_stitch:
    "Your Loop stitched separate entry incidents into a timeline. The quotes are already shown - describe the generic recurring shape (bridges), not a montage of those specific moments. No sequential 'Saw X / Saw Y / Saw Z' from different entries.",
  not_grounded:
    "A reflection question must cite a concrete fragment from the evidence quotes - start from words the user wrote.",
  label_echo:
    "Do not use the pattern label or pattern name in the text.",
  slot_echo:
    "Do not restate or paraphrase the Loop/mechanism in the question - ask about a specific moment from the quotes.",
  trait_voice:
    "Describe an observational reading of the writing - not a trait claim about the person (no 'you always', 'your mind', 'you compare yourself').",
};

export function buildSlotRetryPrompt(
  input: SlotGenerationInput,
  rejection: string,
): string {
  const coaching = RETRY_COACHING[rejection] ?? rejection;
  const toneHint =
    rejection === "incident_stitch"
      ? "More abstract. Name the recurring shape - not quote-specific incidents."
      : rejection === "not_grounded" || rejection === "slot_echo"
        ? "Anchor the question in a short phrase from the evidence quotes."
        : "Shorter. Purely descriptive - no corrective framing, no suggested alternatives, no citation brackets.";

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
    "The text implied the user should notice, examine, stop, or change something - describe the pattern only, never coach.",
  citation_leak:
    "The text included raw citation brackets like [1,2,3]. Keep quote indexes out of visible prose.",
  template_voice: "The text used a templated insight bridge.",
  insight_voice: "The text over-explained or closed the loop.",
  interpretive_voice: "The text interpreted psychology instead of describing evidence.",
  trait_voice:
    "The Loop claimed a trait or invented psychology about the person instead of observing the writing.",
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
