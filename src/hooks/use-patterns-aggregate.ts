"use client";

import { useEffect, useState } from "react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import { reconcileAnalyses } from "@/lib/patterns/entry-completion";
import type { PatternsAggregate } from "@/lib/patterns/types";

/** Shared aggregate loader for Patterns index + detail. */
export function usePatternsAggregate(): PatternsAggregate | null {
  const [aggregate, setAggregate] = useState<PatternsAggregate | null>(null);

  useEffect(() => {
    const refresh = () => {
      try {
        setAggregate(aggregateAnalyses());
      } catch (error) {
        console.error("Failed to aggregate patterns", error);
        setAggregate({ analyzedEntryCount: 0, surfaced: [] });
      }
    };

    refresh();
    void reconcileAnalyses();

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("keeps-")) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(ANALYSES_UPDATED_EVENT, refresh);
    window.addEventListener(ENTRIES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, refresh);
    };
  }, []);

  return aggregate;
}
