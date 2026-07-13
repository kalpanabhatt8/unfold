/**
 * Unfold — apply Claude fills to a materialized passage.
 *
 * Voice slots keep their scaffold (text: null) when a fill is missing so
 * generation can retry. Only filled text replaces null — slots are never
 * dropped here (dropping caused degraded passages to cache as "complete").
 */

import type { ParsedSlotFill } from "@/lib/ai/pattern-slots/parse";
import type { PassageSlot, PatternPassage } from "@/lib/patterns/passage-types";

const SHAPES_REQUIRING_VOICE: Record<
  string,
  { line: boolean; closeAi: boolean }
> = {
  single: { line: true, closeAi: false },
  pair_line: { line: true, closeAi: false },
  // Discovery voice is variable — validate from slots, not a fixed template.
  recognition: { line: true, closeAi: true },
  recognition_q: { line: true, closeAi: true },
  recognition_deep: { line: true, closeAi: true },
};

const isVoiceShape = (shapeId: string): boolean =>
  shapeId === "discovery" ||
  shapeId === "recognition" ||
  shapeId === "recognition_q" ||
  shapeId === "recognition_deep";

/**
 * Function words that carry no insight content. Counting these as overlap
 * made distinct lines look like echoes ("you keep the…" ≈ 40% of a short
 * line), which invalidated cached passages and forced regeneration on
 * every page open.
 */
const VOICE_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "to", "of", "in", "on", "at",
  "for", "with", "from", "by", "as", "is", "are", "was", "were", "be",
  "been", "being", "it", "its", "it's", "this", "that", "these", "those",
  "you", "your", "you're", "i", "we", "they", "them", "their", "my",
  "me", "our", "us", "what", "when", "where", "which", "who", "how",
  "why", "do", "does", "did", "don't", "doesn't", "not", "no", "so",
  "if", "then", "than", "there", "here", "about", "into", "over",
  "under", "again", "still", "just", "same", "each", "every", "keep",
  "keeps", "kept", "one", "more", "before", "after",
]);

const contentTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w']/g, ""))
    .filter((w) => w.length >= 3 && !VOICE_STOPWORDS.has(w));

/**
 * Two AI voice lines saying the same thing. Shared between generation
 * validation and cache reconciliation — the checks MUST agree, otherwise
 * generation stores voice the orchestrator later rejects, and the passage
 * regenerates forever.
 */
export const voiceLinesEcho = (a: string, b: string): boolean => {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const wordsA = contentTokens(a);
  const wordsB = contentTokens(b);
  if (wordsA.length < 2 || wordsB.length < 2) return false;

  const setB = new Set(wordsB);
  const shared = wordsA.filter((w) => setB.has(w)).length;
  return shared / Math.min(wordsA.length, wordsB.length) >= 0.6;
};

/** Any two AI voice lines that say the same thing — a repeated insight. */
export const passageVoiceEchoes = (passage: PatternPassage): boolean => {
  if (!isVoiceShape(passage.shapeId)) return false;

  const voiceTexts: string[] = [];
  for (const slot of passage.slots) {
    if (slot.kind === "line" && slot.text?.trim()) {
      voiceTexts.push(slot.text.trim());
    }
    if (
      slot.kind === "close" &&
      slot.endingKind !== "quote" &&
      slot.text?.trim()
    ) {
      voiceTexts.push(slot.text.trim());
    }
  }
  if (voiceTexts.length < 2) return false;

  for (let i = 0; i < voiceTexts.length; i += 1) {
    for (let j = i + 1; j < voiceTexts.length; j += 1) {
      if (voiceLinesEcho(voiceTexts[i], voiceTexts[j])) return true;
    }
  }
  return false;
};

export const passageStructureValid = (passage: PatternPassage): boolean => {
  if (passage.shapeId === "discovery") {
    // Moments are required; closing form is variable (silence/drift/phrase/
    // mechanism/none) and may omit AI voice entirely.
    return passage.slots.some((s) => s.kind === "moments");
  }

  const required = SHAPES_REQUIRING_VOICE[passage.shapeId];
  if (!required) return true;

  const kinds = passage.slots.map((s) => s.kind);
  if (required.line && !kinds.includes("line")) return false;
  if (
    required.closeAi &&
    !passage.slots.some(
      (s) =>
        s.kind === "close" &&
        (s.endingKind === "line" || s.endingKind === "question"),
    )
  ) {
    return false;
  }

  return true;
};

export const applySlotFills = (
  passage: PatternPassage,
  fills: ParsedSlotFill[],
): PatternPassage => {
  const fillMap = new Map(fills.map((f) => [f.index, f]));

  const slots: PassageSlot[] = [];

  passage.slots.forEach((slot, index) => {
    if (slot.kind === "line") {
      const fill = fillMap.get(index);
      const text = fill?.text ?? slot.text;
      const steps =
        fill?.steps ??
        (fill === undefined ? slot.steps ?? null : null);
      slots.push({
        kind: "line",
        text: text ?? null,
        steps: text ? steps ?? null : null,
      });
      return;
    }

    if (slot.kind === "close") {
      if (slot.endingKind === "quote") {
        slots.push(slot);
        return;
      }
      const fill = fillMap.get(index);
      const text = fill?.text ?? slot.text;
      slots.push({
        kind: "close",
        endingKind: slot.endingKind,
        text: text ?? null,
        quote: null,
      });
      return;
    }

    slots.push(slot);
  });

  return { ...passage, slots };
};

/** Collapsed preview — always prefer the user's words over AI voice. */
export const passagePreviewText = (passage: PatternPassage): string | null => {
  for (const slot of passage.slots) {
    if (slot.kind === "moments" && slot.quotes[0])
      return `“${slot.quotes[0].text}”`;
    if (slot.kind === "pair" && slot.quotes[0])
      return `“${slot.quotes[0].text}”`;
    if (slot.kind === "echo") return `“${slot.phrase}”`;
  }

  for (const slot of passage.slots) {
    if (slot.kind === "close" && slot.endingKind === "quote" && slot.quote)
      return `“${slot.quote.text}”`;
    if (slot.kind === "line" && slot.text) return slot.text;
  }

  return null;
};

export const passageIsLoading = (passage: PatternPassage): boolean =>
  passage.slots.some(
    (slot) =>
      (slot.kind === "line" && slot.text === null) ||
      (slot.kind === "close" &&
        slot.endingKind !== "quote" &&
        slot.text === null),
  );

/** Rough ratio of quote characters to AI characters — for quality review. */
export const passageEvidenceRatio = (passage: PatternPassage): number => {
  let evidence = 0;
  let voice = 0;
  for (const slot of passage.slots) {
    if (slot.kind === "moments")
      evidence += slot.quotes.reduce((n, q) => n + q.text.length, 0);
    if (slot.kind === "pair")
      evidence += slot.quotes.reduce((n, q) => n + q.text.length, 0);
    if (slot.kind === "echo") {
      evidence += slot.quotes.reduce((n, q) => n + q.text.length, 0);
      evidence += slot.phrase.length;
    }
    if (slot.kind === "line" && slot.text) voice += slot.text.length;
    if (slot.kind === "close") {
      if (slot.quote) evidence += slot.quote.text.length;
      else if (slot.text) voice += slot.text.length;
    }
  }
  if (voice === 0) return Infinity;
  return evidence / voice;
};
