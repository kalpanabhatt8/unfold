import {
  SLOT_MAX_LINE_CHARS,
  SLOT_MAX_LINE_WORDS,
  SLOT_MAX_MECHANISM_CHARS,
  SLOT_MAX_MECHANISM_SENTENCES,
  SLOT_MAX_MECHANISM_WORDS,
  SLOT_MAX_PASSAGE_AI_WORDS,
  SLOT_MAX_QUESTION_CHARS,
  SLOT_MIN_MECHANISM_SENTENCES,
} from "@/lib/ai/pattern-slots/constants";
import type { PriorVoiceSlot, VoiceSlotRequest } from "@/lib/ai/pattern-slots/input";
import type { LoopStepFill, ParsedSlotFill } from "@/lib/ai/pattern-slots/parse";
import { splitMechanismSteps } from "@/lib/patterns/mechanism-steps";
import { voiceLinesEcho } from "@/lib/patterns/passage-fill";

const ADVICE_MARKERS =
  /\b(should|try to|you need to|you must|consider|remember to|it's important|i recommend|you could)\b/i;

const THERAPY_MARKERS =
  /\b(healing|mindfulness|self-care|trauma|wellness|journey|growth mindset)\b/i;

const TEMPLATE_MARKERS =
  /\b(this shows that you|this suggests that you|this means you|in other words)\b/i;

const INSIGHT_MARKERS =
  /\b(this pattern|recurring pattern|what this means|what this shows)\b/i;

const GROUNDING_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "to", "of", "in", "on", "at",
  "for", "with", "from", "by", "as", "is", "are", "was", "were", "be",
  "been", "being", "it", "its", "this", "that", "these", "those",
  "you", "your", "i", "we", "they", "them", "their", "my", "me",
  "our", "us", "what", "when", "where", "which", "who", "how", "why",
  "do", "does", "did", "not", "no", "so", "if", "then", "than",
  "there", "here", "about", "into", "over", "again", "still", "just",
  "same", "each", "every", "one", "more", "before", "after",
  "led", "became", "felt", "something", "else", "another",
]);

export type SlotRejection = { index: number; text: string; reason: string };

export type SlotValidationResult = {
  ok: boolean;
  reason: string;
  fills: ParsedSlotFill[];
  rejected: SlotRejection[];
};

const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

const totalAiWords = (fills: ParsedSlotFill[]): number =>
  fills.reduce((sum, f) => sum + wordCount(f.text), 0);

const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w']/g, ""))
    .filter((w) => w.length >= 2);

const contentTokens = (text: string): string[] =>
  tokens(text).filter((w) => w.length >= 3 && !GROUNDING_STOPWORDS.has(w));

const isGrounded = (text: string, quotes: string[]): boolean => {
  const words = tokens(text);
  if (words.length === 0) return true;
  const corpus = tokens(quotes.join(" "));
  if (corpus.length === 0) return true;
  return words.some((w) =>
    corpus.some(
      (c) =>
        c === w ||
        c.includes(w) ||
        w.includes(c) ||
        (w.length >= 4 && c.length >= 4 && c.slice(0, 4) === w.slice(0, 4)),
    ),
  );
};

const echoesDefinition = (text: string, definition: string): boolean => {
  const defWords = definition
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, ""))
    .filter((w) => w.length > 6);
  const lower = text.toLowerCase();
  return defWords.filter((w) => lower.includes(w)).length >= 3;
};

const echoesLabel = (text: string, label: string): boolean => {
  const phrase = label.toLowerCase().replace(/-/g, " ").trim();
  if (phrase.length < 5) return false;
  return text.toLowerCase().includes(phrase);
};

const repeatsVoiceLine = (text: string, others: string[]): boolean =>
  others.some((other) => voiceLinesEcho(text, other));

/** True when text mostly restates a single quote (redundancy / paraphrase). */
export const paraphrasesSingleQuote = (
  text: string,
  quotes: string[],
): boolean => {
  const lineWords = contentTokens(text);
  if (lineWords.length < 2) return false;

  for (const quote of quotes) {
    const quoteWords = contentTokens(quote);
    if (quoteWords.length < 2) continue;
    const quoteSet = new Set(quoteWords);
    const overlap = lineWords.filter((w) => quoteSet.has(w)).length;
    if (overlap / lineWords.length >= 0.5) return true;
    if (overlap / Math.min(lineWords.length, quoteWords.length) >= 0.65) {
      return true;
    }
  }
  return false;
};

/** Non-mechanism slots: reject heavy quote reuse. */
const paraphrasesQuotes = (text: string, quotes: string[]): boolean =>
  paraphrasesSingleQuote(text, quotes);

const validateQuestion = (text: string): string | null => {
  if (!text.endsWith("?")) return "not_question";
  if (text.length > SLOT_MAX_QUESTION_CHARS) return "too_long";
  if (ADVICE_MARKERS.test(text) || THERAPY_MARKERS.test(text)) {
    return "advice_voice";
  }
  return null;
};

const INTERPRETIVE_MARKERS =
  /\b(avoidance|permission|fear|anxiety|because you|trying to|means you|shows you|became the)\b/i;

const MECHANISM_SUMMARY_MARKERS =
  /^\s*\w+ing(?:,\s*\w+ing){1,}/i;

const MECHANISM_WHILE_SUMMARY =
  /\bwhile\b.{0,40}\b(remained|stayed|untouched|waiting|in place)\b/i;

/**
 * Phrasing that steps outside the loop to summarize / judge the outcome.
 * Final Loop lines must stay inside the ongoing experience instead.
 */
const MECHANISM_VERDICT_ENDING =
  /\b(?:never (?:opened|moved|started|sent|finished|happened|changed|begun|began|got|did)|nothing (?:(?:had|really|ever) )?changed|nothing (?:happened|moved|came of it)|still waiting|remained (?:untouched|unopened|waiting|the same)|stayed (?:untouched|unopened|the same)|same as (?:before|ever)|back where|and that was it|by the end\b|in the end\b|at the end\b|overall\b|in total\b|looking back\b)\b/i;

/** Day-closing / retrospective framing — narrates what happened, not lived-in. */
const MECHANISM_VERDICT_TEMPORAL =
  /^(?:by (?:evening|morning|afternoon|night|then|now)|in the end|by the end|at the end|that (?:evening|night|morning|afternoon)|later that (?:day|night|evening)|at the end of (?:the )?day)\b/i;

const sentenceCount = (text: string): number =>
  (text.match(/[.!?]/g) ?? []).length;

const soundsLikeSummary = (text: string): boolean =>
  MECHANISM_SUMMARY_MARKERS.test(text) || MECHANISM_WHILE_SUMMARY.test(text);

const lastSentence = (text: string): string => {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.at(-1) ?? text.trim();
};

export const soundsLikeVerdictEnding = (text: string): boolean => {
  const last = lastSentence(text);
  if (!last) return false;
  if (MECHANISM_VERDICT_TEMPORAL.test(last)) return true;
  if (MECHANISM_VERDICT_ENDING.test(last)) return true;
  // Short "X never Y." outcome assessments ("The portfolio never moved.")
  if (
    wordCount(last) <= 12 &&
    /\bnever\b.{0,40}\b(?:moved|opened|started|sent|finished|happened|changed|begun|began|got|did)\b/i.test(
      last,
    )
  ) {
    return true;
  }
  // Past-perfect outcome summary ("Nothing had changed.")
  if (/\bhad (?:not |n't )?(?:changed|moved|happened|begun|opened|started)\b/i.test(last)) {
    return true;
  }
  return false;
};

/** Quote indexes must advance chronologically (non-decreasing peaks). */
export const loopStepsInChronologicalOrder = (
  steps: LoopStepFill[],
): boolean => {
  let lastPeak = 0;
  for (const step of steps) {
    if (step.quoteIndexes.length === 0) continue;
    const peak = Math.max(...step.quoteIndexes);
    if (peak < lastPeak) return false;
    lastPeak = peak;
  }
  return true;
};

const resolveStepQuotes = (
  step: LoopStepFill,
  allQuotes: string[],
): string[] => {
  if (step.quoteIndexes.length === 0) return allQuotes;
  return step.quoteIndexes
    .map((i) => allQuotes[i - 1])
    .filter((q): q is string => Boolean(q));
};

/**
 * Validate a Loop fill: redundancy, verdict, order, and light grounding.
 */
const validateMechanism = (
  fill: ParsedSlotFill,
  allQuotes: string[],
): string | null => {
  const text = fill.text;
  if (text.endsWith("?")) return "not_statement";
  if (/^you\b/i.test(text)) return "you_opener";
  if (INTERPRETIVE_MARKERS.test(text)) return "interpretive_voice";
  if (soundsLikeSummary(text)) return "summary_voice";
  if (soundsLikeVerdictEnding(text)) return "verdict_ending";

  const steps: LoopStepFill[] =
    fill.steps && fill.steps.length > 0
      ? fill.steps
      : splitMechanismSteps(text).map((s) => ({
          text: s,
          quoteIndexes: [],
        }));

  if (!fill.steps || fill.steps.length === 0) return "missing_steps";
  if (steps.length < SLOT_MIN_MECHANISM_SENTENCES) return "too_few_sentences";
  if (steps.length > SLOT_MAX_MECHANISM_SENTENCES) return "too_many_sentences";
  if (text.length > SLOT_MAX_MECHANISM_CHARS) return "too_long";
  if (wordCount(text) > SLOT_MAX_MECHANISM_WORDS) return "too_many_words";

  if (!loopStepsInChronologicalOrder(steps)) return "order_violation";

  for (const step of steps) {
    const support = resolveStepQuotes(step, allQuotes);
    // a) Redundancy — reject lines that merely paraphrase one supporting quote.
    if (paraphrasesSingleQuote(step.text, support)) return "paraphrase";

    // Light grounding — inventing wholesale fails; transitions may be sparse.
    if (contentTokens(step.text).length >= 3 && !isGrounded(step.text, support)) {
      return "not_grounded";
    }
  }

  // b) Verdict — final line must not summarize / judge the outcome.
  if (soundsLikeVerdictEnding(steps[steps.length - 1]?.text ?? text)) {
    return "verdict_ending";
  }

  return null;
};

const validateLine = (
  fill: ParsedSlotFill,
  allQuotes: string[],
  spec: VoiceSlotRequest,
  definition: string,
  label: string,
  otherVoice: string[],
): string | null => {
  const text = fill.text;
  if (repeatsVoiceLine(text, otherVoice)) return "slot_echo";

  const evidenceQuotes = [...allQuotes, ...spec.precedingQuotes];

  if (spec.role === "mechanism") {
    return validateMechanism(fill, evidenceQuotes);
  }

  if (paraphrasesQuotes(text, evidenceQuotes)) return "paraphrase";

  if (TEMPLATE_MARKERS.test(text)) return "template_voice";
  if (INSIGHT_MARKERS.test(text)) return "insight_voice";
  if (ADVICE_MARKERS.test(text) || THERAPY_MARKERS.test(text)) {
    return "advice_voice";
  }
  if (echoesDefinition(text, definition)) return "definition_echo";
  if (echoesLabel(text, label)) return "label_echo";

  if (!isGrounded(text, evidenceQuotes)) return "not_grounded";

  if (text.includes(";")) return "multiple_sentences";
  if (sentenceCount(text) > 1) return "multiple_sentences";

  if (/\b(and|but)\b/i.test(text) && wordCount(text) > 9) {
    return "clause_join";
  }

  if (text.length > SLOT_MAX_LINE_CHARS) return "too_long";
  if (wordCount(text) > SLOT_MAX_LINE_WORDS) return "too_many_words";

  return null;
};

const validateOne = (
  fill: ParsedSlotFill,
  spec: VoiceSlotRequest,
  allQuotes: string[],
  definition: string,
  label: string,
  otherVoice: string[],
): string | null => {
  const { text } = fill;
  if (!text) return "empty";

  if (spec.endingKind === "question" || spec.role === "reflection") {
    const q = validateQuestion(text);
    if (q) return q;
    if (repeatsVoiceLine(text, otherVoice)) return "slot_echo";
    return null;
  }

  return validateLine(fill, allQuotes, spec, definition, label, otherVoice);
};

/**
 * Validate each fill against its slot spec. Drops invalid individual fills
 * rather than failing the whole batch when possible.
 */
export function validateSlotFills(
  fills: ParsedSlotFill[],
  voiceSlots: VoiceSlotRequest[],
  allQuotes: string[],
  definition: string,
  label: string,
  priorVoice: PriorVoiceSlot[] = [],
): SlotValidationResult {
  const specByIndex = new Map(voiceSlots.map((s) => [s.index, s]));
  const valid: ParsedSlotFill[] = [];
  const rejected: SlotRejection[] = [];
  let firstReason = "empty";
  const priorTexts = priorVoice.map((p) => p.text);

  for (const fill of fills) {
    const spec = specByIndex.get(fill.index);
    if (!spec) {
      rejected.push({ index: fill.index, text: fill.text, reason: "unknown_index" });
      continue;
    }

    const otherVoice = [...priorTexts, ...valid.map((v) => v.text)];
    const reason = validateOne(
      fill,
      spec,
      allQuotes,
      definition,
      label,
      otherVoice,
    );
    if (reason) {
      rejected.push({ index: fill.index, text: fill.text, reason });
      if (firstReason === "empty") firstReason = reason;
      continue;
    }
    valid.push(fill);
  }

  if (valid.length === 0) {
    return { ok: false, reason: firstReason, fills: [], rejected };
  }

  if (totalAiWords(valid) > SLOT_MAX_PASSAGE_AI_WORDS) {
    const trimmed: ParsedSlotFill[] = [];
    let words = 0;
    for (const fill of valid) {
      const w = wordCount(fill.text);
      if (words + w > SLOT_MAX_PASSAGE_AI_WORDS) break;
      trimmed.push(fill);
      words += w;
    }
    if (trimmed.length === 0) {
      return {
        ok: false,
        reason: "too_many_ai_words",
        fills: [],
        rejected,
      };
    }
    return { ok: true, reason: "", fills: trimmed, rejected };
  }

  return { ok: true, reason: "", fills: valid, rejected };
}
