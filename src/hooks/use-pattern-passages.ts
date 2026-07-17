"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { generatePassageVoiceForPattern } from "@/lib/ai/pattern-slots/client";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import { isVoiceArcShape } from "@/lib/patterns/discovery-arc";
import { getVoiceGenerationPromise } from "@/lib/patterns/pattern-lifecycle";
import { getCachedPassage } from "@/lib/patterns/passage-store";
import {
  logPassageVoiceReady,
  logReconcileStart,
  logVoiceGenerationBatchEnd,
  logVoiceGenerationBatchStart,
} from "@/lib/patterns/pattern-timing";
import { reconcileAllPassages } from "@/lib/patterns/passage-orchestrator";
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

const mergePassageFromCache = (
  surfaced: SurfacedPattern[],
): PatternWithPassage[] =>
  surfaced.map((p) => ({
    ...p,
    passage: getCachedPassage(p.name),
  }));

const passageEvidencePart = (cacheKey: string): string =>
  cacheKey.split("|")[1] ?? "";

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
    passageEvidencePart(current.cacheKey) === passageEvidencePart(next.cacheKey);

  // Never downgrade discovery to evidence-only.
  if (
    sameEvidence &&
    current.shapeId === "discovery" &&
    EVIDENCE_ONLY_SHAPES.has(next.shapeId)
  ) {
    return current;
  }

  // Always take a voice-arc upgrade over a complete evidence-only passage.
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
    current.shapeId === "discovery"
  ) {
    return current;
  }

  if (
    !passageNeedsGeneration(current) &&
    passageNeedsGeneration(next) &&
    sameEvidence
  ) {
    return current;
  }

  if (
    !passageNeedsGeneration(current) &&
    !passageNeedsGeneration(next) &&
    sameEvidence &&
    isVoiceArcShape(current.shapeId) &&
    !isVoiceArcShape(next.shapeId)
  ) {
    return current;
  }

  return next;
};

export function usePatternPassages(
  aggregate: PatternsAggregate | null,
  /** When set, voice generation runs only for this pattern (detail view). */
  voiceForPattern?: PatternName,
): PatternWithPassage[] {
  const [patterns, setPatterns] = useState<PatternWithPassage[]>(() =>
    aggregate?.surfaced.length ? mergePassageFromCache(aggregate.surfaced) : [],
  );
  const patternsRef = useRef(patterns);
  patternsRef.current = patterns;
  const aggregateRef = useRef(aggregate);
  aggregateRef.current = aggregate;

  const evidenceKey = useMemo(
    () => (aggregate ? evidenceFingerprint(aggregate) : ""),
    [aggregate],
  );

  const evidenceKeyRef = useRef(evidenceKey);
  evidenceKeyRef.current = evidenceKey;
  const reconcileGenRef = useRef(0);

  // Sync reconcile before paint so reopen reads the same passage as localStorage.
  useLayoutEffect(() => {
    const current = aggregateRef.current;
    if (!current?.surfaced.length) {
      setPatterns([]);
      return;
    }

    const surfaced = current.surfaced;
    const finishReconcile = logReconcileStart();
    const reconciled = reconcileAllPassages(
      surfaced.map((p) => ({
        name: p.name as PatternName,
        evidence: p.evidence,
      })),
      Date.now(),
    );
    finishReconcile();

    const merged = mergeReconciledPassages(surfaced, reconciled);
    setPatterns(merged);
  }, [evidenceKey]);

  useEffect(() => {
    const current = aggregateRef.current;
    if (!current?.surfaced.length) {
      return;
    }

    const keyAtStart = evidenceKey;
    const surfaced = current.surfaced;
    const generation = reconcileGenRef.current + 1;
    reconcileGenRef.current = generation;

    const run = async () => {
      const merged = mergeReconciledPassages(
        surfaced,
        reconcileAllPassages(
          surfaced.map((p) => ({
            name: p.name as PatternName,
            evidence: p.evidence,
          })),
          Date.now(),
        ),
      );

      for (const row of merged) {
        if (!row.passage) continue;
        const prev = patternsRef.current.find((x) => x.name === row.name)?.passage;
        logPassageVoiceReady(prev ?? null, row.passage);
        console.log(`[use-pattern-passages] ${row.name}`, {
          shapeId: row.passage.shapeId,
          lifecycle: row.passage.lifecycle,
          slotKinds: row.passage.slots.map((s) => s.kind),
          needsGeneration: passageNeedsGeneration(row.passage),
        });
      }

      if (keyAtStart === evidenceKeyRef.current && generation === reconcileGenRef.current) {
        setPatterns(merged);
      }

      let pending = merged.filter(
        (p) => p.passage && passageNeedsGeneration(p.passage),
      );

      if (voiceForPattern) {
        pending = pending.filter((p) => p.name === voiceForPattern);
      }

      if (pending.length === 0) {
        console.log("[use-pattern-passages] no generation pending");
        return;
      }

      console.log(
        "[use-pattern-passages] generating voice for",
        pending.map((p) => p.name),
      );

      const batchNames = pending.map((p) => p.name);
      const batchStart = performance.now();
      logVoiceGenerationBatchStart(batchNames);

      const filled = new Map<PatternName, PatternPassage>();
      await Promise.all(
        pending.map(async (p) => {
          const name = p.name as PatternName;
          const inflight = getVoiceGenerationPromise(name);
          const passage = inflight
            ? await inflight
            : await generatePassageVoiceForPattern({
                name,
                passage: p.passage!,
              });
          filled.set(name, passage);
        }),
      );

      logVoiceGenerationBatchEnd(batchNames, batchStart);

      const filledMerged = merged.map((p) => {
        const prev = p.passage;
        const next =
          filled.get(p.name as PatternName) ??
          getCachedPassage(p.name as PatternName) ??
          p.passage;
        if (prev && next) logPassageVoiceReady(prev, next);
        return { ...p, passage: preferPassage(next, prev) };
      });

      if (keyAtStart === evidenceKeyRef.current && generation === reconcileGenRef.current) {
        setPatterns(filledMerged);
      } else {
        console.log(
          "[use-pattern-passages] evidence changed during generation — cache updated",
        );
      }

      const stillPending = filledMerged.filter(
        (p) => p.passage && passageNeedsGeneration(p.passage),
      );
      if (stillPending.length > 0) {
        console.warn(
          "[use-pattern-passages] voice still incomplete for",
          stillPending.map((p) => p.name),
        );
      }
    };

    void run();
  }, [evidenceKey, voiceForPattern]);

  return patterns;
}
