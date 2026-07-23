"use client";

import { useEffect, useRef } from "react";
import { fetchPatternDisplay } from "@/lib/ai/pattern-display/client";
import { generatePassageVoiceForPattern } from "@/lib/ai/pattern-slots/client";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import {
  getVoiceGenerationPromise,
  isVoiceGenerationActive,
} from "@/lib/patterns/pattern-lifecycle";
import { PATTERN_DISPLAY_UPDATED_EVENT } from "@/lib/patterns/pattern-display-store";
import {
  isPatternDisplayReady,
  isPatternFullyReady,
  type SurfacedPatternTarget,
} from "@/lib/patterns/pattern-readiness";
import {
  getCachedPassage,
  PATTERN_PASSAGE_UPDATED_EVENT,
} from "@/lib/patterns/passage-store";
import { reconcileAllPassages } from "@/lib/patterns/passage-orchestrator";
import { passageNeedsGeneration } from "@/lib/patterns/passage-types";
import type { PatternName } from "@/lib/patterns/vocabulary";

/** Backoff after failed attempts: 1 → 30s, 2 → 60s, 3+ → 120s (repeat). */
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000] as const;

const retryDelayMs = (attemptNumber: number): number => {
  const index = Math.min(Math.max(attemptNumber, 1), RETRY_DELAYS_MS.length) - 1;
  return RETRY_DELAYS_MS[index]!;
};

type RetryState = {
  timerId: number;
  /** Next retry generation index (1 = first scheduled retry). */
  attempt: number;
  evidenceKey: string;
};

type GenerationOptions = {
  /** Set when invoked from a retry timer — drives backoff on the next failure. */
  retryGeneration?: number;
};

/**
 * Proactive display + voice generation for overlap-suppression survivors only.
 * Mount once at app shell level (sidebar). Patterns stay hidden until fully ready.
 */
export function usePatternGeneration(): void {
  const retryByPattern = useRef(new Map<PatternName, RetryState>());
  const runGenRef = useRef(0);

  useEffect(() => {
    const clearRetry = (name: PatternName) => {
      const state = retryByPattern.current.get(name);
      if (!state) return;
      window.clearTimeout(state.timerId);
      retryByPattern.current.delete(name);
    };

    const clearAllRetries = () => {
      for (const name of [...retryByPattern.current.keys()]) {
        clearRetry(name);
      }
    };

    const scheduleRetry = (pattern: SurfacedPatternTarget, attemptNumber: number) => {
      const name = pattern.name as PatternName;
      const evidenceKey = buildEvidenceKey(pattern.evidence);
      clearRetry(name);
      const timerId = window.setTimeout(() => {
        void runGeneration([pattern], { retryGeneration: attemptNumber });
      }, retryDelayMs(attemptNumber));
      retryByPattern.current.set(name, { timerId, attempt: attemptNumber, evidenceKey });
    };

    const generateForPattern = async (pattern: SurfacedPatternTarget): Promise<void> => {
      const name = pattern.name as PatternName;
      const evidenceKey = buildEvidenceKey(pattern.evidence);

      if (!isPatternDisplayReady(pattern)) {
        await fetchPatternDisplay({
          name,
          evidenceKey,
          quotes: pattern.evidence.flatMap((item) => item.quotes),
        });
      }

      if (isPatternFullyReady(pattern)) return;

      const passage = getCachedPassage(name);
      if (!passage || !passageNeedsGeneration(passage)) return;

      if (isVoiceGenerationActive(name)) {
        await getVoiceGenerationPromise(name);
        return;
      }

      await generatePassageVoiceForPattern({ name, passage });
    };

    const runGeneration = async (
      patterns: SurfacedPatternTarget[],
      options: GenerationOptions = {},
    ): Promise<void> => {
      const generation = runGenRef.current + 1;
      runGenRef.current = generation;

      await Promise.all(
        patterns.map(async (pattern) => {
          const name = pattern.name as PatternName;

          if (isPatternFullyReady(pattern)) {
            clearRetry(name);
            return;
          }

          if (isVoiceGenerationActive(name)) {
            const inflight = getVoiceGenerationPromise(name);
            if (inflight) await inflight;
            if (runGenRef.current !== generation) return;
            if (isPatternFullyReady(pattern)) {
              clearRetry(name);
              return;
            }
            const retryGen = options.retryGeneration ?? 0;
            scheduleRetry(pattern, retryGen + 1);
            return;
          }

          try {
            await generateForPattern(pattern);
          } catch (error) {
            console.warn("[use-pattern-generation] generation failed", name, error);
          }

          if (runGenRef.current !== generation) return;

          if (isPatternFullyReady(pattern)) {
            clearRetry(name);
            return;
          }

          const retryGen = options.retryGeneration ?? 0;
          scheduleRetry(pattern, retryGen + 1);
        }),
      );
    };

    const refresh = () => {
      try {
        // Survivors only — never suppressedPatterns or the pre-suppression bucket.
        const { surfaced } = aggregateAnalyses();

        if (surfaced.length === 0) {
          clearAllRetries();
          return;
        }

        const evidenceByName = new Map(
          surfaced.map((p) => [p.name, buildEvidenceKey(p.evidence)]),
        );

        for (const [name, state] of retryByPattern.current) {
          if (evidenceByName.get(name) !== state.evidenceKey) {
            clearRetry(name);
          }
        }

        reconcileAllPassages(
          surfaced.map((p) => ({
            name: p.name as PatternName,
            evidence: p.evidence,
          })),
          Date.now(),
        );

        for (const pattern of surfaced) {
          if (isPatternFullyReady(pattern)) {
            clearRetry(pattern.name as PatternName);
          }
        }

        const pending = surfaced.filter((p) => !isPatternFullyReady(p));
        if (pending.length === 0) return;

        for (const pattern of pending) {
          clearRetry(pattern.name as PatternName);
        }

        void runGeneration(pending);
      } catch (error) {
        console.error("[use-pattern-generation] refresh failed", error);
      }
    };

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener(ANALYSES_UPDATED_EVENT, refresh);
    window.addEventListener(ENTRIES_UPDATED_EVENT, refresh);
    window.addEventListener(PATTERN_DISPLAY_UPDATED_EVENT, refresh);
    window.addEventListener(PATTERN_PASSAGE_UPDATED_EVENT, refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, refresh);
      window.removeEventListener(PATTERN_DISPLAY_UPDATED_EVENT, refresh);
      window.removeEventListener(PATTERN_PASSAGE_UPDATED_EVENT, refresh);
      clearAllRetries();
    };
  }, []);
}
