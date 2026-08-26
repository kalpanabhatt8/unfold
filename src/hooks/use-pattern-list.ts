"use client";

import { useEffect, useMemo, useState } from "react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import {
  listVisiblePatterns,
  resolvePatternsPagePhase,
  type PatternsPagePhase,
} from "@/lib/patterns/pattern-list-phase";
import { PATTERN_DISPLAY_UPDATED_EVENT } from "@/lib/patterns/pattern-display-store";
import { PATTERN_PASSAGE_UPDATED_EVENT } from "@/lib/patterns/passage-store";
import { listServerReadyPatterns } from "@/lib/patterns/server-ready-patterns";
import type { SurfacedPattern } from "@/lib/patterns/types";
import {
  INITIAL_PATTERNS_SYNC_DONE_EVENT,
  PATTERNS_HYDRATED_EVENT,
} from "@/lib/sync/local-flags";
import {
  ensurePatternsHydrated,
  hydratePatternArtifactsFromSnapshot,
} from "@/lib/sync/sync-client";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";

export type PatternListState = {
  phase: PatternsPagePhase;
  patterns: SurfacedPattern[];
};

type ReadyApiPayload = {
  patterns?: SurfacedPattern[];
  snapshot?: {
    states: Parameters<typeof hydratePatternArtifactsFromSnapshot>[0]["states"];
    passages: Parameters<typeof hydratePatternArtifactsFromSnapshot>[0]["passages"];
    displays: Parameters<typeof hydratePatternArtifactsFromSnapshot>[0]["displays"];
  };
  meta?: { states: number; passages: number; displays: number };
  debug?: { userId: string; sealedEntryCount: number; analysisCount: number };
};

/**
 * Unified Patterns list driver — phase + rows from synced artifacts,
 * with a direct server fetch when local caches fail to hydrate.
 */
export function usePatternList(): PatternListState {
  const aggregate = usePatternsAggregate();
  const [tick, setTick] = useState(0);
  const [remotePatterns, setRemotePatterns] = useState<SurfacedPattern[] | null>(
    null,
  );

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key.startsWith("unfold-pattern") ||
        event.key.startsWith("unfold-entry-analyses")
      ) {
        bump();
      }
    };
    window.addEventListener(PATTERNS_HYDRATED_EVENT, bump);
    window.addEventListener(INITIAL_PATTERNS_SYNC_DONE_EVENT, bump);
    window.addEventListener(PATTERN_DISPLAY_UPDATED_EVENT, bump);
    window.addEventListener(PATTERN_PASSAGE_UPDATED_EVENT, bump);
    window.addEventListener(ANALYSES_UPDATED_EVENT, bump);
    window.addEventListener(ENTRIES_UPDATED_EVENT, bump);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PATTERNS_HYDRATED_EVENT, bump);
      window.removeEventListener(INITIAL_PATTERNS_SYNC_DONE_EVENT, bump);
      window.removeEventListener(PATTERN_DISPLAY_UPDATED_EVENT, bump);
      window.removeEventListener(PATTERN_PASSAGE_UPDATED_EVENT, bump);
      window.removeEventListener(ANALYSES_UPDATED_EVENT, bump);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      await ensurePatternsHydrated();
      try {
        const response = await fetch("/api/patterns/ready");
        if (!response.ok) {
          console.warn("[patterns] /api/patterns/ready failed", response.status);
          return;
        }
        const payload = (await response.json()) as ReadyApiPayload;
        if (cancelled) return;
        if (payload.snapshot) {
          hydratePatternArtifactsFromSnapshot(payload.snapshot);
        }
        if (Array.isArray(payload.patterns)) {
          setRemotePatterns(payload.patterns);
          console.info("[patterns]", {
            phase: payload.patterns.length > 0 ? "ready" : "empty",
            localCount: listServerReadyPatterns().length,
            remoteCount: payload.patterns.length,
            userId: payload.debug?.userId,
            sealedEntryCount: payload.debug?.sealedEntryCount,
            analysisCount: payload.debug?.analysisCount,
            meta: payload.meta,
          });
        }
        setTick((t) => t + 1);
      } catch (error) {
        console.warn("[patterns] /api/patterns/ready error", error);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    void tick;
    const local = listServerReadyPatterns();
    const patterns =
      local.length > 0
        ? local
        : remotePatterns && remotePatterns.length > 0
          ? remotePatterns
          : listVisiblePatterns();

    let phase = resolvePatternsPagePhase(aggregate);
    if (patterns.length > 0) {
      phase = "ready";
    }

    return { phase, patterns };
  }, [aggregate, remotePatterns, tick]);
}
