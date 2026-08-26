/**
 * Pattern readiness - when a surfaced survivor is safe to show in the UI.
 *
 * Generation iterates `aggregate.surfaced` only (post overlap-suppression).
 * Never `suppressedPatterns` or the pre-suppression bucket.
 *
 * The list never shows a quotes-only / "a moment…" shell. A row appears when
 * the current evidence set has a complete guided passage, or while a
 * replacement is generating we keep the last complete snapshot on screen.
 */

import { isVoiceArcShape } from "@/lib/patterns/discovery-arc";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import { isCompleteVoicePassage } from "@/lib/patterns/passage-fill";
import { getCachedDisplay } from "@/lib/patterns/pattern-display-store";
import {
  getCachedPassage,
  getDisplayPassage,
} from "@/lib/patterns/passage-store";
import { passageEvidenceKeyFromCacheKey } from "@/lib/patterns/passage-types";
import { getState } from "@/lib/patterns/pattern-state";
import type { PatternsAggregate, SurfacedPattern } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary-public";

export type SurfacedPatternTarget = Pick<
  SurfacedPattern,
  "name" | "evidence"
>;

export const patternEvidenceFingerprint = (
  aggregate: PatternsAggregate,
): string =>
  aggregate.surfaced
    .map((p) => `${p.name}:${buildEvidenceKey(p.evidence)}`)
    .sort()
    .join("|");

export const isPatternDisplayReady = (pattern: SurfacedPatternTarget): boolean => {
  const evidenceKey = buildEvidenceKey(pattern.evidence);
  return getCachedDisplay(pattern.name, evidenceKey) !== null;
};

export const isPatternVoiceReady = (pattern: SurfacedPatternTarget): boolean => {
  const evidenceKey = buildEvidenceKey(pattern.evidence);
  const passage = getCachedPassage(pattern.name as PatternName);
  if (!passage) return false;
  if (passageEvidenceKeyFromCacheKey(passage.cacheKey) !== evidenceKey) {
    return false;
  }
  return isCompleteVoicePassage(passage);
};

const discoveryEligibleForPattern = (pattern: SurfacedPatternTarget): boolean => {
  const quoteCount = pattern.evidence.reduce(
    (total, item) => total + item.quotes.length,
    0,
  );
  if (quoteCount < 3) return false;
  const lifecycle =
    getState(pattern.name as PatternName)?.lifecycle ?? "emerging";
  return lifecycle !== "resting" && lifecycle !== "emerging";
};

/**
 * Guided arc has mechanism/reflection when discovery is warranted.
 * Evidence-only passages must not surface as ready once eligible.
 */
export const isPatternGuidedArcReady = (
  pattern: SurfacedPatternTarget,
  passage = getDisplayPassage(pattern.name as PatternName),
): boolean => {
  if (!passage) return false;
  if (isVoiceArcShape(passage.shapeId) && isCompleteVoicePassage(passage)) {
    return true;
  }
  return !discoveryEligibleForPattern(pattern);
};

const heldReadyTitleExists = (pattern: SurfacedPatternTarget): boolean => {
  const passage = getDisplayPassage(pattern.name as PatternName);
  if (!passage || !isCompleteVoicePassage(passage)) return false;
  const heldKey = passageEvidenceKeyFromCacheKey(passage.cacheKey);
  return getCachedDisplay(pattern.name as PatternName, heldKey) !== null;
};

/** Display + complete voice + guided beats for the current evidence set. */
export const isPatternFullyReady = (pattern: SurfacedPatternTarget): boolean =>
  isPatternDisplayReady(pattern) &&
  isPatternVoiceReady(pattern) &&
  isPatternGuidedArcReady(pattern, getCachedPassage(pattern.name as PatternName));

/**
 * Show the row only when the guided passage is complete, or keep the last
 * complete snapshot while the next one is still generating.
 */
export const isPatternListVisible = (pattern: SurfacedPatternTarget): boolean => {
  if (isPatternFullyReady(pattern)) return true;
  const display = getDisplayPassage(pattern.name as PatternName);
  if (!display || !isCompleteVoicePassage(display)) return false;
  if (!isPatternGuidedArcReady(pattern, display)) return false;
  return heldReadyTitleExists(pattern);
};

export const countFullyReadyPatterns = (
  surfaced: SurfacedPattern[],
): number => surfaced.filter(isPatternFullyReady).length;

/**
 * @deprecated Use {@link listServerReadyPatterns} from server-ready-patterns.ts.
 * Kept for scripts/tests that imported the old name.
 */
export { listServerReadyPatterns as listReadyPatternsFromSyncCache } from "@/lib/patterns/server-ready-patterns";
