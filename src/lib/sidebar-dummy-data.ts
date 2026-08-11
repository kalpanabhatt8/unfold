/**
 * Temporary filled sidebar state for UI design.
 * Flip `SIDEBAR_UI_DUMMY` off (or delete this module) when done.
 */

import type { JournalEntry } from "@/lib/journal-entries";
import type {
  JournalSummary,
  PeriodChange,
  TopicFrequency,
} from "@/lib/journal-insights/stats";

/** Set false to go back to live localStorage data. */
export const SIDEBAR_UI_DUMMY = true;

export type DummyJournalInsights = {
  summary: JournalSummary;
  change: PeriodChange | null;
  topics: TopicFrequency[];
};

const hour = 3_600_000;
const day = 86_400_000;
const now = Date.now();

type DummyEntrySeed = {
  id: string;
  title: string;
  preview: string;
  ageMs: number;
  sealed?: boolean;
};

const ENTRY_SEEDS: DummyEntrySeed[] = [
  {
    id: "dummy-after-lunch",
    title: "After Lunch",
    preview: "I'll start after lunch. The draft stayed closed.",
    ageMs: 2 * hour,
    sealed: true,
  },
  {
    id: "dummy-untitled",
    title: "",
    preview: "Still thinking about what to say out loud.",
    ageMs: 5 * hour,
  },
  {
    id: "dummy-one-more",
    title: "One More Tutorial",
    preview: "Just one more tutorial before I begin.",
    ageMs: 1 * day,
    sealed: true,
  },
  {
    id: "dummy-tomorrow",
    title: "Tomorrow Instead",
    preview: "Tomorrow feels easier than finishing tonight.",
    ageMs: 2 * day,
    sealed: true,
  },
  {
    id: "dummy-cleaned",
    title: "Cleaned Everything",
    preview: "I cleaned everything before beginning.",
    ageMs: 4 * day,
    sealed: true,
  },
  {
    id: "dummy-portfolio",
    title: "Maybe Tomorrow",
    preview: "I finally opened my portfolio today.",
    ageMs: 8 * day,
    sealed: true,
  },
  {
    id: "dummy-sunday",
    title: "Quiet Sunday",
    preview: "Wrote for an hour before anyone woke up.",
    ageMs: 9 * day,
    sealed: true,
  },
  {
    id: "dummy-sleep",
    title: "Late Again",
    preview: "Kept refreshing email instead of sleeping.",
    ageMs: 11 * day,
    sealed: true,
  },
  {
    id: "dummy-family",
    title: "Call Home",
    preview: "Mom asked how work was. I said fine.",
    ageMs: 13 * day,
    sealed: true,
  },
  {
    id: "dummy-draft-open",
    title: "Half a Thought",
    preview: "No additional text",
    ageMs: 14 * day,
  },
  {
    id: "dummy-commute",
    title: "On the Train",
    preview: "The commute felt longer than usual today.",
    ageMs: 16 * day,
    sealed: true,
  },
  {
    id: "dummy-rest",
    title: "Permission to Rest",
    preview: "I keep treating rest like something I have to earn.",
    ageMs: 18 * day,
    sealed: true,
  },
];

export function getDummySidebarEntries(): JournalEntry[] {
  return ENTRY_SEEDS.map((seed) => {
    const createdAt = now - seed.ageMs;
    return {
      id: seed.id,
      title: seed.title,
      createdAt,
      updatedAt: createdAt,
      lastEditedAt: createdAt,
      sealedAt: seed.sealed ? createdAt + hour : null,
      searchText: seed.preview === "No additional text" ? "" : seed.preview,
    };
  });
}

/** Unread pattern badge count when dummy mode is on. */
export const DUMMY_PATTERN_UNREAD_COUNT = 2;

export function getDummyJournalInsights(): DummyJournalInsights {
  return {
    summary: {
      entryCount: 47,
      wordCount: 12_840,
      dayCount: 31,
      mostActiveWeekday: "Sunday",
    },
    change: {
      kind: "topic",
      unit: "month",
      topic: "work",
      direction: "more",
      currentCount: 11,
      previousCount: 4,
    },
    topics: [
      { topic: "work", entryCount: 18, entryIds: [] },
      { topic: "sleep", entryCount: 12, entryIds: [] },
      { topic: "family", entryCount: 9, entryIds: [] },
      { topic: "portfolio", entryCount: 7, entryIds: [] },
      { topic: "mornings", entryCount: 5, entryIds: [] },
      { topic: "rest", entryCount: 4, entryIds: [] },
    ],
  };
}
