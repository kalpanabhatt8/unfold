/**
 * Pattern readiness — when a surfaced survivor is safe to show in the UI.
 *
 * Generation iterates `aggregate.surfaced` only (post overlap-suppression).
 * Never `suppressedPatterns` or the pre-suppression bucket.
 */

import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import {
  passageStructureValid,
  passageVoiceEchoes,
} from "@/lib/patterns/passage-fill";
import { getCachedDisplay } from "@/lib/patterns/pattern-display-store";
import { getCachedPassage } from "@/lib/patterns/passage-store";
import {
  passageCacheVersionIsCurrent,
  passageEvidenceKeyFromCacheKey,
  passageNeedsGeneration,
} from "@/lib/patterns/passage-types";
import type { PatternsAggregate, SurfacedPattern } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

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
  if (!passageCacheVersionIsCurrent(passage.cacheKey)) return false;
  if (passageEvidenceKeyFromCacheKey(passage.cacheKey) !== evidenceKey) {
    return false;
  }
  if (passageNeedsGeneration(passage)) return false;
  if (!passageStructureValid(passage)) return false;
  if (passageVoiceEchoes(passage)) return false;
  return true;
};

/** Display + reconciled passage with complete voice for the current evidence set. */
export const isPatternFullyReady = (pattern: SurfacedPatternTarget): boolean =>
  isPatternDisplayReady(pattern) && isPatternVoiceReady(pattern);

export const countFullyReadyPatterns = (
  surfaced: SurfacedPattern[],
): number => surfaced.filter(isPatternFullyReady).length;
