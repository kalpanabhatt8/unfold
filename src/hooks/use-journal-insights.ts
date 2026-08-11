"use client";

import { useEffect, useState } from "react";
import {
  ENTRIES_UPDATED_EVENT,
  ENTRY_DRAFTS_STORAGE_KEY,
  readAllEntries,
  type JournalEntry,
} from "@/lib/journal-entries";
import {
  ANALYSES_UPDATED_EVENT,
  ENTRY_ANALYSES_STORAGE_KEY,
  listAnalyses,
} from "@/lib/patterns/analysis-store";
import type { EntryAnalysis } from "@/lib/patterns/types";
import {
  aggregateDisplayTopics,
  computeJournalSummary,
  type JournalSummary,
  type TopicFrequency,
} from "@/lib/journal-insights/stats";

export type JournalInsights = {
  summary: JournalSummary;
  topics: TopicFrequency[];
};

const emptyInsights = (): JournalInsights => ({
  summary: {
    entryCount: 0,
    wordCount: 0,
    dayCount: 0,
    currentMonthEntryCount: 0,
    mostActiveWeekday: null,
  },
  topics: [],
});

function buildInsights(
  entries: JournalEntry[],
  analyses: EntryAnalysis[],
): JournalInsights {
  return {
    summary: computeJournalSummary(entries),
    topics: aggregateDisplayTopics(entries, analyses),
  };
}

/** Live journal-insight stats from local entries + analyses (no pattern aggregate). */
export function useJournalInsights(): JournalInsights {
  const [insights, setInsights] = useState<JournalInsights>(emptyInsights);

  useEffect(() => {
    const refresh = () => {
      try {
        setInsights(buildInsights(readAllEntries(), listAnalyses()));
      } catch (error) {
        console.error("Failed to compute journal insights", error);
        setInsights(emptyInsights());
      }
    };

    refresh();

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === ENTRY_DRAFTS_STORAGE_KEY ||
        event.key === ENTRY_ANALYSES_STORAGE_KEY
      ) {
        refresh();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(ENTRIES_UPDATED_EVENT, refresh);
    window.addEventListener(ANALYSES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, refresh);
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
    };
  }, []);

  return insights;
}
