import type { DisplayInput } from "@/lib/ai/pattern-display/input";
import {
  DISPLAY_SUMMARY_MAX_CHARS,
  DISPLAY_TITLE_WORDS_MAX,
  DISPLAY_TITLE_WORDS_MIN,
} from "@/lib/ai/pattern-display/constants";

/**
 * BEHAVIORAL CONSTRAINTS (display titles):
 * - Curiosity / tension hooks only — never settle a trait or verdict about the person.
 * - REJECT settled-trait titles ("Can't Just Say Thank You", "They Chose Wrong").
 * - ACCEPT process/moment titles ("The Correction That Wouldn't Stop", "The Verdict Before the Facts").
 * - Linked validator: `verdict_voice` in validation.ts (absolute+verb / flat personal verdict).
 */

const SYSTEM = `You write a short title for a recurring thread across someone's private journal entries.

The title's only job: make the writer want to open this before they know what it means.

Create curiosity. Do not describe the behavior. Do not name the category. Do not explain what the writer is doing.
Do not settle a trait or verdict about the person. Point at a process, loop, or unresolved moment — never a fixed judgment.

Read the evidence quotes and find the unresolved tension — the stall, the gap, the thing that didn't end, didn't change, or didn't quite finish. Then write a title that points at that tension without resolving it.

Good titles (calibration only — do not copy):
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
- "Avoidance" / "Perfectionism" / "Procrastination" (category or psychology labels)
- "Rewriting the email again" / "Cleaning before starting" (activity summaries)
- "You keep putting it off" (second person / coaching)
- "Fear of failure" (diagnosis)
- "Growth through resistance" (self-help)
- "Can't Just Say Thank You" / "They Chose Wrong" / "I'm Not Good At This" (settled trait-verdict about the person)

REJECT (settled verdict — sounds like a fixed fact about who they are):
- "Can't Just Say Thank You"
- "They Chose Wrong"
- "I'm Not Good At This"

ACCEPT (names a process, moment, or tension without concluding):
- "The Correction That Wouldn't Stop"
- "The Verdict Before the Facts"

A good title feels like a half-remembered thought after rereading your own journal — specific enough to pull you in, vague enough that you need to open it to understand.

Rules for displayTitle:
- ${DISPLAY_TITLE_WORDS_MIN}–${DISPLAY_TITLE_WORDS_MAX} words
- Intrigue first — the reader should wonder "what does that mean?" before they understand
- Can be a short question or a statement; fragments and scene details work well
- Name the tension or process, not the behavior, not the lesson, not the pattern, not a trait
- Prefer timing/process framing (when / before / after / arrives / returns / wouldn't stop) over absolute judgments (can't / never / always)
- Use simple, natural language; prefer mystery over explanation
- Ground it in what keeps showing up across the quotes — but distill, don't summarize
- Never start with "You" or "Your"
- Never use the pattern vocabulary label (${"{label}"} is for reference only — never appear in the title)
- Never use "instead of", "rather than", or contrastive advice framing
- Never write a flat verdict about the person ("They…", "I'm not…", "Can't…") as settled fact
- Do not copy a full quote; compress the tension into a phrase

Rules for summary (optional):
- One short observational fragment (≤${DISPLAY_SUMMARY_MAX_CHARS} chars), or null
- Names what keeps showing up across entries — not why it happens, not what it means
- Same voice rules: no therapy, no advice, no "You…", no diagnosis, no trait-verdict`;

export function buildDisplayPrompt(input: DisplayInput): string {
  const { label, definition, quotes } = input;

  return `${SYSTEM.replace("{label}", label)}

Pattern vocabulary (reference only — never use in the title): ${label}
Definition (reference only — never paraphrase): ${definition}

Evidence quotes from different entries:
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Return ONLY valid JSON:
{"displayTitle":"<${DISPLAY_TITLE_WORDS_MIN}-${DISPLAY_TITLE_WORDS_MAX} word curiosity title>","summary":"<optional short fragment or null>"}`;
}

export function buildDisplayRetryPrompt(
  input: DisplayInput,
  rejection: string,
): string {
  return `${buildDisplayPrompt(input)}

Your previous response was rejected: ${rejection}

Write a new JSON response. Create curiosity — name a process or unresolved moment, not a settled trait or verdict about the person. No category names. No labels. No "instead of". No "You". No "Can't…", "They… [verdict]", or "I'm not…" as fixed fact.`;
}

export const DISPLAY_REJECTION_MESSAGES: Record<string, string> = {
  empty: "displayTitle was empty.",
  parsing_error: "The response was not valid JSON.",
  too_long: "displayTitle was too long.",
  too_short: "displayTitle was too short.",
  too_many_words: "displayTitle had too many words.",
  banned_voice: "The title sounded like therapy, coaching, or self-help.",
  behavior_voice: "The title described behavior instead of creating curiosity.",
  label_voice: "The title used a psychology or pattern label.",
  contrast_voice: 'The title used contrastive framing like "instead of".',
  you_voice: 'The title used second person ("You…").',
  verdict_voice:
    "The title read as a settled trait-verdict about the person. Name a process or unresolved moment instead — not a fixed judgment (avoid Can't/Never/Always verdicts and flat lines like \"They Chose Wrong\").",
  label_echo: "The title repeated the pattern label.",
  definition_echo: "The title paraphrased the pattern definition.",
  quote_copy: "The title copied a quote instead of distilling the tension.",
  vague_title: "The title was too vague to create curiosity.",
  not_grounded: "The title did not connect to the tension in the quotes.",
  summary_voice: "The summary sounded explanatory or like advice.",
};
