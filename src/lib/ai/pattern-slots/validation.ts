import {
  SLOT_MAX_LINE_CHARS,
  SLOT_MAX_LINE_WORDS,
  SLOT_MAX_PASSAGE_AI_WORDS,
  SLOT_MAX_QUESTION_CHARS,
} from "@/lib/ai/pattern-slots/constants";
import type { PriorVoiceSlot, VoiceSlotRequest } from "@/lib/ai/pattern-slots/input";
import type { ParsedSlotFill } from "@/lib/ai/pattern-slots/parse";

const ADVICE_MARKERS =
  /\b(should|try to|you need to|you must|consider|remember to|it's important|i recommend|you could)\b/i;

const THERAPY_MARKERS =
  /\b(healing|mindfulness|self-care|trauma|wellness|journey|growth mindset)\b/i;

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

/** Reject lines that mostly reuse another voice slot (connection ≈ realization). */
const wordOverlapRatio = (a: string, b: string): number => {
  const wordsA = tokens(a);
  const wordsB = new Set(tokens(b));
  if (wordsA.length === 0) return 0;
  return wordsA.filter((w) => wordsB.has(w)).length / wordsA.length;
};

const repeatsVoiceLine = (text: string, others: string[]): boolean => {
  const normalized = text.trim().toLowerCase();
  for (const other of others) {
    const otherNorm = other.trim().toLowerCase();
    if (!otherNorm) continue;
    if (normalized === otherNorm) return true;
    if (wordOverlapRatio(text, other) >= 0.4) return true;
  }
  return false;
};

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
  if (ADVICE_MARKERS.test(text) || THERAPY_MARKERS.test(text)) {
    return "advice_voice";
  }
  return null;
};

const validateLine = (
  text: string,
  allQuotes: string[],
  spec: VoiceSlotRequest,
  definition: string,
  label: string,
  otherVoice: string[],
): string | null => {
  if (
    (spec.role === "connection" || spec.role === "realization" || spec.role === "ending") &&
    repeatsVoiceLine(text, otherVoice)
  ) {
    return "slot_echo";
  }

  if (
    (spec.role === "connection" || spec.role === "realization") &&
    paraphrasesQuotes(text, [...allQuotes, ...spec.precedingQuotes])
  ) {
    return "paraphrase";
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
  const punct = text.match(/[.!?]/g) ?? [];
  if (punct.length > 1) return "multiple_sentences";

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

  if (spec.endingKind === "question") {
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
