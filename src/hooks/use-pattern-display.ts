"use client";

import { useEffect, useMemo, useState } from "react";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import { getCachedDisplay } from "@/lib/patterns/pattern-display-store";
import type { PatternsAggregate, SurfacedPattern } from "@/lib/patterns/types";

export type PatternWithDisplay = SurfacedPattern;

const mergeDisplayFromCache = (
  patterns: SurfacedPattern[],
): SurfacedPattern[] =>
  patterns.map((p) => {
    const evidenceKey = buildEvidenceKey(p.evidence);
    const cached = getCachedDisplay(p.name, evidenceKey);
    return cached ? { ...p, display: cached } : p;
  });

/**
 * Enriches surfaced patterns with display metadata pulled from sync cache.
 * Generation happens on the server — this hook never calls Claude.
 */
export function usePatternDisplay(
  aggregate: PatternsAggregate | null,
): PatternWithDisplay[] {
  const evidenceKey = useMemo(
    () =>
      aggregate
        ? aggregate.surfaced
            .map((p) => `${p.name}:${buildEvidenceKey(p.evidence)}`)
            .sort()
            .join("|")
        : "",
    [aggregate],
  );

  const [patterns, setPatterns] = useState<PatternWithDisplay[]>(() =>
    aggregate ? mergeDisplayFromCache(aggregate.surfaced) : [],
  );

  useEffect(() => {
    if (!aggregate?.surfaced.length) {
      setPatterns([]);
      return;
    }
    setPatterns(mergeDisplayFromCache(aggregate.surfaced));
  }, [evidenceKey, aggregate]);

  return patterns;
}
