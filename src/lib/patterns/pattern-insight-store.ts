/**
 * Cache for cross-entry pattern insights (observation + common thread).
 *
 * Keyed by pattern name + sorted entry IDs so insights refresh when the
 * evidence set changes. Stored separately from per-entry analyses.
 */

import type { PatternInsight } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

export const PATTERN_INSIGHTS_STORAGE_KEY = "keeps-pattern-insights";

type CachedInsight = PatternInsight & { entryIds: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const cacheKey = (name: PatternName, entryIds: string[]): string =>
  `${name}:${[...entryIds].sort().join(",")}`;

const readAll = (): Record<string, CachedInsight> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PATTERN_INSIGHTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as Record<string, CachedInsight>) : {};
  } catch (error) {
    console.error("Failed to read pattern insights", error);
    return {};
  }
};

const writeAll = (map: Record<string, CachedInsight>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PATTERN_INSIGHTS_STORAGE_KEY, JSON.stringify(map));
  } catch (error) {
    console.error("Failed to save pattern insight", error);
  }
};

export const getCachedInsight = (
  name: PatternName,
  entryIds: string[],
): PatternInsight | null => {
  const hit = readAll()[cacheKey(name, entryIds)];
  if (!hit) return null;
  return { observation: hit.observation, commonThread: hit.commonThread };
};

export const putCachedInsight = (
  name: PatternName,
  entryIds: string[],
  insight: PatternInsight,
): void => {
  const map = readAll();
  map[cacheKey(name, entryIds)] = { ...insight, entryIds: [...entryIds].sort() };
  writeAll(map);
};
