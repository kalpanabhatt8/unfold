import {
  SLOT_MAX_QUOTE_CHARS,
  SLOT_MAX_QUOTES,
} from "@/lib/ai/pattern-slots/constants";
import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import type { PatternPassage, PassageSlot } from "@/lib/patterns/passage-types";

export type VoiceSlotRole = "mechanism" | "reflection";

export type VoiceSlotRequest = {
  index: number;
  kind: "line" | "close";
  endingKind: "line" | "question";
  role: VoiceSlotRole;
  /** Quotes from evidence slots that precede this voice slot. */
  precedingQuotes: string[];
};

export type PriorVoiceSlot = {
  index: number;
  role: VoiceSlotRole;
  text: string;
};

export type SlotGenerationInput = {
  patternName: string;
  label: string;
  definition: string;
  /** Chronological evidence quotes (index 1 in the prompt = quotes[0]). */
  quotes: string[];
  voiceSlots: VoiceSlotRequest[];
  shapeId: string;
  priorVoice: PriorVoiceSlot[];
};

const quoteRefsFromSlot = (slot: PassageSlot): QuoteRef[] => {
  switch (slot.kind) {
    case "moments":
      return slot.quotes;
    case "pair":
      return [...slot.quotes];
    case "echo":
      return slot.quotes;
    default:
      return [];
  }
};

const quoteTextsFromSlot = (slot: PassageSlot): string[] =>
  quoteRefsFromSlot(slot).map((q) => q.text);

/**
 * Chronological unique QuoteRefs for Loop generation / evidence display.
 * Order matches prompt indexes (1-based): quotes[0] is index 1.
 */
export const chronologicalQuoteRefs = (
  slotsOrPassage: PassageSlot[] | PatternPassage,
): QuoteRef[] => {
  const slots = Array.isArray(slotsOrPassage)
    ? slotsOrPassage
    : slotsOrPassage.slots;

  const refs: QuoteRef[] = [];
  for (const slot of slots) {
    refs.push(...quoteRefsFromSlot(slot));
  }

  const sorted = [...refs].sort((a, b) => {
    if (a.anchorTs !== b.anchorTs) return a.anchorTs - b.anchorTs;
    return a.entryId.localeCompare(b.entryId);
  });

  const seen = new Set<string>();
  const out: QuoteRef[] = [];
  for (const q of sorted) {
    const key = `${q.entryId}\0${q.text.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = q.text.trim();
    if (!t) continue;
    out.push(q);
    if (out.length >= SLOT_MAX_QUOTES) break;
  }
  return out;
};

/** Chronological unique quote texts for Loop generation (earliest first). */
export const chronologicalQuoteTexts = (passage: PatternPassage): string[] =>
  chronologicalQuoteRefs(passage).map((q) => {
    const t = q.text.trim();
    return t.length > SLOT_MAX_QUOTE_CHARS
      ? t.slice(0, SLOT_MAX_QUOTE_CHARS).trim()
      : t;
  });

/** Collect voice slots that still need Claude, with preceding evidence context. */
export function buildSlotGenerationInput(
  passage: PatternPassage,
  label: string,
  definition: string,
): SlotGenerationInput | null {
  const voiceSlots: VoiceSlotRequest[] = [];
  const priorVoice: PriorVoiceSlot[] = [];
  const seenQuotes: string[] = [];

  passage.slots.forEach((slot, index) => {
    const texts = quoteTextsFromSlot(slot);
    if (texts.length > 0) seenQuotes.push(...texts);

    if (slot.kind === "line") {
      const role: VoiceSlotRole = "mechanism";

      if (slot.text) {
        priorVoice.push({ index, role, text: slot.text });
        return;
      }

      voiceSlots.push({
        index,
        kind: "line",
        endingKind: "line",
        role,
        precedingQuotes: [...seenQuotes],
      });
      return;
    }

    if (slot.kind === "close" && slot.endingKind !== "quote") {
      const role: VoiceSlotRole = "reflection";

      if (slot.text) {
        priorVoice.push({ index, role, text: slot.text });
        return;
      }

      voiceSlots.push({
        index,
        kind: "close",
        endingKind: slot.endingKind,
        role,
        precedingQuotes: [...seenQuotes],
      });
    }
  });

  if (voiceSlots.length === 0) return null;

  const allQuotes = chronologicalQuoteTexts(passage);
  if (allQuotes.length === 0) return null;

  return {
    patternName: passage.name,
    label,
    definition,
    quotes: allQuotes,
    voiceSlots,
    shapeId: passage.shapeId,
    priorVoice,
  };
}
