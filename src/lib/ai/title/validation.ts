import {
  MAX_TITLE_CHARS,
  MAX_TITLE_WORDS,
} from "@/lib/ai/title/constants";
import { cleanTitleText, parseTitleModelResponse } from "@/lib/ai/title/parse";

/** Obvious self-help / AI vocabulary — hard reject only. */
const HARD_BANNED_SELF_HELP_PHRASES = [
  "moving forward",
  "self-discovery",
  "self discovery",
  "healing",
  "growth",
  "journey",
  "mindful",
  "awareness",
  "embracing",
  "becoming",
] as const;

/**
 * Known generic page-name shapes — theme labels and coping strategies that
 * could belong to many entries. Ordinary words like "still" or "thinking"
 * are only flagged when they form these patterns.
 */
const GENERIC_PAGE_NAME_PATTERNS = [
  /\btrying\s+anyway\b/i,
  /\bjust\s+(busy|trying|thinking|processing|avoiding|keeping|going)\b/i,
  /\bstill\s+(thinking|processing|wondering|figuring|debating)\b/i,
  /\bletting\s+go\b/i,
  /\bmoving\s+on\b/i,
  /\bself[- ]care\b/i,
] as const;

const MEANINGFUL_SINGLE_WORDS = new Set([
  "again", "help", "maybe", "tired", "empty", "lost", "fine", "done",
  "enough", "why", "stuck", "still", "thinking", "anyway",
]);

const GENERIC_SINGLE_WORDS = new Set([
  "burnout", "anxiety", "depression", "thoughts", "reflection", "journal",
  "update", "notes", "entry", "feelings", "emotions", "stress", "work",
  "life", "today", "tomorrow", "yesterday", "week", "month", "processing",
  "navigating", "struggling", "healing", "growth", "journey", "mindful",
  "awareness", "embracing", "becoming",
]);

const SUMMARY_VOCABULARY = new Set([
  "burnout", "exhaustion", "frustration", "uncertainty", "expectations",
  "analysis", "block", "reflection", "mental", "emotional", "career",
  "creative", "conversation", "conversations", "overthinking", "processing",
  "navigating", "struggling", "mindfulness", "selfcare", "self-care",
  "wellness", "trauma", "healing", "journey", "growth", "mindset",
  "perspective", "awareness", "introspection", "mindful", "embracing",
  "becoming",
]);

const PERSONAL_VOICE_MARKERS =
  /\b(i|i'm|i've|i'd|i'll|my|me|mine|we|our|us|can't|won't|don't|didn't|isn't|aren't|wasn't|weren't|shouldn't|couldn't|wouldn't|maybe|again|just|still|wish|need|want|feel|feeling|scared|tired|hard|why|didn't|unsaid|never|almost|before|kept|left|rearranging)\b/i;

export type TitleValidationResult =
  | { ok: true; title: string }
  | { ok: false; reason: string; title: string };

function titleWords(title: string): string[] {
  return title.split(/\s+/).filter(Boolean);
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z'?]/g, "");
}

function usesHardBannedSelfHelpVocabulary(title: string): boolean {
  const normalized = title.toLowerCase();
  return HARD_BANNED_SELF_HELP_PHRASES.some((phrase) =>
    normalized.includes(phrase),
  );
}

function soundsTooGeneric(title: string): boolean {
  return GENERIC_PAGE_NAME_PATTERNS.some((pattern) => pattern.test(title));
}

function isGenericSingleWord(title: string): boolean {
  const words = titleWords(title);
  if (words.length !== 1) return false;
  const word = normalizeWord(words[0]!);
  if (MEANINGFUL_SINGLE_WORDS.has(word)) return false;
  return GENERIC_SINGLE_WORDS.has(word) || SUMMARY_VOCABULARY.has(word);
}

function soundsLikeSummary(title: string): boolean {
  const words = titleWords(title);
  if (words.length === 0) return true;
  if (PERSONAL_VOICE_MARKERS.test(title)) return false;

  const normalized = words.map(normalizeWord);
  const summaryHits = normalized.filter((w) => SUMMARY_VOCABULARY.has(w)).length;

  if (words.length === 1) return SUMMARY_VOCABULARY.has(normalized[0]!);
  if (summaryHits >= 2) return true;
  if (summaryHits === 1 && words.length <= 3) return true;

  if (
    words.length >= 2 &&
    words.length <= 4 &&
    /^[A-Z]/.test(words[0]!) &&
    !title.includes("'") &&
    !title.includes("?")
  ) {
    const last = normalized[normalized.length - 1]!;
    if (
      SUMMARY_VOCABULARY.has(last) ||
      ["block", "expectations", "uncertainty", "frustration", "exhaustion"].includes(last)
    ) {
      return true;
    }
  }

  return false;
}

function hasParsingErrors(raw: string, cleaned: string): boolean {
  if (!cleaned) return true;
  if (raw.includes("\n\n")) return true;
  if (/^[\[\{<]/.test(cleaned)) return true;
  if (/(^|\s)(title|option|choice)\s*[:#]/i.test(raw)) return true;
  if (titleWords(cleaned).length > MAX_TITLE_WORDS + 1) return true;
  return false;
}

function repeatsOpeningSentence(title: string, sourceText: string): boolean {
  const entryWords = sourceText
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12)
    .map(normalizeWord);
  if (entryWords.length < 4) return false;

  const titleNorm = titleWords(title).map(normalizeWord).join(" ");
  const opening = entryWords.slice(0, titleWords(title).length).join(" ");

  if (titleNorm.length >= 8 && opening.startsWith(titleNorm)) return true;

  const openingPhrase = entryWords.slice(0, 6).join(" ");
  return openingPhrase.includes(titleNorm) && titleNorm.length >= 10;
}

/** Validate page-name quality — title feature only. */
export function validateTitle(
  input: string,
  sourceText?: string,
  { fromModelResponse = false }: { fromModelResponse?: boolean } = {},
): TitleValidationResult {
  const sourceRaw = input;
  const cleaned = fromModelResponse
    ? parseTitleModelResponse(input)
    : cleanTitleText(input);

  if (!cleaned) {
    return { ok: false, reason: "empty", title: cleaned };
  }

  if (hasParsingErrors(sourceRaw, cleaned)) {
    return { ok: false, reason: "parsing_error", title: cleaned };
  }

  const words = titleWords(cleaned);

  if (words.length > MAX_TITLE_WORDS) {
    return { ok: false, reason: "too_long", title: cleaned };
  }

  if (cleaned.length > MAX_TITLE_CHARS) {
    return { ok: false, reason: "too_many_characters", title: cleaned };
  }

  if (words.length === 1 && isGenericSingleWord(cleaned)) {
    return { ok: false, reason: "generic_single_word", title: cleaned };
  }

  if (usesHardBannedSelfHelpVocabulary(cleaned)) {
    return { ok: false, reason: "banned_vocabulary", title: cleaned };
  }

  if (soundsTooGeneric(cleaned)) {
    return { ok: false, reason: "generic_page_name", title: cleaned };
  }

  if (soundsLikeSummary(cleaned)) {
    return { ok: false, reason: "summary_voice", title: cleaned };
  }

  if (sourceText && repeatsOpeningSentence(cleaned, sourceText)) {
    return { ok: false, reason: "repeats_opening", title: cleaned };
  }

  return { ok: true, title: cleaned };
}
