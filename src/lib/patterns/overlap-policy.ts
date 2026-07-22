/**
 * Overlap suppression — one surfaced card per behavioral thread.
 *
 * After aggregation, patterns whose entry sets overlap heavily (same journal
 * moments multi-tagged under different names) collapse into a single survivor.
 * Secondary names become folded metadata, not separate cards.
 */

import { deriveCoPatterns } from "@/lib/patterns/co-patterns";
import type { SurfacedPattern } from "@/lib/patterns/types";
import {
  PATTERN_LABELS,
  PATTERN_NAMES,
  type PatternName,
} from "@/lib/patterns/vocabulary";

/** Default overlap gate — tune in dev via window.__UNFOLD_OVERLAP_THRESHOLD__. */
export const OVERLAP_SUPPRESSION_THRESHOLD = 0.65;

/** Extraction disambiguation: specific patterns outrank overthinking catch-all. */
export const PATTERN_SPECIFICITY_RANK: Record<PatternName, number> = {
  comparison: 1,
  self_doubt: 1,
  overthinking: 0,
  perfectionism: 1,
  avoidance: 1,
  catastrophizing: 1,
  people_pleasing: 1,
  fear_of_judgment: 1,
  self_criticism: 1,
  all_or_nothing: 1,
};

const nameOrderIndex = (name: PatternName): number =>
  PATTERN_NAMES.indexOf(name);

const meanConfidence = (pattern: SurfacedPattern): number => {
  if (pattern.evidence.length === 0) return 0;
  const sum = pattern.evidence.reduce((acc, item) => acc + item.confidence, 0);
  return sum / pattern.evidence.length;
};

/** Dev-only runtime override — same pattern as __UNFOLD_PATTERN_TIMING__. */
export const effectiveOverlapThreshold = (): number => {
  if (typeof window !== "undefined") {
    const override = (
      window as Window & { __UNFOLD_OVERLAP_THRESHOLD__?: number }
    ).__UNFOLD_OVERLAP_THRESHOLD__;
    if (
      typeof override === "number" &&
      Number.isFinite(override) &&
      override > 0 &&
      override <= 1
    ) {
      return override;
    }
  }
  return OVERLAP_SUPPRESSION_THRESHOLD;
};

export const entryOverlapRatio = (
  a: SurfacedPattern,
  b: SurfacedPattern,
): number => {
  const idsA = new Set(a.evidence.map((item) => item.entryId));
  const idsB = new Set(b.evidence.map((item) => item.entryId));
  let intersection = 0;
  for (const id of idsA) {
    if (idsB.has(id)) intersection += 1;
  }
  const minSize = Math.min(idsA.size, idsB.size);
  if (minSize === 0) return 0;
  return intersection / minSize;
};

/** Negative when `a` outranks `b` as cluster survivor. */
export const compareSurvivorPriority = (
  a: SurfacedPattern,
  b: SurfacedPattern,
): number => {
  if (a.entryCount !== b.entryCount) {
    return b.entryCount - a.entryCount;
  }

  const specA = PATTERN_SPECIFICITY_RANK[a.name];
  const specB = PATTERN_SPECIFICITY_RANK[b.name];
  if (specA !== specB) return specB - specA;

  const confA = meanConfidence(a);
  const confB = meanConfidence(b);
  if (Math.abs(confA - confB) > 0.000_05) return confB - confA;

  return nameOrderIndex(a.name) - nameOrderIndex(b.name);
};

export const pickClusterSurvivor = (
  members: SurfacedPattern[],
): SurfacedPattern => {
  if (members.length === 0) {
    throw new Error("pickClusterSurvivor requires at least one member");
  }
  return [...members].sort(compareSurvivorPriority)[0]!;
};

/** Strip overlap-folded labels from deriveCoPatterns output. */
export const filterCoPatternsExcludingSuppressed = (
  labels: string[],
  suppressedPatterns: PatternName[],
): string[] => {
  const suppressedLabels = new Set(
    suppressedPatterns.map((name) => PATTERN_LABELS[name]),
  );
  return labels.filter((label) => !suppressedLabels.has(label));
};

const enrichSurvivor = (
  survivor: SurfacedPattern,
  suppressedPatterns: PatternName[],
): SurfacedPattern => {
  const suppressed = [...suppressedPatterns].sort(
    (a, b) => nameOrderIndex(a) - nameOrderIndex(b),
  );
  const foldedLabels = suppressed.map((name) => PATTERN_LABELS[name]);
  const entryIds = survivor.evidence.map((item) => item.entryId);
  const coPatterns = filterCoPatternsExcludingSuppressed(
    deriveCoPatterns(survivor.name, entryIds),
    suppressed,
  );

  return {
    ...survivor,
    coPatterns,
    foldedLabels,
    suppressedPatterns: suppressed,
  };
};

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    if (this.parent[index] !== index) {
      this.parent[index] = this.find(this.parent[index]!);
    }
    return this.parent[index]!;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent[rootB] = rootA;
  }
}

/**
 * Collapse heavily overlapping surfaced patterns. Singletons pass through with
 * coPatterns from deriveCoPatterns; multi-member clusters keep one survivor.
 */
export function applyOverlapSuppression(
  surfaced: SurfacedPattern[],
): SurfacedPattern[] {
  if (surfaced.length === 0) return [];

  if (surfaced.length === 1) {
    return [enrichSurvivor(surfaced[0]!, [])];
  }

  const threshold = effectiveOverlapThreshold();
  const unionFind = new UnionFind(surfaced.length);

  for (let i = 0; i < surfaced.length; i += 1) {
    for (let j = i + 1; j < surfaced.length; j += 1) {
      if (entryOverlapRatio(surfaced[i]!, surfaced[j]!) >= threshold) {
        unionFind.union(i, j);
      }
    }
  }

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < surfaced.length; i += 1) {
    const root = unionFind.find(i);
    const bucket = clusters.get(root) ?? [];
    bucket.push(i);
    clusters.set(root, bucket);
  }

  const survivors: SurfacedPattern[] = [];
  for (const indices of clusters.values()) {
    if (indices.length === 1) {
      survivors.push(enrichSurvivor(surfaced[indices[0]!]!, []));
      continue;
    }

    const members = indices.map((index) => surfaced[index]!);
    const survivor = pickClusterSurvivor(members);
    const suppressed = members
      .filter((member) => member.name !== survivor.name)
      .map((member) => member.name);
    survivors.push(enrichSurvivor(survivor, suppressed));
  }

  survivors.sort((a, b) => b.entryCount - a.entryCount);
  return survivors;
}
