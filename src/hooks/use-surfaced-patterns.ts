"use client";

import { useEffect, useState } from "react";
import { fetchPatternDisplay } from "@/lib/ai/pattern-display/client";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import {
  getCachedDisplay,
  PATTERN_DISPLAY_UPDATED_EVENT,
} from "@/lib/patterns/pattern-display-store";
import type { SurfacedPattern } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

const isDisplayReady = (pattern: SurfacedPattern): boolean => {
  const evidenceKey = buildEvidenceKey(pattern.evidence);
  return getCachedDisplay(pattern.name, evidenceKey) !== null;
};

/** Prefetch landing copy so the sidebar only lights up when the list can render. */
const prefetchMissingDisplays = (surfaced: SurfacedPattern[]) => {
  for (const pattern of surfaced) {
    if (isDisplayReady(pattern)) continue;
    const evidenceKey = buildEvidenceKey(pattern.evidence);
    void fetchPatternDisplay({
      name: pattern.name as PatternName,
      evidenceKey,
      quotes: pattern.evidence.flatMap((item) => item.quotes),
    });
  }
};

/**
 * Live count of patterns ready to open from the sidebar.
 * Surfaced-but-not-yet-titled patterns stay hidden until display metadata lands.
 */
export function useSurfacedPatterns() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        const { surfaced } = aggregateAnalyses();
        prefetchMissingDisplays(surfaced);
        setCount(surfaced.filter(isDisplayReady).length);
      } catch {
        setCount(0);
      }
    };

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener(ANALYSES_UPDATED_EVENT, refresh);
    window.addEventListener(ENTRIES_UPDATED_EVENT, refresh);
    window.addEventListener(PATTERN_DISPLAY_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, refresh);
      window.removeEventListener(PATTERN_DISPLAY_UPDATED_EVENT, refresh);
    };
  }, []);

  return { hasSurfaced: count > 0, count };
}
