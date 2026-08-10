/**
 * Deterministic journal-insight stats for the Patterns-route sidebar.
 * Pure + local — no AI, no pattern pipeline.
 */

import type { JournalEntry } from "@/lib/journal-entries";
import { countWords } from "@/lib/patterns/entry-text";
import type { EntryAnalysis } from "@/lib/patterns/types";

const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Prefer seal → last edit → create (product-specified V1 anchor). */
export function entryActivityTimestamp(entry: JournalEntry): number {
  if (typeof entry.sealedAt === "number" && Number.isFinite(entry.sealedAt)) {
    return entry.sealedAt;
  }
  if (
    typeof entry.lastEditedAt === "number" &&
    Number.isFinite(entry.lastEditedAt)
  ) {
    return entry.lastEditedAt;
  }
  return entry.createdAt;
}

const startOfLocalDay = (ts: number): number => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Local week starts Sunday. */
export const startOfLocalWeek = (ts: number): number => {
  const dayStart = startOfLocalDay(ts);
  const weekday = new Date(dayStart).getDay();
  return dayStart - weekday * DAY_MS;
};

export const startOfLocalMonth = (ts: number): number => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

export type JournalSummary = {
  entryCount: number;
  wordCount: number;
  dayCount: number;
  /** Only set when enough spread exists to be meaningful. */
  mostActiveWeekday: string | null;
};

export function computeJournalSummary(entries: JournalEntry[]): JournalSummary {
  if (entries.length === 0) {
    return {
      entryCount: 0,
      wordCount: 0,
      dayCount: 0,
      mostActiveWeekday: null,
    };
  }

  let wordCount = 0;
  const days = new Set<number>();
  const weekdayCounts = new Array<number>(7).fill(0);

  for (const entry of entries) {
    const ts = entryActivityTimestamp(entry);
    if (!Number.isFinite(ts) || ts <= 0) continue;

    wordCount += countWords(entry.searchText ?? "");
    days.add(startOfLocalDay(ts));
    weekdayCounts[new Date(ts).getDay()] += 1;
  }

  let bestDay = 0;
  for (let i = 1; i < 7; i += 1) {
    if (weekdayCounts[i] > weekdayCounts[bestDay]) bestDay = i;
  }

  // Hide “most active” until there is real day spread.
  const mostActiveWeekday =
    entries.length >= 2 &&
    days.size >= 2 &&
    weekdayCounts[bestDay] >= 2
      ? WEEKDAY_LABELS[bestDay]
      : null;

  return {
    entryCount: entries.length,
    wordCount,
    dayCount: days.size,
    mostActiveWeekday,
  };
}

/** Appear in at least this many distinct analyzed entries. */
export const TOPIC_MIN_ENTRY_COUNT = 2;
/** Cap the list so the rail stays quiet. */
export const TOPIC_MAX_SHOWN = 6;

export type TopicFrequency = {
  topic: string;
  entryCount: number;
  /** Entry ids that carry this topic (for future navigation). */
  entryIds: string[];
};

/**
 * Topics clean enough to surface as recurring nouns / short noun phrases.
 * Rejects article-led fragments, verb-led scraps, and overly long strings.
 */
export function isDisplayableTopic(topic: string): boolean {
  const t = topic.trim().toLowerCase();
  if (t.length < 3 || t.length > 28) return false;

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;

  if (/^(a|an|the)$/.test(words[0] ?? "")) return false;

  if (
    /^(saying|waiting|helping|thinking|feeling|trying|getting|going|making|looking|asking|wanting|keeping|being|having|doing|need|needed|needs)$/.test(
      words[0] ?? "",
    )
  ) {
    return false;
  }

  if (words.length === 1 && /^(yes|no|ok|okay|thing|stuff|something)$/.test(t)) {
    return false;
  }

  return true;
}

/**
 * Aggregate raw analysis.topics across entries.
 * Counts distinct entries per topic (not topic mentions within one entry).
 */
export function aggregateDisplayTopics(
  analyses: EntryAnalysis[],
): TopicFrequency[] {
  const entryIdsByTopic = new Map<string, Set<string>>();

  for (const analysis of analyses) {
    if (!Array.isArray(analysis.topics)) continue;
    const seenInEntry = new Set<string>();

    for (const raw of analysis.topics) {
      if (typeof raw !== "string") continue;
      const topic = raw.trim().toLowerCase();
      if (!isDisplayableTopic(topic)) continue;
      if (seenInEntry.has(topic)) continue;
      seenInEntry.add(topic);

      let set = entryIdsByTopic.get(topic);
      if (!set) {
        set = new Set();
        entryIdsByTopic.set(topic, set);
      }
      set.add(analysis.entryId);
    }
  }

  return [...entryIdsByTopic.entries()]
    .map(([topic, ids]) => ({
      topic,
      entryCount: ids.size,
      entryIds: [...ids],
    }))
    .filter((row) => row.entryCount >= TOPIC_MIN_ENTRY_COUNT)
    .sort((a, b) => {
      if (b.entryCount !== a.entryCount) return b.entryCount - a.entryCount;
      return a.topic.localeCompare(b.topic);
    })
    .slice(0, TOPIC_MAX_SHOWN);
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatTopicLabel(topic: string): string {
  if (!topic) return topic;
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

// --- Something changed ----------------------------------------------------

/** Each comparable period needs at least this many entries. */
export const CHANGE_MIN_ENTRIES_PER_PERIOD = 3;

export type PeriodUnit = "month" | "week";

export type PeriodStats = {
  start: number;
  entryCount: number;
  wordCount: number;
};

export type VolumeChange = {
  kind: "volume";
  unit: PeriodUnit;
  direction: "more" | "less";
  current: PeriodStats;
  previous: PeriodStats;
};

export type TopicChange = {
  kind: "topic";
  unit: PeriodUnit;
  topic: string;
  direction: "more" | "less";
  currentCount: number;
  previousCount: number;
};

export type PeriodChange = VolumeChange | TopicChange;

type PeriodBucket = {
  start: number;
  entries: JournalEntry[];
  wordCount: number;
  topicCounts: Map<string, number>;
};

const periodStartFor = (ts: number, unit: PeriodUnit): number =>
  unit === "month" ? startOfLocalMonth(ts) : startOfLocalWeek(ts);

/** Conservative: ignore +1/+2 noise and tiny relative shifts. */
export function isMeaningfulEntryDelta(
  current: number,
  previous: number,
): boolean {
  const delta = Math.abs(current - previous);
  if (delta < 3) return false;
  if (previous === 0) return current >= CHANGE_MIN_ENTRIES_PER_PERIOD;
  return delta >= Math.max(3, Math.ceil(previous * 0.5));
}

export function isMeaningfulWordDelta(
  current: number,
  previous: number,
): boolean {
  const delta = Math.abs(current - previous);
  if (delta < 200) return false;
  if (previous === 0) return current >= 200;
  return delta >= Math.max(200, Math.ceil(previous * 0.5));
}

export function isMeaningfulTopicDelta(
  current: number,
  previous: number,
): boolean {
  const delta = Math.abs(current - previous);
  if (previous === 0) return current >= 3;
  if (delta < 3) return false;
  return current >= previous * 2 || previous >= current * 2;
}

function buildPeriodBuckets(
  entries: JournalEntry[],
  analyses: EntryAnalysis[],
  unit: PeriodUnit,
): PeriodBucket[] {
  const analysisByEntry = new Map(
    analyses.map((a) => [a.entryId, a] as const),
  );
  const byStart = new Map<number, PeriodBucket>();

  for (const entry of entries) {
    const ts = entryActivityTimestamp(entry);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const start = periodStartFor(ts, unit);

    let bucket = byStart.get(start);
    if (!bucket) {
      bucket = {
        start,
        entries: [],
        wordCount: 0,
        topicCounts: new Map(),
      };
      byStart.set(start, bucket);
    }

    bucket.entries.push(entry);
    bucket.wordCount += countWords(entry.searchText ?? "");

    const analysis = analysisByEntry.get(entry.id);
    if (!analysis || !Array.isArray(analysis.topics)) continue;
    const seen = new Set<string>();
    for (const raw of analysis.topics) {
      if (typeof raw !== "string") continue;
      const topic = raw.trim().toLowerCase();
      if (!isDisplayableTopic(topic) || seen.has(topic)) continue;
      seen.add(topic);
      bucket.topicCounts.set(
        topic,
        (bucket.topicCounts.get(topic) ?? 0) + 1,
      );
    }
  }

  return [...byStart.values()]
    .filter((b) => b.entries.length >= CHANGE_MIN_ENTRIES_PER_PERIOD)
    .sort((a, b) => b.start - a.start);
}

function volumeChangeFromBuckets(
  current: PeriodBucket,
  previous: PeriodBucket,
  unit: PeriodUnit,
): VolumeChange | null {
  const curN = current.entries.length;
  const prevN = previous.entries.length;
  const entryMeaningful = isMeaningfulEntryDelta(curN, prevN);
  const wordMeaningful = isMeaningfulWordDelta(
    current.wordCount,
    previous.wordCount,
  );
  if (!entryMeaningful && !wordMeaningful) return null;

  // Prefer entry-count direction when entries moved enough; else words.
  const useEntries = entryMeaningful;
  const cur = useEntries ? curN : current.wordCount;
  const prev = useEntries ? prevN : previous.wordCount;
  if (cur === prev) return null;

  return {
    kind: "volume",
    unit,
    direction: cur > prev ? "more" : "less",
    current: {
      start: current.start,
      entryCount: curN,
      wordCount: current.wordCount,
    },
    previous: {
      start: previous.start,
      entryCount: prevN,
      wordCount: previous.wordCount,
    },
  };
}

function topicChangeFromBuckets(
  current: PeriodBucket,
  previous: PeriodBucket,
  unit: PeriodUnit,
): TopicChange | null {
  const topics = new Set([
    ...current.topicCounts.keys(),
    ...previous.topicCounts.keys(),
  ]);

  let best: TopicChange | null = null;
  let bestScore = 0;

  for (const topic of topics) {
    const cur = current.topicCounts.get(topic) ?? 0;
    const prev = previous.topicCounts.get(topic) ?? 0;
    if (!isMeaningfulTopicDelta(cur, prev)) continue;
    const score = Math.abs(cur - prev);
    if (score < bestScore) continue;
    if (score === bestScore && best && topic.localeCompare(best.topic) > 0) {
      continue;
    }
    bestScore = score;
    best = {
      kind: "topic",
      unit,
      topic,
      direction: cur > prev ? "more" : "less",
      currentCount: cur,
      previousCount: prev,
    };
  }

  return best;
}

/**
 * Pick at most one conservative change across the two newest
 * sufficiently populated periods.
 *
 * Prefer calendar months when two populated months exist — even if that
 * comparison yields no meaningful change (do not fall back to weeks and
 * invent a noisier adjacent-week insight). Weeks are used only when month
 * history is insufficient.
 */
export function computeSomethingChanged(
  entries: JournalEntry[],
  analyses: EntryAnalysis[],
): PeriodChange | null {
  const compare = (unit: PeriodUnit): PeriodChange | null => {
    const buckets = buildPeriodBuckets(entries, analyses, unit);
    if (buckets.length < 2) return null;
    const [current, previous] = buckets;
    return (
      topicChangeFromBuckets(current, previous, unit) ??
      volumeChangeFromBuckets(current, previous, unit)
    );
  };

  const monthBuckets = buildPeriodBuckets(entries, analyses, "month");
  if (monthBuckets.length >= 2) {
    return compare("month");
  }

  return compare("week");
}
