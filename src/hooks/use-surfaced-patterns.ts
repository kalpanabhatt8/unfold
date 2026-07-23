"use client";

import { useEffect, useState } from "react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import { PATTERN_DISPLAY_UPDATED_EVENT } from "@/lib/patterns/pattern-display-store";
import { countFullyReadyPatterns } from "@/lib/patterns/pattern-readiness";
import { PATTERN_PASSAGE_UPDATED_EVENT } from "@/lib/patterns/passage-store";

/**
 * Live count of patterns fully ready (title + voice) for the sidebar.
 * Generation is owned by usePatternGeneration — this hook only reads cache state.
 */
export function useSurfacedPatterns() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        const { surfaced } = aggregateAnalyses();
        setCount(countFullyReadyPatterns(surfaced));
      } catch {
        setCount(0);
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
    };
  }, []);

  return { hasSurfaced: count > 0, count };
}
