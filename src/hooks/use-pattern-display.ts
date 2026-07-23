"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchPatternDisplay } from "@/lib/ai/pattern-display/client";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import { getCachedDisplay } from "@/lib/patterns/pattern-display-store";
import type { PatternsAggregate, SurfacedPattern } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

export type PatternWithDisplay = SurfacedPattern;

const evidenceFingerprint = (aggregate: PatternsAggregate): string =>
  aggregate.surfaced
    .map((p) => `${p.name}:${buildEvidenceKey(p.evidence)}`)
    .sort()
    .join("|");

const mergeDisplayFromCache = (
  patterns: SurfacedPattern[],
): SurfacedPattern[] =>
  patterns.map((p) => {
    const evidenceKey = buildEvidenceKey(p.evidence);
    const cached = getCachedDisplay(p.name, evidenceKey);
    return cached ? { ...p, display: cached } : p;
  });

const needsDisplay = (pattern: SurfacedPattern): boolean => {
  const evidenceKey = buildEvidenceKey(pattern.evidence);
  if (!pattern.display) return true;
  return pattern.display.sourceEvidenceKey !== evidenceKey;
};

/**
 * Enriches surfaced patterns with landing-page display metadata.
 * Independent of PatternPassage — regenerates only when evidence changes.
 */
export function usePatternDisplay(
  aggregate: PatternsAggregate | null,
): PatternWithDisplay[] {
  const evidenceKey = useMemo(
    () => (aggregate ? evidenceFingerprint(aggregate) : ""),
    [aggregate],
  );

  const [patterns, setPatterns] = useState<PatternWithDisplay[]>(() =>
    aggregate ? mergeDisplayFromCache(aggregate.surfaced) : [],
  );

  const evidenceKeyRef = useRef(evidenceKey);
  evidenceKeyRef.current = evidenceKey;
  const generationRef = useRef(0);

  useEffect(() => {
    if (!aggregate?.surfaced.length) {
      setPatterns([]);
      return;
    }

    const keyAtStart = evidenceKey;
    const surfaced = aggregate.surfaced;
    const generation = generationRef.current + 1;
    generationRef.current = generation;

    const run = async () => {
      const merged = mergeDisplayFromCache(surfaced);

      if (keyAtStart === evidenceKeyRef.current && generation === generationRef.current) {
        setPatterns(merged);
      }

      const pending = merged.filter(needsDisplay);
      if (pending.length === 0) return;

      await Promise.all(
        pending.map(async (pattern) => {
          const evidenceKeyForPattern = buildEvidenceKey(pattern.evidence);
          const display = await fetchPatternDisplay({
            name: pattern.name as PatternName,
            evidenceKey: evidenceKeyForPattern,
            quotes: pattern.evidence.flatMap((item) => item.quotes),
          });

          if (
            keyAtStart !== evidenceKeyRef.current ||
            generation !== generationRef.current
          ) {
            return;
          }

          setPatterns((prev) =>
            prev.map((p) =>
              p.name === pattern.name ? { ...p, display } : p,
            ),
          );
        }),
      );
    };

    void run();
  }, [evidenceKey, aggregate]);

  return patterns;
}
