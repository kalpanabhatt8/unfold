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
  recognition: { line: true, closeAi: true },
  recognition_q: { line: true, closeAi: true },
  recognition_deep: { line: true, closeAi: true },
};

const isRecognitionShape = (shapeId: string): boolean =>
  shapeId === "recognition" ||
  shapeId === "recognition_q" ||
  shapeId === "recognition_deep";

/** Any two AI voice lines that say the same thing — a repeated insight. */
export const passageVoiceEchoes = (passage: PatternPassage): boolean => {
  if (!isRecognitionShape(passage.shapeId)) return false;

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

  const tokens = (text: string): string[] =>
    text
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^\w']/g, ""))
      .filter((w) => w.length >= 2);

  const overlap = (a: string, b: string): number => {
    const wordsA = tokens(a);
    const setB = new Set(tokens(b));
    if (wordsA.length === 0) return 0;
    return wordsA.filter((w) => setB.has(w)).length / wordsA.length;
  };

  for (let i = 0; i < voiceTexts.length; i += 1) {
    for (let j = i + 1; j < voiceTexts.length; j += 1) {
      const a = voiceTexts[i];
      const b = voiceTexts[j];
      if (a.toLowerCase() === b.toLowerCase()) return true;
      if (overlap(a, b) >= 0.4 || overlap(b, a) >= 0.4) return true;
    }
  }
  return false;
};

export const passageStructureValid = (passage: PatternPassage): boolean => {
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
  const fillMap = new Map(fills.map((f) => [f.index, f.text]));

  const slots: PassageSlot[] = [];

  passage.slots.forEach((slot, index) => {
    if (slot.kind === "line") {
      const text = fillMap.get(index) ?? slot.text;
      slots.push({ kind: "line", text: text ?? null });
      return;
    }

    if (slot.kind === "close") {
      if (slot.endingKind === "quote") {
        slots.push(slot);
        return;
      }
      const text = fillMap.get(index) ?? slot.text;
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
