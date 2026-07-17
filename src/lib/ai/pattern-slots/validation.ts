import { hasCitationBrackets } from "@/lib/ai/pattern-slots/citations";
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
import type { ParsedSlotFill } from "@/lib/ai/pattern-slots/parse";
import { voiceLinesEcho } from "@/lib/patterns/passage-fill";

const ADVICE_MARKERS =
  /\b(should|try to|you need to|you must|consider|remember to|it's important|i recommend|you could)\b/i;

const THERAPY_MARKERS =
  /\b(healing|mindfulness|self-care|trauma|wellness|journey|growth mindset)\b/i;

/** Coaching / corrective framing — implies the user should change something. */
const CORRECTIVE_MARKERS =
  /\b(stays unexamined|unexamined|before dismissing|notice the shift|leave it unopened|what would it feel like to|what would it look like to|what if you|worst version|once the first doubt)\b/i;

const TEMPLATE_MARKERS =
  /\b(this shows that you|this suggests that you|this means you|in other words)\b/i;

const INSIGHT_MARKERS =
  /\b(this pattern|recurring pattern|what this means|what this shows)\b/i;

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

/**
 * Reject lines that mostly reuse another voice slot (connection ≈
 * realization). Uses the SAME predicate as the cache reconciler
 * (passageVoiceEchoes) — if they disagree, accepted voice gets invalidated
 * on the next open and the passage regenerates forever.
 */
const repeatsVoiceLine = (text: string, others: string[]): boolean =>
  others.some((other) => voiceLinesEcho(text, other));

/** Reject lines that mostly reuse quote wording (paraphrase). */
const paraphrasesQuotes = (text: string, quotes: string[]): boolean => {
  const lineWords = tokens(text);
  if (lineWords.length < 3) return false;

  for (const quote of quotes) {
    const quoteWords = new Set(tokens(quote));
    if (quoteWords.size === 0) continue;
    const overlap = lineWords.filter((w) => quoteWords.has(w)).length;
    if (overlap / lineWords.length >= 0.5) return true;
  }
  return false;
};

const validateQuestion = (text: string): string | null => {
  if (!text.endsWith("?")) return "not_question";
  if (text.length > SLOT_MAX_QUESTION_CHARS) return "too_long";
  if (hasCitationBrackets(text)) return "citation_leak";
  if (CORRECTIVE_MARKERS.test(text)) return "corrective_voice";
  if (ADVICE_MARKERS.test(text) || THERAPY_MARKERS.test(text)) {
    return "advice_voice";
  }
  return null;
};

const INTERPRETIVE_MARKERS =
  /\b(avoidance|permission|fear|anxiety|because you|trying to|means you|shows you|became the)\b/i;

/** Comma-separated activity lists — summary, not a chain of events. */
const MECHANISM_SUMMARY_MARKERS =
  /^\s*\w+ing(?:,\s*\w+ing){1,}/i;

/** "X filled the day while Y remained" — behavior summary, not sequence. */
const MECHANISM_WHILE_SUMMARY =
  /\bwhile\b.{0,40}\b(remained|stayed|untouched|waiting|in place)\b/i;

const sentenceCount = (text: string): number =>
  (text.match(/[.!?]/g) ?? []).length;

const soundsLikeSummary = (text: string): boolean =>
  MECHANISM_SUMMARY_MARKERS.test(text) || MECHANISM_WHILE_SUMMARY.test(text);

const validateLine = (
  text: string,
  allQuotes: string[],
  spec: VoiceSlotRequest,
  definition: string,
  label: string,
  otherVoice: string[],
): string | null => {
  if (repeatsVoiceLine(text, otherVoice)) return "slot_echo";

  if (spec.role === "mechanism" && paraphrasesQuotes(text, [...allQuotes, ...spec.precedingQuotes])) {
    return "paraphrase";
  }

  if (hasCitationBrackets(text)) return "citation_leak";
  if (CORRECTIVE_MARKERS.test(text)) return "corrective_voice";

  if (spec.role === "mechanism") {
    if (text.endsWith("?")) return "not_statement";
    if (/^you\b/i.test(text)) return "you_opener";
    if (INTERPRETIVE_MARKERS.test(text)) return "interpretive_voice";
    if (soundsLikeSummary(text)) return "summary_voice";
  }

  if (TEMPLATE_MARKERS.test(text)) return "template_voice";
  if (INSIGHT_MARKERS.test(text)) return "insight_voice";
  if (ADVICE_MARKERS.test(text) || THERAPY_MARKERS.test(text)) {
    return "advice_voice";
  }
  if (echoesDefinition(text, definition)) return "definition_echo";
  if (echoesLabel(text, label)) return "label_echo";

  if (!isGrounded(text, [...allQuotes, ...spec.precedingQuotes])) {
    return "not_grounded";
  }

  if (text.includes(";")) return "multiple_sentences";
  const punctCount = sentenceCount(text);

  if (spec.role === "mechanism") {
    // Mechanism replays an event chain: 2–4 sentences, each adding a step.
    if (punctCount < SLOT_MIN_MECHANISM_SENTENCES) return "too_few_sentences";
    if (punctCount > SLOT_MAX_MECHANISM_SENTENCES) return "too_many_sentences";
    if (text.length > SLOT_MAX_MECHANISM_CHARS) return "too_long";
    if (wordCount(text) > SLOT_MAX_MECHANISM_WORDS) return "too_many_words";
    return null;
  }

  if (punctCount > 1) return "multiple_sentences";

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

  return validateLine(text, allQuotes, spec, definition, label, otherVoice);
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
