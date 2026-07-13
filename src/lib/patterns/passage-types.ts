/**
 * Unfold — materialized pattern passage types.
 *
 * A passage is the render-ready sequence of beats. Evidence slots are fully
 * bound; voice slots (`line`, `close`) start empty and are filled by Claude
 * when the pattern is first composed — then read from cache on every open.
 */

import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import type { EndingKind, Lifecycle } from "@/lib/patterns/pattern-state";
import type { PatternOccurrence } from "@/lib/patterns/occurrences";
import type { DepthTier } from "@/lib/patterns/planner";
import type { PatternName } from "@/lib/patterns/vocabulary";

export type PassageSlot =
  | { kind: "moments"; quotes: QuoteRef[] }
  | { kind: "pair"; quotes: [QuoteRef, QuoteRef] }
  | { kind: "echo"; phrase: string; quotes: QuoteRef[] }
  | {
      kind: "line";
      text: string | null;
      /**
       * Loop steps with supporting quote indexes (1-based into the
       * chronological moments list). Resolved at presentation time so each
       * Loop line can show the journal quote(s) that support it.
       */
      steps?: Array<{ text: string; quoteIndexes: number[] }> | null;
    }
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
  /**
   * When this reading was first composed. Later matching moments append to
   * `occurrences` instead of rewriting slots.
   */
  discoveredAt?: number;
  /** Evidence fingerprint the original slots were built from. */
  discoveryEvidenceKey?: string;
  /**
   * Matching moments that arrived after discovery. Original slots stay frozen;
   * the newest of these surfaces as a single top line.
   */
  occurrences?: PatternOccurrence[];
};

/**
 * Bump when the voice contract or evidence selection changes in a way that
 * makes previously cached passages wrong (they regenerate once per pattern).
 * v2: observation beat replaced by shape beat; evidence selection dedup.
 * v3: shape beat replaced by mechanism generation (event chain, 2–4 sentences).
 * v4: evidence selection prioritizes inner experience over keyword confidence.
 * v5: variable closing signal; occurrence append instead of full regen.
 * v6: weak single-token echo phrases no longer count as a closing beat.
 * v7: Loop is transition-between-moments (not paraphrase); steps carry quote refs.
 */
const PASSAGE_CACHE_VERSION = "v7";

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
