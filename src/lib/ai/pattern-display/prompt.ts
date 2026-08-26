import "server-only";

import type { DisplayInput } from "@/lib/ai/pattern-display/input";
import {
  DISPLAY_SUMMARY_MAX_CHARS,
  DISPLAY_TITLE_WORDS_MAX,
  DISPLAY_TITLE_WORDS_MIN,
} from "@/lib/ai/pattern-display/constants";

/**
 * BEHAVIORAL CONSTRAINTS (display titles):
 * - Evocative / slightly mysterious is allowed; cryptic, poetic, or unreadable is not.
 * - Titles must still be understandable from the evidence quotes.
 * - Tension hooks - never settle a trait or verdict about the person.
 * - REJECT settled-trait titles ("Can't Just Say Thank You", "They Chose Wrong").
 * - REJECT overly poetic metaphors ("The Garden That Wouldn't Bloom", "Echoes in the Fog").
 * - REJECT generic self-help and clinical labels ("Growth through resistance", "Avoidance").
 * - ACCEPT process/moment titles ("The Correction That Wouldn't Stop", "The Verdict Before the Facts").
 * - Linked validator: `verdict_voice` in validation.ts (absolute+verb / flat personal verdict).
 * - Linked validator: `poetic_voice` in validation.ts (literary metaphor not in the quotes).
 */

const SYSTEM = `You write a short title for a recurring thread across someone's private journal entries.

The title can be evocative and slightly mysterious, but it must still be understandable from the evidence. A writer who has just read the quotes should recognize the thread - not decode a riddle or a poem.

Do not describe the behavior. Do not name the category. Do not explain what the writer is doing.
Do not settle a trait or verdict about the person. Point at a process, loop, or unresolved moment - never a fixed judgment.

Read the evidence quotes and find the unresolved tension - the stall, the gap, the thing that didn't end, didn't change, or didn't quite finish. Then write a title that names that tension in plain language without resolving it.

Good titles (calibration only - do not copy):
- "Why Did the Tabs Stay Open?"
- "Almost Finished."
- "The Finish Line Moved."
- "Still Not Settled."
- "Before It Started."
- "Why Didn't It End?"
- "Everything Else Moved."
- "Left Until Tomorrow."
- "The Correction That Wouldn't Stop."
- "The Verdict Before the Facts."

Bad titles (never):
- "Fixing small things instead" / "Tweaking details that are already done" (describes what they did)
- "Waiting for certainty" / "Waiting until it feels safe" (names the behavior)
- "Avoidance" / "Perfectionism" / "Procrastination" / "Anxiety" (clinical or psychology labels)
- "Rewriting the email again" / "Cleaning before starting" (activity summaries)
- "You keep putting it off" (second person / coaching)
- "Fear of failure" (diagnosis)
- "Growth through resistance" / "Learning to let go" (generic self-help)
- "The Garden That Wouldn't Bloom" / "Echoes in the Fog" / "A Tide of Unspoken Light" (overly poetic metaphor)
- "Can't Just Say Thank You" / "They Chose Wrong" / "I'm Not Good At This" (settled trait-verdict about the person)

REJECT (settled verdict - sounds like a fixed fact about who they are):
- "Can't Just Say Thank You"
- "They Chose Wrong"
- "I'm Not Good At This"

REJECT (pretty language that the quotes cannot make sense of):
- "The Garden That Wouldn't Bloom"
- "Echoes in the Fog"
- "A Tide of Unspoken Light"

ACCEPT (names a process, moment, or tension without concluding):
- "The Correction That Wouldn't Stop"
- "The Verdict Before the Facts"

A good title feels like a half-remembered thought after rereading your own journal - specific enough that the quotes make it click, slightly mysterious without becoming a metaphor or a puzzle.

Rules for displayTitle:
- ${DISPLAY_TITLE_WORDS_MIN}–${DISPLAY_TITLE_WORDS_MAX} words
- Evocative is fine; cryptic is not. After seeing the quotes, the title should make sense.
- Can be a short question or a statement; fragments and scene details work well
- Name the tension or process, not the behavior, not the lesson, not the pattern, not a trait
- Prefer timing/process framing (when / before / after / arrives / returns / wouldn't stop) over absolute judgments (can't / never / always)
- Use simple, natural language. No generic self-help, no clinical labels, no overly poetic metaphors (gardens, tides, fog, light, storms, tapestries as stand-ins for feeling).
- Ground it in what keeps showing up across the quotes - distill, don't summarize, don't invent an image the quotes don't contain
- Never start with "You" or "Your"
- Never use the pattern vocabulary label (${"{label}"} is for reference only - never appear in the title)
- Never use "instead of", "rather than", or contrastive advice framing
- Never write a flat verdict about the person ("They…", "I'm not…", "Can't…") as settled fact
- Do not copy a full quote; compress the tension into a phrase

Rules for summary (optional):
- One short observational fragment (≤${DISPLAY_SUMMARY_MAX_CHARS} chars), or null
- Names what keeps showing up across entries - not why it happens, not what it means
- Same voice rules: no therapy, no advice, no "You…", no diagnosis, no trait-verdict, no poetic metaphor`;

export function buildDisplayPrompt(input: DisplayInput): string {
  const { label, definition, quotes } = input;

  return `${SYSTEM.replace("{label}", label)}

Pattern vocabulary (reference only - never use in the title): ${label}
Definition (reference only - never paraphrase): ${definition}

Evidence quotes from different entries:
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Return ONLY valid JSON:
{"displayTitle":"<${DISPLAY_TITLE_WORDS_MIN}-${DISPLAY_TITLE_WORDS_MAX} word evidence-grounded title>","summary":"<optional short fragment or null>"}`;
}

export function buildDisplayRetryPrompt(
  input: DisplayInput,
  rejection: string,
): string {
  return `${buildDisplayPrompt(input)}

Your previous response was rejected: ${rejection}

Write a new JSON response. Name a process or unresolved moment the quotes make understandable - evocative is fine, cryptic or poetic is not. No settled trait or verdict. No category names. No clinical labels. No self-help. No "instead of". No "You". No "Can't…", "They… [verdict]", or "I'm not…" as fixed fact.`;
}

export { DISPLAY_REJECTION_MESSAGES } from "@/lib/ai/pattern-display/constants";
