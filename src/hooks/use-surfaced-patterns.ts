"use client";

import { useEffect, useState } from "react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import { PATTERN_DISPLAY_UPDATED_EVENT } from "@/lib/patterns/pattern-display-store";
import {
  countUnreadReadyPatterns,
  PATTERN_VIEWS_UPDATED_EVENT,
} from "@/lib/patterns/pattern-view-store";
import { PATTERN_PASSAGE_UPDATED_EVENT } from "@/lib/patterns/passage-store";

/**
 * Live sidebar signal for Patterns: unread ready patterns (new or updated
 * since last open). The nav link stays visible even when this is zero.
 */
export function useSurfacedPatterns() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        const { surfaced } = aggregateAnalyses();
        setCount(countUnreadReadyPatterns(surfaced));
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
    window.addEventListener(PATTERN_VIEWS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, refresh);
      window.removeEventListener(PATTERN_DISPLAY_UPDATED_EVENT, refresh);
      window.removeEventListener(PATTERN_PASSAGE_UPDATED_EVENT, refresh);
      window.removeEventListener(PATTERN_VIEWS_UPDATED_EVENT, refresh);
    };
  }, []);

  return { count };
}
