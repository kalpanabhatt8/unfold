"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import {
  ensurePatternsOnServer,
  fetchReadyPatterns,
  isEligibleForPatternGeneration,
  type ReadyPatternsResponse,
} from "@/lib/patterns/ensure-patterns-generated";
import {
  listVisiblePatterns,
  resolvePatternsPagePhase,
  type PatternsPagePhase,
} from "@/lib/patterns/pattern-list-phase";
import {
  inferEmptyReason,
  logPatternsCheckpoint,
  logPatternsPhase,
  snapshotFromReady,
} from "@/lib/patterns/patterns-debug";
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
  emptyReason: string | null;
};

const POLL_MS = 5_000;
const MAX_POLLS = 12; // ~1 minute — only when rebuild succeeded but sync lagging

const applyReadyPayload = (payload: ReadyPatternsResponse): SurfacedPattern[] => {
  if (payload.snapshot) {
    hydratePatternArtifactsFromSnapshot(payload.snapshot);
  }
  return Array.isArray(payload.patterns) ? payload.patterns : [];
};

export function usePatternList(): PatternListState {
  const aggregate = usePatternsAggregate();
  const [tick, setTick] = useState(0);
  const [remotePatterns, setRemotePatterns] = useState<SurfacedPattern[] | null>(
    null,
  );
  const [serverGenerating, setServerGenerating] = useState(false);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const lastReadyRef = useRef<ReadyPatternsResponse | null>(null);
  const lastPhaseLogRef = useRef<string>("");

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
      logPatternsCheckpoint("hydrate:done");

      let payload = await fetchReadyPatterns();
      if (cancelled || !payload) return;
      lastReadyRef.current = payload;

      let patterns = applyReadyPayload(payload);
      setRemotePatterns(patterns);

      const eligible = isEligibleForPatternGeneration(payload);
      const reason = inferEmptyReason(payload);
      setEmptyReason(patterns.length > 0 ? null : reason);

      logPatternsCheckpoint(eligible ? "eligible" : "not_eligible", {
        ...snapshotFromReady(payload),
        eligible,
        emptyReason: reason,
      });

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
        const { payload: after, rebuild } = await ensurePatternsOnServer();
        if (cancelled) return;
        payload = after ?? payload;
        lastReadyRef.current = payload;
        patterns = applyReadyPayload(payload);
        setRemotePatterns(patterns);
        setEmptyReason(patterns.length > 0 ? null : inferEmptyReason(payload));
        setTick((t) => t + 1);

        if (patterns.length > 0) {
          await fullSync();
          setServerGenerating(false);
          return;
        }

        if (rebuild?.reason === "no_surface" || !isEligibleForPatternGeneration(payload)) {
          logPatternsCheckpoint("not_eligible", {
            ...snapshotFromReady(payload),
            rebuildReason: rebuild?.reason,
            emptyReason: inferEmptyReason(payload),
          });
          setServerGenerating(false);
          return;
        }

        if (!rebuild?.ok) {
          setServerGenerating(false);
          return;
        }

        for (let poll = 0; poll < MAX_POLLS; poll += 1) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          if (cancelled) return;
          payload = await fetchReadyPatterns();
          if (cancelled || !payload) return;
          lastReadyRef.current = payload;
          patterns = applyReadyPayload(payload);
          setRemotePatterns(patterns);
          logPatternsCheckpoint("poll", {
            ...snapshotFromReady(payload),
            attempt: poll + 1,
            maxPolls: MAX_POLLS,
          });
          setTick((t) => t + 1);
          if (patterns.length > 0) {
            await fullSync();
            setServerGenerating(false);
            setEmptyReason(null);
            return;
          }
        }
      } catch (error) {
        logPatternsCheckpoint("error", { error: String(error) });
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

    const phaseKey = JSON.stringify({
      phase,
      localCount: local.length,
      remoteCount: remotePatterns?.length ?? 0,
      serverGenerating,
      emptyReason,
      sealed: lastReadyRef.current?.debug?.sealedEntryCount,
      analyses: lastReadyRef.current?.debug?.analysisCount,
      meta: lastReadyRef.current?.meta,
    });
    if (phaseKey !== lastPhaseLogRef.current) {
      lastPhaseLogRef.current = phaseKey;
      logPatternsPhase({
        phase,
        localCount: local.length,
        remoteCount: remotePatterns?.length ?? 0,
        serverGenerating,
        payload: lastReadyRef.current,
      });
    }

    return { phase, patterns, emptyReason };
  }, [aggregate, emptyReason, remotePatterns, serverGenerating, tick]);
}
