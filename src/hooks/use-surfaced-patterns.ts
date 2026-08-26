"use client";

import { useEffect, useState } from "react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import { PATTERN_DISPLAY_UPDATED_EVENT } from "@/lib/patterns/pattern-display-store";
import {
  countUnreadReadyPatterns,
  PATTERN_VIEWS_UPDATED_EVENT,
} from "@/lib/patterns/pattern-view-store";
import { listServerReadyPatterns } from "@/lib/patterns/server-ready-patterns";
import { PATTERN_PASSAGE_UPDATED_EVENT } from "@/lib/patterns/passage-store";
import {
  INITIAL_PATTERNS_SYNC_DONE_EVENT,
  PATTERNS_HYDRATED_EVENT,
} from "@/lib/sync/local-flags";

/**
 * Live sidebar signal for Patterns: unread server-ready patterns.
 */
export function useSurfacedPatterns() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        setCount(countUnreadReadyPatterns(listServerReadyPatterns()));
      } catch {
        setCount(0);
      }
    };

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener(PATTERNS_HYDRATED_EVENT, refresh);
    window.addEventListener(INITIAL_PATTERNS_SYNC_DONE_EVENT, refresh);
    window.addEventListener(ANALYSES_UPDATED_EVENT, refresh);
    window.addEventListener(ENTRIES_UPDATED_EVENT, refresh);
    window.addEventListener(PATTERN_DISPLAY_UPDATED_EVENT, refresh);
    window.addEventListener(PATTERN_PASSAGE_UPDATED_EVENT, refresh);
    window.addEventListener(PATTERN_VIEWS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(PATTERNS_HYDRATED_EVENT, refresh);
      window.removeEventListener(INITIAL_PATTERNS_SYNC_DONE_EVENT, refresh);
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, refresh);
      window.removeEventListener(PATTERN_DISPLAY_UPDATED_EVENT, refresh);
      window.removeEventListener(PATTERN_PASSAGE_UPDATED_EVENT, refresh);
      window.removeEventListener(PATTERN_VIEWS_UPDATED_EVENT, refresh);
    };
  }, []);

  return { count };
}
