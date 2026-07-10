/**
 * Unfold — materialized pattern passage types.
 *
 * A passage is the render-ready sequence of beats. Evidence slots are fully
 * bound; voice slots (`line`, `close`) start empty and are filled by Claude
 * in step P5.
 */

import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import type { EndingKind, Lifecycle } from "@/lib/patterns/pattern-state";
import type { DepthTier } from "@/lib/patterns/planner";
import type { PatternName } from "@/lib/patterns/vocabulary";

export type PassageSlot =
  | { kind: "moments"; quotes: QuoteRef[] }
  | { kind: "pair"; quotes: [QuoteRef, QuoteRef] }
  | { kind: "echo"; phrase: string; quotes: QuoteRef[] }
  | { kind: "line"; text: string | null }
  | {
      kind: "close";
      endingKind: Exclude<EndingKind, "none">;
      text: string | null;
      /** Populated when endingKind is `quote`. */
      quote: QuoteRef | null;
    };

export type PatternPassage = {
  name: PatternName;
  shapeId: string;
  signature: string;
  depthTier: DepthTier;
  endingKind: EndingKind;
  lifecycle: Lifecycle;
  slots: PassageSlot[];
  cacheKey: string;
  createdAt: number;
};

/**
 * Bump when the voice contract or evidence selection changes in a way that
 * makes previously cached passages wrong (they regenerate once per pattern).
 * v2: observation beat replaced by shape beat; evidence selection dedup.
 * v3: shape beat replaced by mechanism generation (event chain, 2–4 sentences).
 * v4: evidence selection prioritizes inner experience over keyword confidence.
 */
const PASSAGE_CACHE_VERSION = "v4";

/** Cache key: version + evidence fingerprint + lifecycle + composition signature. */
export const buildPassageCacheKey = (
  evidenceKey: string,
  lifecycle: Lifecycle,
  signature: string,
): string =>
  `${PASSAGE_CACHE_VERSION}|${evidenceKey}|${lifecycle}|${signature}`;

export const passageNeedsGeneration = (passage: PatternPassage): boolean =>
  passage.slots.some(
    (slot) =>
      (slot.kind === "line" && slot.text === null) ||
      (slot.kind === "close" &&
        slot.endingKind !== "quote" &&
        slot.text === null),
  );
