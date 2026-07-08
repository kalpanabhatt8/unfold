"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generatePassageSlots } from "@/lib/ai/pattern-slots/client";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import { getCachedPassage } from "@/lib/patterns/passage-store";
import {
  reconcileAllPassages,
  type ReconcileResult,
} from "@/lib/patterns/passage-orchestrator";
import { getState } from "@/lib/patterns/pattern-state";
import { passageNeedsGeneration } from "@/lib/patterns/passage-types";
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

let reconcileInflight: {
  key: string;
  promise: Promise<Map<PatternName, ReconcileResult>>;
} | null = null;

const reconcileBatchDeduped = (
  surfaced: SurfacedPattern[],
  now: number,
): Promise<Map<PatternName, ReconcileResult>> => {
  const key = surfaced
    .map((p) => {
      const lifecycle = getState(p.name)?.lifecycle ?? "";
      return `${p.name}:${buildEvidenceKey(p.evidence)}:${lifecycle}`;
    })
    .sort()
    .join("|");

  if (reconcileInflight?.key === key) {
    return reconcileInflight.promise;
  }

  const promise = Promise.resolve().then(() => {
    const results = reconcileAllPassages(
      surfaced.map((p) => ({
        name: p.name,
        evidence: p.evidence,
      })),
      now,
    );
    if (reconcileInflight?.key === key) reconcileInflight = null;
    return results;
  });

  reconcileInflight = { key, promise };
  return promise;
};

const mergePassageFromCache = (
  merged: PatternWithPassage[],
): PatternWithPassage[] =>
  merged.map((p) => ({
    ...p,
    passage: getCachedPassage(p.name) ?? p.passage,
  }));

export function usePatternPassages(
  aggregate: PatternsAggregate | null,
): PatternWithPassage[] {
  const [patterns, setPatterns] = useState<PatternWithPassage[]>([]);
  const aggregateRef = useRef(aggregate);
  aggregateRef.current = aggregate;

  const evidenceKey = useMemo(
    () => (aggregate ? evidenceFingerprint(aggregate) : ""),
    [aggregate],
  );

  const evidenceKeyRef = useRef(evidenceKey);
  evidenceKeyRef.current = evidenceKey;
  const reconcileGenRef = useRef(0);

  useEffect(() => {
    const current = aggregateRef.current;
    if (!current?.surfaced.length) {
      setPatterns([]);
      return;
    }

    const keyAtStart = evidenceKey;
    const surfaced = current.surfaced;
    const generation = reconcileGenRef.current + 1;
    reconcileGenRef.current = generation;

    const run = async () => {
      console.log("[use-pattern-passages] reconcile", {
        evidenceKey: keyAtStart,
        patterns: surfaced.map((p) => p.name),
      });

      const reconciled = await reconcileBatchDeduped(surfaced, Date.now());

      let merged: PatternWithPassage[] = surfaced.map((p) => {
        const result = reconciled.get(p.name);
        return {
          ...p,
          passage: result?.passage ?? null,
        };
      });

      merged = mergePassageFromCache(merged);

      for (const p of merged) {
        if (!p.passage) continue;
        console.log(`[use-pattern-passages] ${p.name}`, {
          shapeId: p.passage.shapeId,
          lifecycle: p.passage.lifecycle,
          slotKinds: p.passage.slots.map((s) => s.kind),
          needsGeneration: passageNeedsGeneration(p.passage),
        });
      }

      if (keyAtStart === evidenceKeyRef.current && generation === reconcileGenRef.current) {
        setPatterns(merged);
      }

      let pending = merged.filter(
        (p) => p.passage && passageNeedsGeneration(p.passage),
      );

      if (pending.length === 0) {
        console.log("[use-pattern-passages] no generation pending");
        return;
      }

      console.log(
        "[use-pattern-passages] generating voice for",
        pending.map((p) => p.name),
      );

      const filled = await generatePassageSlots(
        pending.map((p) => ({
          name: p.name as PatternName,
          passage: p.passage!,
        })),
      );

      merged = merged.map((p) => {
        const next = filled.get(p.name) ?? getCachedPassage(p.name) ?? p.passage;
        if (next && next !== p.passage) {
          console.log(`[use-pattern-passages] filled ${p.name}`, {
            shapeId: next.shapeId,
            slotKinds: next.slots.map((s) => s.kind),
            needsGeneration: passageNeedsGeneration(next),
            voice: next.slots.flatMap((s) => {
              if (s.kind === "line" && s.text) return [s.text];
              if (s.kind === "close" && s.text) return [s.text];
              return [];
            }),
          });
        }
        return { ...p, passage: next };
      });

      // Always apply — fills are persisted to localStorage even if this
      // effect was superseded by HMR. Skip only when evidence changed.
      if (keyAtStart === evidenceKeyRef.current && generation === reconcileGenRef.current) {
        setPatterns(merged);
      } else {
        console.log(
          "[use-pattern-passages] evidence changed during generation — cache updated",
        );
      }

      pending = merged.filter(
        (p) => p.passage && passageNeedsGeneration(p.passage),
      );
      if (pending.length > 0) {
        console.warn(
          "[use-pattern-passages] voice still incomplete for",
          pending.map((p) => p.name),
        );
      }
    };

    void run();
  }, [evidenceKey]);

  return patterns;
}
