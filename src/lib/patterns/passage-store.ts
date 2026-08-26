/**
 * Unfold - persistence for materialized pattern passages.
 *
 * One passage per pattern name. The cache key embedded in the passage must
 * match (evidenceKey, lifecycle, signature) for a cache hit.
 */

import { isVoiceArcShape } from "@/lib/patterns/discovery-arc";
import { isCompleteVoicePassage } from "@/lib/patterns/passage-fill";
import type { PatternPassage } from "@/lib/patterns/passage-types";
import { isPatternName, type PatternName } from "@/lib/patterns/vocabulary-public";
import { getActivePatternStoreBacking } from "@/lib/patterns/store-backing";
import {
  mergeSessionPassages,
  rememberSessionPassage,
} from "@/lib/patterns/client-session-cache";
import { markPatternsDirty } from "@/lib/sync/local-flags";

export const PATTERN_PASSAGES_STORAGE_KEY = "unfold-pattern-passages";
/** Last complete passage per name - kept while a replacement is still generating. */
export const PATTERN_READY_PASSAGES_STORAGE_KEY =
  "unfold-pattern-passages-ready";
/** Same-tab signal when a passage is written (scaffold, partial, or complete). */
export const PATTERN_PASSAGE_UPDATED_EVENT = "unfold-pattern-passage-updated";

const notifyPassageUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PATTERN_PASSAGE_UPDATED_EVENT));
};

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

const readAllFromDisk = (): Record<string, PatternPassage> => {
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

const readAll = (): Record<string, PatternPassage> => {
  const backing = getActivePatternStoreBacking();
  if (backing) return backing.passages;
  return mergeSessionPassages(readAllFromDisk());
};

const writeAll = (map: Record<string, PatternPassage>) => {
  if (getActivePatternStoreBacking()) return;
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

const readReadyAll = (): Record<string, PatternPassage> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PATTERN_READY_PASSAGES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const clean: Record<string, PatternPassage> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isValidPassage(value) && value.name === key) clean[key] = value;
    }
    return clean;
  } catch (error) {
    console.error("Failed to read ready pattern passages", error);
    return {};
  }
};

const writeReadyAll = (map: Record<string, PatternPassage>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PATTERN_READY_PASSAGES_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch (error) {
    console.error("Failed to save ready pattern passage", error);
  }
};

const putReadyPassage = (passage: PatternPassage): void => {
  if (!isValidPassage(passage) || !isCompleteVoicePassage(passage)) return;
  const map = readReadyAll();
  map[passage.name] = passage;
  writeReadyAll(map);
};

export const getCachedPassage = (name: PatternName): PatternPassage | null =>
  readAll()[name] ?? null;

export const getReadyPassage = (name: PatternName): PatternPassage | null => {
  const hit = readReadyAll()[name] ?? null;
  if (!hit || !isCompleteVoicePassage(hit)) return null;
  return hit;
};

/**
 * Passage the UI should render: the current complete guided one, or the last
 * complete snapshot while a replacement is still generating. Evidence-only
 * working copies do not hide a previously complete guided passage.
 */
export const getDisplayPassage = (name: PatternName): PatternPassage | null => {
  const working = getCachedPassage(name);
  if (
    working &&
    isCompleteVoicePassage(working) &&
    isVoiceArcShape(working.shapeId)
  ) {
    return working;
  }
  const ready = getReadyPassage(name);
  if (ready) return ready;
  if (working && isCompleteVoicePassage(working)) return working;
  return null;
};

export const listCachedPassages = (): PatternPassage[] =>
  Object.values(readAll());

export const putCachedPassage = (passage: PatternPassage): void => {
  if (!isValidPassage(passage)) return;
  rememberSessionPassage(passage);
  const map = readAllFromDisk();
  const previous = map[passage.name];
  // Snapshot the last complete version before an incomplete replan overwrites it.
  if (
    previous &&
    isCompleteVoicePassage(previous) &&
    !isCompleteVoicePassage(passage)
  ) {
    putReadyPassage(previous);
  }
  map[passage.name] = passage;
  writeAll(map);
  if (isCompleteVoicePassage(passage)) {
    putReadyPassage(passage);
  }
  markPatternsDirty();
  notifyPassageUpdated();
};

export const deleteCachedPassage = (name: PatternName): void => {
  const map = readAll();
  const ready = readReadyAll();
  const hadWorking = name in map;
  const hadReady = name in ready;
  if (!hadWorking && !hadReady) return;
  if (hadWorking) {
    delete map[name];
    writeAll(map);
  }
  if (hadReady) {
    delete ready[name];
    writeReadyAll(ready);
  }
  notifyPassageUpdated();
};
