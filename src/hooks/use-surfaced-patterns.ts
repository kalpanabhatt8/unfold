"use client";

import { useEffect, useState } from "react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import { PATTERN_DISPLAY_UPDATED_EVENT } from "@/lib/patterns/pattern-display-store";
import {
  countFullyReadyPatterns,
} from "@/lib/patterns/pattern-readiness";
import {
  countUnreadReadyPatterns,
  PATTERN_VIEWS_UPDATED_EVENT,
} from "@/lib/patterns/pattern-view-store";
import { PATTERN_PASSAGE_UPDATED_EVENT } from "@/lib/patterns/passage-store";

/**
 * Live sidebar signals for Patterns:
 * - `hasSurfaced` - at least one fully ready pattern (keeps the nav link visible)
 * - `count` - unread ready patterns (new or updated since last open)
 */
export function useSurfacedPatterns() {
  const [hasSurfaced, setHasSurfaced] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        const { surfaced } = aggregateAnalyses();
        setHasSurfaced(countFullyReadyPatterns(surfaced) > 0);
        setCount(countUnreadReadyPatterns(surfaced));
      } catch {
        setHasSurfaced(false);
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

  return { hasSurfaced, count };
}
