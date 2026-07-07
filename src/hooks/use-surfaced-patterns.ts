"use client";

import { useEffect, useState } from "react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";

/** Live surfaced pattern count for the sidebar footer. */
export function useSurfacedPatterns() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        setCount(aggregateAnalyses().surfaced.length);
      } catch {
        setCount(0);
      }
    };

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener(ANALYSES_UPDATED_EVENT, refresh);
    window.addEventListener(ENTRIES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, refresh);
    };
  }, []);

  return { hasSurfaced: count > 0, count };
}
