import type { DisplayInput } from "@/lib/ai/pattern-display/input";
import {
  DISPLAY_SUMMARY_MAX_CHARS,
  DISPLAY_TITLE_WORDS_MAX,
  DISPLAY_TITLE_WORDS_MIN,
} from "@/lib/ai/pattern-display/constants";

const SYSTEM = `You name recurring behaviors that show up across someone's private journal entries.

This is NOT therapy, coaching, diagnosis, or self-help. You are not interpreting their personality or giving advice.

Your job: read the evidence quotes and write a short label for the recurring BEHAVIOR — something concrete the writer might recognize and say out loud, like naming a habit on a sticky note.

Good titles (calibration only — do not copy):
- "Rewriting the email again"
- "Another pros-and-cons list"
- "Cleaning before starting"
- "Waiting for the right moment"
- "One more pass on the draft"

Bad titles (never):
- "Preparing instead of beginning" (abstract contrast / advice voice)
- "Searching for the right version" (vague, interpretive)
- "The safer version" (psychology label)
- "You keep avoiding" (second person / coaching)
- "Fear of failure" (diagnosis)
- "Growth through resistance" (self-help)
- "every" or any single vague word

Rules for displayTitle:
- ${DISPLAY_TITLE_WORDS_MIN}–${DISPLAY_TITLE_WORDS_MAX} words
- Name a recurring action, habit, or stall — not a feeling, lesson, or pattern label
- Ground it in what actually happens in the quotes (specific behaviors, not abstractions)
- Never use "instead of", "rather than", or contrastive advice framing
- Never start with "You" or "Your"
- Never use the pattern vocabulary label (${"{label}"} is for reference only)
- Prefer plain language the writer would use — fragments are fine
- Do not copy a full quote; compress recurring behavior into a natural phrase

Rules for summary (optional):
- One short observational fragment (≤${DISPLAY_SUMMARY_MAX_CHARS} chars), or null
- Names what keeps showing up across entries — not why it happens, not what it means
- Same voice rules: no therapy, no advice, no "You…", no diagnosis`;

export function buildDisplayPrompt(input: DisplayInput): string {
  const { label, definition, quotes } = input;

  return `${SYSTEM.replace("{label}", label)}

Pattern vocabulary (reference only — never use as the title): ${label}
Definition (reference only — never paraphrase): ${definition}

Evidence quotes from different entries:
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Return ONLY valid JSON:
{"displayTitle":"<${DISPLAY_TITLE_WORDS_MIN}-${DISPLAY_TITLE_WORDS_MAX} word behavior label>","summary":"<optional short fragment or null>"}`;
}

export function buildDisplayRetryPrompt(
  input: DisplayInput,
  rejection: string,
): string {
  return `${buildDisplayPrompt(input)}

Your previous response was rejected: ${rejection}

Write a new JSON response. More concrete. Name the behavior, not the meaning. No "instead of". No "You".`;
}

export const DISPLAY_REJECTION_MESSAGES: Record<string, string> = {
  empty: "displayTitle was empty.",
  parsing_error: "The response was not valid JSON.",
  too_long: "displayTitle was too long.",
  too_short: "displayTitle was too short.",
  too_many_words: "displayTitle had too many words.",
  banned_voice: "The title sounded like therapy, coaching, or self-help.",
  abstract_voice: "The title was abstract or interpretive instead of naming a behavior.",
  contrast_voice: 'The title used contrastive framing like "instead of".',
  you_voice: 'The title used second person ("You…").',
  label_echo: "The title repeated the pattern label.",
  definition_echo: "The title paraphrased the pattern definition.",
  quote_copy: "The title copied a quote instead of naming the behavior.",
  vague_title: "The title was too vague or too short to identify the behavior.",
  not_grounded: "The title was not grounded in the provided quotes.",
  summary_voice: "The summary sounded explanatory or like advice.",
};
