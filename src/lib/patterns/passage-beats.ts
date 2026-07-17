/**
 * UI-only: map planner passage slots into progressive reading beats.
 * Does not change passage structure — presentation layer only.
 */

import type { PassageSlot } from "@/lib/patterns/passage-types";
import type { QuoteRef } from "@/lib/patterns/evidence-signals";

/** Default quotes visible on a moments beat. */
export const VISIBLE_QUOTE_COUNT = 6;

/** Opening evidence screen — one strong quote; more moments follow on the next card. */
export const OPENING_QUOTE_COUNT = 1;

/** A later "more moments" evidence card surfaces several quotes at once. */
export const MORE_MOMENTS_QUOTE_COUNT = 6;

export type ObservationDepth = "connection" | "realization" | "single";

export type ReflectionBeat =
  | { id: string; type: "thread"; phrase: string }
  | {
      id: string;
      type: "moments";
      visible: QuoteRef[];
      overflow: QuoteRef[];
      /** Hide per-quote dates after the opening evidence beat. */
      showQuoteMeta: boolean;
    }
  | { id: string; type: "pair"; quotes: [QuoteRef, QuoteRef] }
  | { id: string; type: "observation"; text: string; depth: ObservationDepth }
  | {
      id: string;
      type: "ending";
      endingKind: "quote" | "line" | "question";
      quote?: QuoteRef;
      text?: string;
    };

const splitQuotes = (
  quotes: QuoteRef[],
  visibleCount: number,
): { visible: QuoteRef[]; overflow: QuoteRef[] } => {
  if (quotes.length <= visibleCount) {
    return { visible: quotes, overflow: [] };
  }
  return {
    visible: quotes.slice(0, visibleCount),
    overflow: quotes.slice(visibleCount),
  };
};

const isRecognitionShape = (shapeId?: string): boolean =>
  shapeId === "recognition" ||
  shapeId === "recognition_q" ||
  shapeId === "recognition_deep";

/** Convert materialized passage slots into one-screen-at-a-time beats. */
export function passageToBeats(
  slots: PassageSlot[],
  shapeId?: string,
): ReflectionBeat[] {
  const beats: ReflectionBeat[] = [];
  let n = 0;
  let lineIndex = 0;
  let momentsIndex = 0;
  const recognition = isRecognitionShape(shapeId);
  const totalLines = slots.filter((s) => s.kind === "line").length;

  for (const slot of slots) {
    switch (slot.kind) {
      case "moments": {
        const limit =
          momentsIndex === 0 && recognition
            ? OPENING_QUOTE_COUNT
            : recognition
              ? MORE_MOMENTS_QUOTE_COUNT
              : VISIBLE_QUOTE_COUNT;
        momentsIndex += 1;
        const { visible, overflow } = splitQuotes(slot.quotes, limit);
        if (visible.length > 0) {
          beats.push({
            id: `beat-${n++}`,
            type: "moments",
            visible,
            overflow,
            // Evidence stays primary — keep per-quote dates on every
            // evidence card so recognition builds from the user's own words.
            showQuoteMeta: true,
          });
        }
        break;
      }
      case "pair":
        beats.push({ id: `beat-${n++}`, type: "pair", quotes: slot.quotes });
        break;
      case "echo": {
        beats.push({ id: `beat-${n++}`, type: "thread", phrase: slot.phrase });
        const { visible, overflow } = splitQuotes(slot.quotes, VISIBLE_QUOTE_COUNT);
        if (visible.length > 0) {
          beats.push({
            id: `beat-${n++}`,
            type: "moments",
            visible,
            overflow,
            showQuoteMeta: true,
          });
        }
        break;
      }
      case "line": {
        lineIndex += 1;
        let depth: ObservationDepth = "single";
        if (recognition) {
          // The final line is always the realization (visually weightiest);
          // an earlier line, when present, is the lighter connection.
          depth = lineIndex === totalLines ? "realization" : "connection";
        }
        beats.push({
          id: `beat-${n++}`,
          type: "observation",
          text: slot.text ?? "",
          depth,
        });
        break;
      }
      case "close":
        if (slot.endingKind === "quote" && slot.quote) {
          beats.push({
            id: `beat-${n++}`,
            type: "ending",
            endingKind: "quote",
            quote: slot.quote,
          });
        } else {
          beats.push({
            id: `beat-${n++}`,
            type: "ending",
            endingKind: slot.endingKind === "question" ? "question" : "line",
            text: slot.text ?? "",
          });
        }
        break;
    }
  }

  return beats;
}

/** True when this beat is a voice slot still waiting on Claude. */
export const beatAwaitingVoice = (beat: ReflectionBeat): boolean => {
  if (beat.type === "observation") return beat.text.trim().length === 0;
  if (beat.type === "ending") {
    if (beat.endingKind === "quote") return !beat.quote;
    return !beat.text?.trim();
  }
  return false;
};

/** Human-readable sheet title from the thread beat, if any. */
export function threadTitleFromBeats(beats: ReflectionBeat[]): string | null {
  const thread = beats.find((b) => b.type === "thread");
  if (!thread || thread.type !== "thread") return null;
  const phrase = thread.phrase.trim();
  if (!phrase) return null;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
