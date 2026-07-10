import type { DisplayInput } from "@/lib/ai/pattern-display/input";
import {
  DISPLAY_SUMMARY_MAX_CHARS,
  DISPLAY_TITLE_WORDS_MAX,
  DISPLAY_TITLE_WORDS_MIN,
} from "@/lib/ai/pattern-display/constants";

const SYSTEM = `You write a short title for a recurring thread across someone's private journal entries.

The title's only job: make the writer want to open this before they know what it means.

Create curiosity. Do not describe the behavior. Do not name the category. Do not explain what the writer is doing.

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

Bad titles (never):
- "Fixing small things instead" / "Tweaking details that are already done" (describes what they did)
- "Waiting for certainty" / "Waiting until it feels safe" (names the behavior)
- "Avoidance" / "Perfectionism" / "Procrastination" (category or psychology labels)
- "Rewriting the email again" / "Cleaning before starting" (activity summaries)
- "You keep putting it off" (second person / coaching)
- "Fear of failure" (diagnosis)
- "Growth through resistance" (self-help)

A good title feels like a half-remembered thought after rereading your own journal — specific enough to pull you in, vague enough that you need to open it to understand.

Rules for displayTitle:
- ${DISPLAY_TITLE_WORDS_MIN}–${DISPLAY_TITLE_WORDS_MAX} words
- Intrigue first — the reader should wonder "what does that mean?" before they understand
- Can be a short question or a statement; fragments and scene details work well
- Name the tension, not the behavior, not the lesson, not the pattern
- Use simple, natural language; prefer mystery over explanation
- Ground it in what keeps showing up across the quotes — but distill, don't summarize
- Never start with "You" or "Your"
- Never use the pattern vocabulary label (${"{label}"} is for reference only — never appear in the title)
- Never use "instead of", "rather than", or contrastive advice framing
- Do not copy a full quote; compress the tension into a phrase

Rules for summary (optional):
- One short observational fragment (≤${DISPLAY_SUMMARY_MAX_CHARS} chars), or null
- Names what keeps showing up across entries — not why it happens, not what it means
- Same voice rules: no therapy, no advice, no "You…", no diagnosis`;

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

Write a new JSON response. Create curiosity — do not describe the behavior. No category names. No labels. No "instead of". No "You".`;
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
  label_echo: "The title repeated the pattern label.",
  definition_echo: "The title paraphrased the pattern definition.",
  quote_copy: "The title copied a quote instead of distilling the tension.",
  vague_title: "The title was too vague to create curiosity.",
  not_grounded: "The title did not connect to the tension in the quotes.",
  summary_voice: "The summary sounded explanatory or like advice.",
};
