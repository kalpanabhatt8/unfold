import {
  SLOT_MAX_QUOTE_CHARS,
  SLOT_MAX_QUOTES,
} from "@/lib/ai/pattern-slots/constants";
import type { PatternPassage, PassageSlot } from "@/lib/patterns/passage-types";

export type VoiceSlotRole = "connection" | "realization" | "ending" | "observation";

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
  quotes: string[];
  voiceSlots: VoiceSlotRequest[];
  shapeId: string;
  /** Voice slots already filled — realization must not echo connection. */
  priorVoice: PriorVoiceSlot[];
};

const quoteTextsFromSlot = (slot: PassageSlot): string[] => {
  switch (slot.kind) {
    case "moments":
      return slot.quotes.map((q) => q.text);
    case "pair":
      return slot.quotes.map((q) => q.text);
    case "echo":
      return slot.quotes.map((q) => q.text);
    default:
      return [];
  }
};

const isRecognitionShape = (shapeId: string): boolean =>
  shapeId === "recognition" ||
  shapeId === "recognition_q" ||
  shapeId === "recognition_deep";

/** Collect voice slots that still need Claude, with preceding evidence context. */
export function buildSlotGenerationInput(
  passage: PatternPassage,
  label: string,
  definition: string,
): SlotGenerationInput | null {
  const voiceSlots: VoiceSlotRequest[] = [];
  const priorVoice: PriorVoiceSlot[] = [];
  const seenQuotes: string[] = [];
  let lineIndex = 0;
  const recognition = isRecognitionShape(passage.shapeId);
  const totalLines = passage.slots.filter((s) => s.kind === "line").length;

  passage.slots.forEach((slot, index) => {
    const texts = quoteTextsFromSlot(slot);
    if (texts.length > 0) seenQuotes.push(...texts);

    if (slot.kind === "line") {
      lineIndex += 1;
      // The final line is the earned realization; an earlier line is the
      // lighter connection. A single-line arc goes straight to realization.
      const role: VoiceSlotRole = recognition
        ? lineIndex === totalLines
          ? "realization"
          : "connection"
        : "observation";

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
      if (slot.text) {
        priorVoice.push({ index, role: "ending", text: slot.text });
        return;
      }

      voiceSlots.push({
        index,
        kind: "close",
        endingKind: slot.endingKind,
        role: "ending",
        precedingQuotes: [...seenQuotes],
      });
    }
  });

  if (voiceSlots.length === 0) return null;

  const allQuotes = [
    ...new Set(
      passage.slots.flatMap(quoteTextsFromSlot).map((q) => q.trim()),
    ),
  ]
    .filter(Boolean)
    .map((q) =>
      q.length > SLOT_MAX_QUOTE_CHARS
        ? q.slice(0, SLOT_MAX_QUOTE_CHARS).trim()
        : q,
    )
    .slice(0, SLOT_MAX_QUOTES);

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
