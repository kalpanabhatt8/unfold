import {
  DISPLAY_SUMMARY_MAX_CHARS,
  DISPLAY_TITLE_MAX_CHARS,
  DISPLAY_TITLE_WORDS_MAX,
  DISPLAY_TITLE_WORDS_MIN,
} from "@/lib/ai/pattern-display/constants";
import type { ParsedDisplay } from "@/lib/ai/pattern-display/parse";

const ADVICE_MARKERS =
  /\b(should|try to|you need to|you must|consider|remember to|it's important|i recommend|you could|need to work on)\b/i;

const THERAPY_MARKERS =
  /\b(healing|mindfulness|self-care|trauma|wellness|journey|growth mindset|inner child|attachment|boundaries)\b/i;

const CONTRAST_MARKERS = /\binstead of\b|\brather than\b/i;

const PSYCHOLOGY_LABEL_MARKERS =
  /\b(avoidance|perfectionism|procrastinat|overthink|catastrophiz|people[- ]pleas|self[- ]doubt|self[- ]critic|all[- ]or[- ]nothing|fear of judgment|impostor|self-sabotag)\b/i;

const BEHAVIOR_SUMMARY_MARKERS =
  /\b(fixing small things|tweaking details|waiting until it feels|searching for the perfect|one more pass on|rewriting the|cleaning before|pros.and.cons|preparing instead)\b/i;

const BEHAVIOR_DESCRIPTION =
  /^(fixing|tweaking|rewriting|cleaning|waiting for|searching for|preparing to|checking the|editing the|polishing the|adjusting the|redoing the|putting off|delaying the|postponing the|making another|starting to)\b/i;

const TENSION_SIGNALS =
  /\b(why|what|how|still|not|never|until|almost|left|waiting|waited|stopped|didn't|won't|yet|again|here|tomorrow|easier|end|ended|moved|done|changed|last|important|unfinished)\b/i;

const BANNED_SELF_HELP = [
  "moving forward",
  "self-discovery",
  "healing",
  "growth",
  "journey",
  "mindful",
  "awareness",
  "embracing",
  "becoming",
] as const;

export type DisplayValidationResult =
  | { ok: true; display: ParsedDisplay }
  | { ok: false; reason: string; display: ParsedDisplay | null };

const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w']/g, ""))
    .filter((w) => w.length >= 2);

const usesBannedSelfHelp = (text: string): boolean => {
  const lower = text.toLowerCase();
  return BANNED_SELF_HELP.some((phrase) => lower.includes(phrase));
};

const echoesLabel = (text: string, label: string): boolean => {
  const phrase = label.toLowerCase().replace(/-/g, " ").trim();
  if (phrase.length < 4) return false;
  return text.toLowerCase().includes(phrase);
};

const echoesDefinition = (text: string, definition: string): boolean => {
  const defWords = definition
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, ""))
    .filter((w) => w.length > 6);
  const lower = text.toLowerCase();
  return defWords.filter((w) => lower.includes(w)).length >= 2;
};

const isGrounded = (text: string, quotes: string[]): boolean => {
  if (TENSION_SIGNALS.test(text)) return true;

  const words = tokens(text);
  if (words.length === 0) return false;
  const corpus = tokens(quotes.join(" "));
  if (corpus.length === 0) return true;
  return words.some((w) =>
    corpus.some(
      (c) =>
        c === w ||
        (w.length >= 4 && c.length >= 4 && c.slice(0, 4) === w.slice(0, 4)),
    ),
  );
};

/** Reject titles that are mostly a copied quote snippet. */
const copiesQuote = (title: string, quotes: string[]): boolean => {
  const titleNorm = title.toLowerCase().replace(/[^\w\s]/g, "").trim();
  if (titleNorm.length < 8) return false;

  for (const quote of quotes) {
    const quoteNorm = quote.toLowerCase().replace(/[^\w\s]/g, "").trim();
    if (quoteNorm.includes(titleNorm) || titleNorm.includes(quoteNorm)) {
      if (titleNorm.length / quoteNorm.length > 0.55) return true;
    }
    const titleWords = tokens(title);
    const quoteWords = new Set(tokens(quote));
    if (titleWords.length >= 3) {
      const overlap = titleWords.filter((w) => quoteWords.has(w)).length;
      if (overlap / titleWords.length >= 0.7) return true;
    }
  }
  return false;
};

const isVagueTitle = (title: string): boolean => {
  const words = wordCount(title);
  if (words < DISPLAY_TITLE_WORDS_MIN) return true;
  if (words === 1 && title.length < 8) return true;
  if (/^(every|always|sometimes|again|still|just|maybe)\.?$/i.test(title.trim())) {
    return true;
  }
  return false;
};

const validateTitle = (
  title: string,
  quotes: string[],
  label: string,
  definition: string,
): string | null => {
  if (!title.trim()) return "empty";

  const words = wordCount(title);
  if (words < DISPLAY_TITLE_WORDS_MIN) return "too_short";
  if (words > DISPLAY_TITLE_WORDS_MAX) return "too_many_words";
  if (title.length > DISPLAY_TITLE_MAX_CHARS) return "too_long";

  if (/^you\b/i.test(title) || /^your\b/i.test(title)) return "you_voice";
  if (CONTRAST_MARKERS.test(title)) return "contrast_voice";
  if (BEHAVIOR_DESCRIPTION.test(title.trim())) return "behavior_voice";
  if (BEHAVIOR_SUMMARY_MARKERS.test(title)) return "behavior_voice";
  if (PSYCHOLOGY_LABEL_MARKERS.test(title)) return "label_voice";
  if (
    ADVICE_MARKERS.test(title) ||
    THERAPY_MARKERS.test(title) ||
    usesBannedSelfHelp(title)
  ) {
    return "banned_voice";
  }
  if (echoesLabel(title, label)) return "label_echo";
  if (echoesDefinition(title, definition)) return "definition_echo";
  if (isVagueTitle(title)) return "vague_title";
  if (copiesQuote(title, quotes)) return "quote_copy";
  if (!isGrounded(title, quotes)) return "not_grounded";

  return null;
};

const validateSummary = (summary: string | null): string | null => {
  if (!summary) return null;
  if (summary.length > DISPLAY_SUMMARY_MAX_CHARS) return "too_long";
  if (/^you\b/i.test(summary) || /^your\b/i.test(summary)) return "summary_voice";
  if (
    ADVICE_MARKERS.test(summary) ||
    THERAPY_MARKERS.test(summary) ||
    CONTRAST_MARKERS.test(summary) ||
    usesBannedSelfHelp(summary)
  ) {
    return "summary_voice";
  }
  return null;
};

export function validateDisplay(
  parsed: ParsedDisplay | null,
  quotes: string[],
  label: string,
  definition: string,
): DisplayValidationResult {
  if (!parsed) {
    return { ok: false, reason: "parsing_error", display: null };
  }

  const titleReason = validateTitle(
    parsed.displayTitle,
    quotes,
    label,
    definition,
  );
  if (titleReason) {
    return { ok: false, reason: titleReason, display: parsed };
  }

  const summaryReason = validateSummary(parsed.summary);
  if (summaryReason) {
    return {
      ok: true,
      display: { displayTitle: parsed.displayTitle, summary: null },
    };
  }

  return { ok: true, display: parsed };
}
