/**
 * Loop (mechanism) + reflection slot generation prompts.
 *
 * BEHAVIORAL CONSTRAINTS - do not revert without explicit review:
 * - Evidence quotes are "islands" shown verbatim in the UI; the Loop names
 *   generic bridges (the recurring shape), never a montage of quote incidents.
 * - Programmatic guard: validation.ts → stitchesIncidents (incident_stitch).
 * - Loop synthesizes the recurring behavior/mechanism across evidence in
 *   simple, original language. OK to point toward what Unfold notices; not
 *   poetic rephrasing of quotes or unsupported psychology. Validators:
 *   incident_stitch, paraphrase, literary_voice, trait_voice.
 * - Reflection is the next step after the Loop: cite a concrete evidence
 *   fragment, then ask the user to investigate what Unfold noticed.
 *   Do not explain the psychology or assume the underlying reason.
 *   Validators: not_grounded, label_echo, slot_echo (mechanism paraphrase).
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
    return `Slot ${slot.index} (reflection): ONE natural question (≤${SLOT_MAX_QUESTION_CHARS} chars), must end with "?".

The Loop is what Unfold noticed in the writing. Your job is the next step: help the user investigate that observation themselves.

Two beats:
1. Point back to something specific and interesting in the evidence quotes (a phrase, image, or moment they wrote).
2. Ask a grounded follow-up that invites them to explore what Unfold noticed.

Do not name the pattern. Do not restate or paraphrase the Loop as the question. Do not explain the psychology. Do not assume the underlying reason. Do not tell them the answer.

A possible connection Unfold noticed may be pointed toward, then left for the user to investigate. Never suggest an action, alternative, or that they should notice/stop/change anything. No advice, no conclusions, no therapy.

Variety (form only - content rules unchanged):
- Prefer openings that cite the writing: You mentioned…, You wrote…, You kept…
- The second beat is the investigation - natural, specific, open
- Do NOT default to cryptic "What was X doing there / standing in for / bringing up?"
- Do NOT default to "When X, what usually happens / comes next / signals Y?"
- Stay observational - variety is syntax, not advice or verdict

REJECT (cryptic / ungrounded / assumes the reason / restates the Loop / coaches):
- "What was it doing there?"
- "What were those jobs standing in for?"
- "What was that bringing up?"
- "How does the comparison shift when you encounter someone else's success?"
- "What part of the loop feels most familiar when it starts again?"
- "What would it feel like to leave it unopened for an hour?"

ACCEPT (cites a concrete fragment, then invites investigation of what was noticed):
- "You mentioned imagining conversations before they happen. What do you usually find yourself worrying about?"
- "You mentioned finding tiny jobs that make you feel like you're doing something. What kinds of things do you usually end up doing?"
- "You wondered why you're still here. What do you usually find yourself measuring against?"`;
  }
  if (slot.role === "mechanism") {
    return `Slot ${slot.index} (Loop / mechanism): Synthesize the underlying recurring behavior across the evidence. Point toward what Unfold notices - do not simply rephrase the user's sentences or dress them up in poetic language.

The numbered evidence quotes are already shown to the user as Moments from different entries. Your job is NOT to restate, compress, or walk through those specific incidents in order. Your job is to name the common behavior or mechanism that shows up across them, in plain language the user could recognize.

Think: Evidence → synthesis → clear observation. Ask: "What recurring behavior do these moments reveal?" - NOT "How can I rewrite these moments to sound insightful?"

Write ${SLOT_MIN_MECHANISM_SENTENCES}–${SLOT_MAX_MECHANISM_SENTENCES} sentences (≤${SLOT_MAX_MECHANISM_CHARS} chars total). Each sentence adds one step in that recurring behavior; one step should naturally lead to the next. Simple, direct, conversational. Do not open with "You".

Variety (form only - content rules unchanged):
- Choose ${SLOT_MIN_MECHANISM_SENTENCES}, 3, or ${SLOT_MAX_MECHANISM_SENTENCES} beats to fit THIS loop - do NOT default to exactly 3 every time
- Vary sentence length - mix a short punchy beat with a longer one; avoid three evenly clipped declaratives of similar length
- Stay traceable to the evidence shape - specific enough to recognize, not vague or diagnostic

Do:
- Identify the common behavior or mechanism across multiple evidence moments
- Express that insight in simple, original language Unfold synthesized from the writing
- Point toward what keeps recurring (the shift, delay, substitute, revisit, etc.)
- Show how one step leads into the next inside that behavior
- Stop before conclusions, judgments, or identity claims

Do NOT:
- Stitch separate entry incidents into an implied timeline or montage
- Restate, compress, or closely paraphrase the specific actions/objects/phrases from individual quotes
- Copy distinctive phrases from the evidence into the Loop
- Use literary, metaphorical, or "insight poetry" phrasing
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

REJECT (literary / poetic rephrasing - sounds insightful but doesn't synthesize):
- "Turning it over becomes the work itself, as if the right angle of examination might finally resolve it."
- "Finishing those smaller things creates a sense of motion that stands in for the larger one."
- "Each step narrows the space between the moment and an imagined reaction to it."
- "The loop tightens when resolution doesn't come."
- "Attention turns toward where you are. The next thought is already about the gap."

REJECT (declarative trait / invented psychology):
- "You compare yourself to other people's progress."
- "You always measure your worth against peers."
- "Your mind reaches for a measuring rod whenever someone else succeeds."

REJECT (corrective / judgmental):
- "The gap between 'stupid' and 'fixed three bugs' stays unexamined."
- "Opening and checking repeated across hours [1,2,3,4,5,6]"

ACCEPT (behavioral synthesis - plain, original, traceable; beat count and length deliberately varied):
- 2 beats: "Revisiting keeps happening when no satisfying answer has arrived yet. The same situation comes back for another pass."
- 2 beats: "Smaller tasks show up when a larger one is waiting. Finishing them creates progress without touching the original task."
- 3 beats: "Someone asks for help or time. Saying no feels harder than it should. The yes comes out instead."
- 2 beats, short: "Learning keeps replacing shipping. The start stays postponed."`;
  }
  return `Slot ${slot.index}: ONE terse line (≤${SLOT_MAX_LINE_WORDS} words).`;
};

const priorVoiceBlock = (input: SlotGenerationInput): string => {
  if (input.priorVoice.length === 0) return "";
  return `\nAlready written (do NOT repeat or paraphrase; if a Loop is present, the question should help the user investigate it):\n${input.priorVoice
    .map((p) => `- ${p.role}: "${p.text}"`)
    .join("\n")}\n`;
};

export function buildSlotPrompt(input: SlotGenerationInput): string {
  const { label, definition, quotes, voiceSlots } = input;

  const arcNote = input.shapeId === "discovery"
    ? "\nArc: guided discovery. The user's quotes are the primary voice - already shown verbatim. The Loop synthesizes the recurring behavior Unfold noticed across those moments (evidence → synthesis → clear observation). The question is the next step: point back to a specific moment in the writing, then invite the user to investigate that observation. Never explain unsupported psychology, assume the reason, diagnose the person, or suggest they should do anything differently.\n"
    : "";

  return `You write very small pieces of text for a private journal reflection. The application already placed the user's quotes - you add at most one Loop (synthesized recurring behavior Unfold noticed) and a question that helps the user investigate that observation.
${arcNote}
Pattern label (never use in your text): ${label}
Definition (never repeat or paraphrase): ${definition}
${priorVoiceBlock(input)}
Evidence quotes (islands - already shown verbatim; for grounding only - do NOT restate these incidents as a montage; do NOT cite them as [1] or [1,2,3] in your text):
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Slots to fill:
${voiceSlots.map((s) => describeSlot(s)).join("\n")}

Rules:
- Be concise: Loop synthesizes recurring behavior; reflection uses two short beats (cite, then ask), not one cryptic line
- For mechanism slots: synthesize the common behavior across evidence - NOT a montage of quote-specific incidents, NOT poetic rephrasing, NOT a trait diagnosis
- For mechanism slots: do NOT restate concrete actions, objects, or distinctive phrases from individual quotes as sequential steps
- For mechanism slots: plain original language; no literary/metaphorical phrasing ("turning it over," "stands in for," "the loop tightens")
- For mechanism slots: compressed phrasing is fine, but every sentence must still be a complete grammatical clause
- For mechanism slots: vary beat count (${SLOT_MIN_MECHANISM_SENTENCES}–${SLOT_MAX_MECHANISM_SENTENCES}, not always 3) and sentence length - avoid a fixed equal-beat template
- For mechanism slots: never "you always…", "you tend to…", "your mind…", "you are someone who…"
- For reflection: cite a concrete fragment from the evidence, then ask the user to investigate what Unfold noticed
- For reflection: do NOT name the pattern label; do NOT restate the Loop as the question
- For reflection: do NOT explain the psychology or assume the underlying reason
- For reflection: two beats (cite, then ask) - concise, not cryptic; do not default to "What was X doing there?"
- For reflection: vary the grammatical opening - do not default to "When X, what usually happens/comes next/signals Y?"
- No advice, no therapy voice, no pattern names, no diagnoses
- For mechanism slots: no invented emotions or psychology; no explaining what the behavior means about the person
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
    "Your Loop stitched separate entry incidents into a timeline. Synthesize the recurring behavior across those moments - not a montage of specific incidents. No sequential 'Saw X / Saw Y / Saw Z' from different entries.",
  literary_voice:
    "State the recurring behavior in plain, original language. No metaphors, insight poetry, or poetic rewrites of the quotes.",
  paraphrase:
    "Do not restate or closely paraphrase quote wording. Synthesize the common behavior across the evidence in your own plain words.",
  not_grounded:
    "A reflection question must point back to a concrete fragment from the evidence quotes, then invite the user to investigate what was noticed.",
  label_echo:
    "Do not use the pattern label or pattern name in the text.",
  slot_echo:
    "Do not restate or paraphrase the Loop as the question. Cite a specific moment from the quotes, then ask the next investigative step.",
  trait_voice:
    "Synthesize recurring behavior from the evidence - not a trait claim about the person (no 'you always', 'your mind', 'you compare yourself').",
};

export function buildSlotRetryPrompt(
  input: SlotGenerationInput,
  rejection: string,
): string {
  const coaching = RETRY_COACHING[rejection] ?? rejection;
  const toneHint =
    rejection === "incident_stitch"
      ? "Synthesize the recurring behavior - not quote-specific incidents."
      : rejection === "literary_voice" || rejection === "paraphrase"
        ? "Plain behavioral synthesis in original words. No poetic rephrasing of the quotes."
      : rejection === "not_grounded" || rejection === "slot_echo"
        ? "Cite a specific phrase from the evidence, then ask the user to investigate what Unfold noticed. Do not explain why."
        : "Shorter. Plain synthesis - no corrective framing, no suggested alternatives, no citation brackets.";

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
    "The Loop claimed a trait or invented psychology about the person instead of synthesizing recurring behavior from the evidence.",
  literary_voice:
    "The Loop used literary or metaphorical phrasing instead of plain behavioral synthesis.",
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
