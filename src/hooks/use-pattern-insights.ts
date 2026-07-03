"use client";

import { useEffect, useMemo, useRef } from "react";
import { listAnalyses } from "@/lib/patterns/analysis-store";
import { fetchPatternInsight } from "@/lib/patterns/fetch-pattern-insight";
import type { PatternsAggregate, SurfacedPattern } from "@/lib/patterns/types";

/** Collect quotes + topics from the entries behind a surfaced pattern. */
function insightInputFor(pattern: SurfacedPattern) {
  const entrySet = new Set(pattern.evidence.map((item) => item.entryId));
  const analyses = listAnalyses().filter((a) => entrySet.has(a.entryId));

  const quotes = pattern.evidence.flatMap((item) => item.quotes);
  const topics = [
    ...new Set(analyses.flatMap((a) => a.topics).filter(Boolean)),
  ];

  return {
    name: pattern.name,
    entryIds: pattern.evidence.map((item) => item.entryId),
    quotes,
    topics,
  };
}

const fingerprint = (patterns: SurfacedPattern[]): string =>
  patterns
    .map((p) => {
      const ids = p.evidence
        .map((e) => e.entryId)
        .sort()
        .join(",");
      return `${p.name}:${ids}:${p.insight ? 1 : 0}`;
    })
    .join("|");

/**
 * Fetches LLM-generated observations for surfaced patterns missing insight
 * (cached hits are applied synchronously in aggregate). Calls `onUpdate` as
 * each batch completes.
 */
export function usePatternInsights(
  aggregate: PatternsAggregate | null,
  onUpdate: (patterns: SurfacedPattern[]) => void,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const key = useMemo(
    () => (aggregate ? fingerprint(aggregate.surfaced) : ""),
    [aggregate],
  );

  useEffect(() => {
    if (!aggregate?.surfaced.length) return;

    const pending = aggregate.surfaced.filter((p) => !p.insight);
    if (pending.length === 0) return;

    let cancelled = false;

    const run = async () => {
      const byName = new Map(aggregate.surfaced.map((p) => [p.name, p]));

      await Promise.all(
        pending.map(async (pattern) => {
          const insight = await fetchPatternInsight(insightInputFor(pattern));
          if (cancelled) return;
          byName.set(pattern.name, { ...pattern, insight });
        }),
      );

      if (!cancelled) {
        const enriched = aggregate.surfaced.map(
          (p) => byName.get(p.name) ?? p,
        );
        onUpdateRef.current(enriched);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [key, aggregate]);
}
