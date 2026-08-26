import { SLOT_MAX_QUESTION_CHARS } from "@/lib/ai/pattern-slots/constants";
import type { SlotGenerationInput } from "@/lib/ai/pattern-slots/input";
import type { ParsedSlotFill } from "@/lib/ai/pattern-slots/parse";
import {
  isCompleteQuestionText,
  normalizeQuestionText,
} from "@/lib/ai/pattern-slots/validation";

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w']/g, ""))
    .filter((w) => w.length >= 2);

const STOPWORDS = new Set([
  "about", "after", "again", "being", "could", "does", "doing", "from",
  "have", "into", "just", "like", "more", "most", "much", "only", "other",
  "over", "same", "should", "show", "shows", "some", "that", "their", "then",
  "there", "these", "they", "this", "those", "through", "very", "what",
  "when", "where", "which", "while", "with", "would", "your", "youre",
]);

const isGrounded = (question: string, quotes: string[]): boolean => {
  const corpus = new Set(
    tokenize(quotes.join(" ")).filter(
      (w) => w.length >= 4 && !STOPWORDS.has(w),
    ),
  );
  if (corpus.size === 0) return true;
  return tokenize(question).some(
    (w) => w.length >= 4 && !STOPWORDS.has(w) && corpus.has(w),
  );
};

const isAcceptableFallback = (question: string, quotes: string[]): boolean => {
  const q = normalizeQuestionText(question);
  return (
    q.endsWith("?") &&
    q.length <= SLOT_MAX_QUESTION_CHARS &&
    isCompleteQuestionText(q) &&
    isGrounded(q, quotes)
  );
};

const phraseAnchors = (quotes: string[]): string[] => {
  const phrases: string[] = [];
  for (const quote of quotes) {
    const clipped = quote.replace(/[.?!]+$/g, "").trim();
    const words = clipped.split(/\s+/).filter(Boolean);
    const start = /^(i|i'm|im)$/i.test(words[0] ?? "") ? 1 : 0;
    const slice = words.slice(start, start + 6);
    if (slice.length >= 3) {
      phrases.push(slice.join(" ").toLowerCase());
    }
  }
  return phrases;
};

/**
 * Last-resort reflection question when Claude + validation retries leave the
 * close slot empty. Skips slot-echo checks — a short grounded investigative
 * question is better than an indefinitely hidden pattern.
 */
export function buildFallbackReflectionFills(
  input: SlotGenerationInput,
): ParsedSlotFill[] {
  const pending = input.voiceSlots.filter(
    (slot) => slot.role === "reflection" && slot.endingKind === "question",
  );
  if (pending.length === 0) return [];

  const tokenAnchors = [
    ...new Set(
      tokenize(input.quotes.join(" ")).filter(
        (w) => w.length >= 4 && !STOPWORDS.has(w),
      ),
    ),
  ];
  const anchors = [...phraseAnchors(input.quotes), ...tokenAnchors];
  if (anchors.length === 0) return [];

  const templates = (anchor: string): string[] => [
    `You mentioned ${anchor}. What were you trying to figure out?`,
    `You mentioned ${anchor}. What do you usually find yourself doing?`,
    `You wrote about ${anchor}. What were you trying to figure out?`,
  ];

  for (const slot of pending) {
    for (const anchor of anchors.slice(0, 8)) {
      for (const question of templates(anchor)) {
        const text = normalizeQuestionText(question);
        if (!isAcceptableFallback(text, input.quotes)) continue;
        return [{ index: slot.index, text }];
      }
    }
  }

  return [];
}
