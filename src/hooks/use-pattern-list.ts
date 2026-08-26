"use client";

import { useEffect, useMemo, useState } from "react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import {
  listVisiblePatterns,
  resolvePatternsPagePhase,
  type PatternsPagePhase,
} from "@/lib/patterns/pattern-list-phase";
import { PATTERN_STATE_STORAGE_KEY } from "@/lib/patterns/pattern-state";
import { PATTERN_DISPLAY_UPDATED_EVENT } from "@/lib/patterns/pattern-display-store";
import { PATTERN_PASSAGE_UPDATED_EVENT } from "@/lib/patterns/passage-store";
import type { SurfacedPattern } from "@/lib/patterns/types";
import {
  INITIAL_PATTERNS_SYNC_DONE_EVENT,
  PATTERNS_HYDRATED_EVENT,
} from "@/lib/sync/local-flags";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";

export type PatternListState = {
  phase: PatternsPagePhase;
  patterns: SurfacedPattern[];
};

/**
 * Unified Patterns list driver — phase + rows from synced artifacts.
 */
export function usePatternList(): PatternListState {
  const aggregate = usePatternsAggregate();
  const [tick, setTick] = useState(0);

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

  return useMemo(() => {
    void tick;
    const phase = resolvePatternsPagePhase(aggregate);
    const patterns = phase === "ready" ? listVisiblePatterns() : [];
    return { phase, patterns };
  }, [aggregate, tick]);
}
