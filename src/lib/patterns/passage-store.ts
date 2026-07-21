/**
 * Unfold — persistence for materialized pattern passages.
 *
 * One passage per pattern name. The cache key embedded in the passage must
 * match (evidenceKey, lifecycle, signature) for a cache hit.
 */

import type { PatternPassage } from "@/lib/patterns/passage-types";
import { isPatternName, type PatternName } from "@/lib/patterns/vocabulary";
import { markPatternsDirty } from "@/lib/sync/local-flags";

export const PATTERN_PASSAGES_STORAGE_KEY = "unfold-pattern-passages";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isValidPassage = (v: unknown): v is PatternPassage => {
  if (!isRecord(v)) return false;
  return (
    isPatternName(v.name) &&
    typeof v.shapeId === "string" &&
    typeof v.signature === "string" &&
    typeof v.depthTier === "string" &&
    typeof v.endingKind === "string" &&
    typeof v.lifecycle === "string" &&
    Array.isArray(v.slots) &&
    typeof v.cacheKey === "string" &&
    typeof v.createdAt === "number"
  );
};

const readAll = (): Record<string, PatternPassage> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PATTERN_PASSAGES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const clean: Record<string, PatternPassage> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isValidPassage(value) && value.name === key) clean[key] = value;
    }
    return clean;
  } catch (error) {
    console.error("Failed to read pattern passages", error);
    return {};
  }
};

const writeAll = (map: Record<string, PatternPassage>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PATTERN_PASSAGES_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch (error) {
    console.error("Failed to save pattern passage", error);
  }
};

export const getCachedPassage = (name: PatternName): PatternPassage | null =>
  readAll()[name] ?? null;

export const listCachedPassages = (): PatternPassage[] =>
  Object.values(readAll());

export const putCachedPassage = (passage: PatternPassage): void => {
  if (!isValidPassage(passage)) return;
  const map = readAll();
  map[passage.name] = passage;
  writeAll(map);
  markPatternsDirty();
};

export const deleteCachedPassage = (name: PatternName): void => {
  const map = readAll();
  if (!(name in map)) return;
  delete map[name];
  writeAll(map);
};
