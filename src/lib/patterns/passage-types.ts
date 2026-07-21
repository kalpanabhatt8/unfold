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
 * v5: cache-key delimiter no longer collides with `|` inside evidenceKey.
 * v6: voice bias contract — ban corrective/presumptive reflection framing.
 */
export const PASSAGE_CACHE_VERSION = "v6";

/**
 * Separates cache-key fields. Must not appear in evidenceKey (which joins
 * entries with `|`) or in composition signatures (which also use `|`).
 */
const CACHE_KEY_SEP = "\x1e";

const LIFECYCLE_IN_KEY =
  /\|(emerging|strengthening|strong|weakening|resting|returning)\|/;

/** Cache key: version + evidence fingerprint + lifecycle + composition signature. */
export const buildPassageCacheKey = (
  evidenceKey: string,
  lifecycle: Lifecycle,
  signature: string,
): string =>
  `${PASSAGE_CACHE_VERSION}${CACHE_KEY_SEP}${evidenceKey}${CACHE_KEY_SEP}${lifecycle}${CACHE_KEY_SEP}${signature}`;

/**
 * Extract the evidence fingerprint from a passage cache key.
 * Supports v5+ (`\x1e`-delimited) and legacy v4 (`|`-delimited) keys.
 */
export const passageEvidenceKeyFromCacheKey = (cacheKey: string): string => {
  if (cacheKey.includes(CACHE_KEY_SEP)) {
    return cacheKey.split(CACHE_KEY_SEP)[1] ?? "";
  }
  // Legacy: version|evidenceKey|lifecycle|signature — evidenceKey/signature may contain "|".
  const withoutVersion = cacheKey.replace(/^v\d+\|/, "");
  const match = withoutVersion.match(LIFECYCLE_IN_KEY);
  if (match && match.index !== undefined) {
    return withoutVersion.slice(0, match.index);
  }
  return withoutVersion.split("|")[0] ?? "";
};

/** True when this passage was built under the current voice/cache contract. */
export const passageCacheVersionIsCurrent = (cacheKey: string): boolean => {
  if (cacheKey.includes(CACHE_KEY_SEP)) {
    return cacheKey.split(CACHE_KEY_SEP)[0] === PASSAGE_CACHE_VERSION;
  }
  const legacy = cacheKey.match(/^(v\d+)\|/);
  return legacy?.[1] === PASSAGE_CACHE_VERSION;
};

export const passageNeedsGeneration = (passage: PatternPassage): boolean =>
  passage.slots.some(
    (slot) =>
      (slot.kind === "line" && slot.text === null) ||
      (slot.kind === "close" &&
        slot.endingKind !== "quote" &&
        slot.text === null),
  );
