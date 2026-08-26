/** Haiku - low temperature for consistent evidence-grounded titles. */
export const DISPLAY_MODEL = "claude-haiku-4-5-20251001";
export const DISPLAY_MAX_TOKENS = 120;
export const DISPLAY_TEMPERATURE = 0.35;

export const DISPLAY_MAX_QUOTES = 12;
export const DISPLAY_MAX_QUOTE_CHARS = 160;

export const DISPLAY_TITLE_WORDS_MIN = 2;
export const DISPLAY_TITLE_WORDS_MAX = 8;
export const DISPLAY_TITLE_MAX_CHARS = 56;

export const DISPLAY_SUMMARY_MAX_CHARS = 90;

export const DISPLAY_CLIENT_TIMEOUT_MS = 12_000;

export const DISPLAY_REJECTION_MESSAGES: Record<string, string> = {
  empty: "displayTitle was empty.",
  parsing_error: "The response was not valid JSON.",
  too_long: "displayTitle was too long.",
  too_short: "displayTitle was too short.",
  too_many_words: "displayTitle had too many words.",
  banned_voice: "The title sounded like therapy, coaching, or self-help.",
  behavior_voice: "The title described behavior instead of naming the tension.",
  label_voice: "The title used a clinical, psychology, or pattern label.",
  contrast_voice: 'The title used contrastive framing like "instead of".',
  you_voice: 'The title used second person ("You…").',
  verdict_voice:
    "The title read as a settled trait-verdict about the person. Name a process or unresolved moment instead - not a fixed judgment (avoid Can't/Never/Always verdicts and flat lines like \"They Chose Wrong\").",
  poetic_voice:
    "The title used an overly poetic metaphor. Name the tension in plain language that the quotes make understandable.",
  label_echo: "The title repeated the pattern label.",
  definition_echo: "The title paraphrased the pattern definition.",
  quote_copy: "The title copied a quote instead of distilling the tension.",
  vague_title: "The title was too vague or cryptic to understand from the evidence.",
  not_grounded: "The title did not stay understandable from the tension in the quotes.",
  summary_voice: "The summary sounded explanatory or like advice.",
};
