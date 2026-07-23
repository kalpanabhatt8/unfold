"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import { isVoiceArcShape } from "@/lib/patterns/discovery-arc";
import { getCachedPassage, PATTERN_PASSAGE_UPDATED_EVENT } from "@/lib/patterns/passage-store";
import { logReconcileStart } from "@/lib/patterns/pattern-timing";
import { reconcileAllPassages } from "@/lib/patterns/passage-orchestrator";
import {
  passageCacheVersionIsCurrent,
  passageEvidenceKeyFromCacheKey,
  passageNeedsGeneration,
} from "@/lib/patterns/passage-types";
import type { PatternPassage } from "@/lib/patterns/passage-types";
import type { PatternsAggregate, SurfacedPattern } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

export type PatternWithPassage = SurfacedPattern & {
  passage: PatternPassage | null;
};

const evidenceFingerprint = (aggregate: PatternsAggregate): string =>
  aggregate.surfaced
    .map((p) => `${p.name}:${buildEvidenceKey(p.evidence)}`)
    .sort()
    .join("|");

const mergePassageFromCache = (
  surfaced: SurfacedPattern[],
): PatternWithPassage[] =>
  surfaced.map((p) => ({
    ...p,
    passage: getCachedPassage(p.name),
  }));

const EVIDENCE_ONLY_SHAPES = new Set(["bare", "bare_close", "echo", "pair"]);

const mergeReconciledPassages = (
  surfaced: SurfacedPattern[],
  reconciled: ReturnType<typeof reconcileAllPassages>,
): PatternWithPassage[] =>
  surfaced.map((p) => {
    const result = reconciled.get(p.name as PatternName);
    const cached = getCachedPassage(p.name as PatternName);
    const passage = preferPassage(result?.passage, cached ?? undefined);
    return { ...p, passage };
  });

/** Don't swap a voice-complete passage for an incomplete replan mid-session. */
const preferPassage = (
  next: PatternPassage | null | undefined,
  current: PatternPassage | null | undefined,
): PatternPassage | null => {
  if (!next) return current ?? null;
  if (!current) return next;

  const sameEvidence =
    passageEvidenceKeyFromCacheKey(current.cacheKey) ===
    passageEvidenceKeyFromCacheKey(next.cacheKey);

  const currentVoiceCurrent = passageCacheVersionIsCurrent(current.cacheKey);
  const nextVoiceCurrent = passageCacheVersionIsCurrent(next.cacheKey);

  if (
    sameEvidence &&
    !currentVoiceCurrent &&
    nextVoiceCurrent &&
    passageNeedsGeneration(next)
  ) {
    return next;
  }

  if (
    sameEvidence &&
    current.shapeId === "discovery" &&
    EVIDENCE_ONLY_SHAPES.has(next.shapeId) &&
    currentVoiceCurrent
  ) {
    return current;
  }

  if (
    sameEvidence &&
    isVoiceArcShape(next.shapeId) &&
    EVIDENCE_ONLY_SHAPES.has(current.shapeId)
  ) {
    return next;
  }

  if (
    !passageNeedsGeneration(current) &&
    passageNeedsGeneration(next) &&
    sameEvidence &&
    current.shapeId === "discovery" &&
    currentVoiceCurrent
  ) {
    return current;
  }

  if (
    !passageNeedsGeneration(current) &&
    passageNeedsGeneration(next) &&
    sameEvidence &&
    currentVoiceCurrent
  ) {
    return current;
  }

  if (
    !passageNeedsGeneration(current) &&
    !passageNeedsGeneration(next) &&
    sameEvidence &&
    isVoiceArcShape(current.shapeId) &&
    !isVoiceArcShape(next.shapeId) &&
    currentVoiceCurrent
  ) {
    return current;
  }

  return next;
};

const reconcileSurfaced = (surfaced: SurfacedPattern[]): PatternWithPassage[] => {
  const finishReconcile = logReconcileStart();
  const reconciled = reconcileAllPassages(
    surfaced.map((p) => ({
      name: p.name as PatternName,
      evidence: p.evidence,
    })),
    Date.now(),
  );
  finishReconcile();
  return mergeReconciledPassages(surfaced, reconciled);
};

/**
 * Enriches surfaced patterns with reconciled passages from cache.
 * Voice generation is owned by usePatternGeneration — this hook reads + reconciles only.
 */
export function usePatternPassages(
  aggregate: PatternsAggregate | null,
): PatternWithPassage[] {
  const [patterns, setPatterns] = useState<PatternWithPassage[]>(() =>
    aggregate?.surfaced.length ? mergePassageFromCache(aggregate.surfaced) : [],
  );

  const aggregateRef = useRef(aggregate);
  aggregateRef.current = aggregate;

  const evidenceKey = useMemo(
    () => (aggregate ? evidenceFingerprint(aggregate) : ""),
    [aggregate],
  );

  const syncFromAggregate = () => {
    const current = aggregateRef.current;
    if (!current?.surfaced.length) {
      setPatterns([]);
      return;
    }
    setPatterns(reconcileSurfaced(current.surfaced));
  };

  useLayoutEffect(() => {
    syncFromAggregate();
  }, [evidenceKey]);

  useEffect(() => {
    const refreshFromCache = () => {
      const current = aggregateRef.current;
      if (!current?.surfaced.length) return;
      setPatterns((prev) =>
        current.surfaced.map((p) => {
          const existing = prev.find((row) => row.name === p.name);
          const cached = getCachedPassage(p.name as PatternName);
          const passage = preferPassage(cached, existing?.passage ?? undefined);
          return { ...p, passage };
        }),
      );
    };

    window.addEventListener(PATTERN_PASSAGE_UPDATED_EVENT, refreshFromCache);
    return () => {
      window.removeEventListener(PATTERN_PASSAGE_UPDATED_EVENT, refreshFromCache);
    };
  }, []);

  return patterns;
}
