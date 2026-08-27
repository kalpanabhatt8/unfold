"use client";

import { useEffect, useMemo, useState } from "react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import {
  ensurePatternsOnServer,
  fetchReadyPatterns,
  isEligibleForPatternGeneration,
} from "@/lib/patterns/ensure-patterns-generated";
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

const POLL_MS = 5_000;
const MAX_POLLS = 72; // ~6 minutes — voice generation can be slow

const applyReadyPayload = (
  payload: NonNullable<Awaited<ReturnType<typeof fetchReadyPatterns>>>,
): SurfacedPattern[] => {
  if (payload.snapshot) {
    hydratePatternArtifactsFromSnapshot(payload.snapshot);
  }
  return Array.isArray(payload.patterns) ? payload.patterns : [];
};

/**
 * Patterns list driver — automatically runs server rebuild when due,
 * shows syncing while generation runs, polls until patterns appear.
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

      let payload = await fetchReadyPatterns();
      if (cancelled || !payload) return;

      let patterns = applyReadyPayload(payload);
      setRemotePatterns(patterns);

      const eligible = isEligibleForPatternGeneration(payload);
      if (patterns.length > 0) {
        setServerGenerating(false);
        setTick((t) => t + 1);
        return;
      }

      if (!eligible) {
        setServerGenerating(false);
        setTick((t) => t + 1);
        return;
      }

      setServerGenerating(true);
      setTick((t) => t + 1);

      try {
        payload = (await ensurePatternsOnServer()) ?? payload;
        if (cancelled) return;
        patterns = applyReadyPayload(payload);
        setRemotePatterns(patterns);
        setTick((t) => t + 1);

        if (patterns.length > 0) {
          await fullSync();
          setServerGenerating(false);
          return;
        }

        for (let poll = 0; poll < MAX_POLLS; poll += 1) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          if (cancelled) return;
          payload = await fetchReadyPatterns();
          if (cancelled || !payload) return;
          patterns = applyReadyPayload(payload);
          setRemotePatterns(patterns);
          setTick((t) => t + 1);
          if (patterns.length > 0) {
            await fullSync();
            setServerGenerating(false);
            return;
          }
        }
      } catch {
        /* fall through to empty/syncing resolution */
      }

      if (!cancelled) setServerGenerating(false);
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
