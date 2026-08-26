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
  fullSync,
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
  generating?: boolean;
};

const POLL_MS = 5_000;
const MAX_POLLS = 60; // ~5 minutes

const applyReadyPayload = (payload: ReadyApiPayload): SurfacedPattern[] => {
  if (payload.snapshot) {
    hydratePatternArtifactsFromSnapshot(payload.snapshot);
  }
  return Array.isArray(payload.patterns) ? payload.patterns : [];
};

const fetchReady = async (): Promise<ReadyApiPayload | null> => {
  const response = await fetch("/api/patterns/ready");
  if (!response.ok) return null;
  return (await response.json()) as ReadyApiPayload;
};

/**
 * Unified Patterns list driver — phase + rows from synced artifacts,
 * with automatic server generation when patterns are due but missing.
 */
export function usePatternList(): PatternListState {
  const aggregate = usePatternsAggregate();
  const [tick, setTick] = useState(0);
  const [remotePatterns, setRemotePatterns] = useState<SurfacedPattern[] | null>(
    null,
  );
  const [serverGenerating, setServerGenerating] = useState(false);

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
        let payload = await fetchReady();
        if (cancelled || !payload) return;

        let patterns = applyReadyPayload(payload);
        setRemotePatterns(patterns);

        const sealedCount = payload.debug?.sealedEntryCount ?? 0;
        const eligibleForGeneration = sealedCount >= 5;

        setServerGenerating(
          Boolean(payload.generating) ||
            (patterns.length === 0 && eligibleForGeneration),
        );
        setTick((t) => t + 1);

        if (patterns.length > 0 || (!payload.generating && !eligibleForGeneration)) {
          return;
        }

        for (let poll = 0; poll < MAX_POLLS; poll += 1) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          if (cancelled) return;
          payload = await fetchReady();
          if (cancelled || !payload) return;
          patterns = applyReadyPayload(payload);
          setRemotePatterns(patterns);
          setServerGenerating(
            Boolean(payload.generating) && patterns.length === 0,
          );
          setTick((t) => t + 1);
          if (patterns.length > 0) {
            await fullSync();
            return;
          }
          if (!payload.generating) return;
        }
      } catch {
        /* network blip — skeleton/empty phase handles it */
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
    } else if (serverGenerating) {
      phase = "syncing";
    }

    return { phase, patterns };
  }, [aggregate, remotePatterns, serverGenerating, tick]);
}
