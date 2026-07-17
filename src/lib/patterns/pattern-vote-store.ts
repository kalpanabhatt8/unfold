/**
 * Lightweight thumbs feedback on pattern closing beats.
 * Synced via PatternsSnapshot like displays / states.
 */

import type { PatternName } from "@/lib/patterns/vocabulary";
import { isPatternName } from "@/lib/patterns/vocabulary";
import { markPatternsDirty } from "@/lib/sync/local-flags";

export const PATTERN_VOTES_STORAGE_KEY = "keeps-pattern-votes";

export type PatternVoteValue = "up" | "down";

export type PatternVote = {
  patternName: PatternName;
  /** Evidence entry ids at the time of the vote (sorted on write). */
  entryIds: string[];
  vote: PatternVoteValue;
  updatedAt: number;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isVoteValue = (v: unknown): v is PatternVoteValue =>
  v === "up" || v === "down";

const normalizeEntryIds = (entryIds: string[]): string[] =>
  [...new Set(entryIds.filter((id) => typeof id === "string" && id.trim()))].sort();

const isValidVote = (v: unknown): v is PatternVote => {
  if (!isRecord(v)) return false;
  if (typeof v.patternName !== "string" || !isPatternName(v.patternName)) {
    return false;
  }
  if (!isVoteValue(v.vote)) return false;
  if (typeof v.updatedAt !== "number" || !Number.isFinite(v.updatedAt)) {
    return false;
  }
  if (!Array.isArray(v.entryIds)) return false;
  return v.entryIds.every((id) => typeof id === "string");
};

const readAll = (): Record<string, PatternVote> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PATTERN_VOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const clean: Record<string, PatternVote> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isValidVote(value)) clean[key] = value;
    }
    return clean;
  } catch (error) {
    console.error("Failed to read pattern votes", error);
    return {};
  }
};

const writeAll = (map: Record<string, PatternVote>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PATTERN_VOTES_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch (error) {
    console.error("Failed to save pattern votes", error);
  }
};

/** One active vote per pattern name (latest write wins). */
export const getVote = (patternName: PatternName): PatternVote | null => {
  const hit = readAll()[patternName];
  return hit ?? null;
};

export const listVotes = (): PatternVote[] => Object.values(readAll());

export const putVote = (
  patternName: PatternName,
  entryIds: string[],
  vote: PatternVoteValue,
): PatternVote => {
  const record: PatternVote = {
    patternName,
    entryIds: normalizeEntryIds(entryIds),
    vote,
    updatedAt: Date.now(),
  };
  const map = readAll();
  map[patternName] = record;
  writeAll(map);
  markPatternsDirty();
  return record;
};

/** Apply a server/imported vote without dirtying sync. */
export const putVoteQuiet = (record: PatternVote): void => {
  if (!isValidVote(record)) return;
  const map = readAll();
  const existing = map[record.patternName];
  if (existing && existing.updatedAt >= record.updatedAt) return;
  map[record.patternName] = {
    patternName: record.patternName,
    entryIds: normalizeEntryIds(record.entryIds),
    vote: record.vote,
    updatedAt: record.updatedAt,
  };
  writeAll(map);
};
