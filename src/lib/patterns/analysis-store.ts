/**
 * Unfold — persistence for per-entry analyses.
 *
 * Kept in its own localStorage namespace (`keeps-entry-analyses`), separate
 * from `keeps-drafts` (the sidebar's hot path). One map keyed by entryId so the
 * Patterns page can load everything in a single read. This module is the only
 * place that touches the store — swap it for a server-backed repository later
 * without changing callers.
 */

import type { EntryAnalysis } from "@/lib/patterns/types";
import { markPatternsDirty } from "@/lib/sync/local-flags";

export const ENTRY_ANALYSES_STORAGE_KEY = "keeps-entry-analyses";
export const ANALYSES_UPDATED_EVENT = "keeps-analyses-updated";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/**
 * Migration: the real-time emotion pipeline was removed, so `emotion` is no
 * longer part of an analysis. Strip it from any legacy stored records. Returns
 * true when something was removed so callers can persist the cleaned map once.
 */
const stripLegacyEmotion = (map: Record<string, EntryAnalysis>): boolean => {
  let changed = false;
  for (const value of Object.values(map)) {
    if (isRecord(value) && "emotion" in value) {
      delete (value as Record<string, unknown>).emotion;
      changed = true;
    }
  }
  return changed;
};

const readAll = (): Record<string, EntryAnalysis> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ENTRY_ANALYSES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const map = parsed as Record<string, EntryAnalysis>;
    // Quietly persist the migration once (no event — this is not a data change
    // from the reader's perspective, and it happens on the first read).
    if (stripLegacyEmotion(map)) {
      try {
        window.localStorage.setItem(
          ENTRY_ANALYSES_STORAGE_KEY,
          JSON.stringify(map),
        );
      } catch {
        /* best-effort migration */
      }
    }
    return map;
  } catch (error) {
    console.error("Failed to read entry analyses", error);
    return {};
  }
};

const writeAll = (map: Record<string, EntryAnalysis>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ENTRY_ANALYSES_STORAGE_KEY,
      JSON.stringify(map),
    );
    window.dispatchEvent(new Event(ANALYSES_UPDATED_EVENT));
  } catch (error) {
    console.error("Failed to save entry analysis", error);
  }
};

export const hasAnalysis = (entryId: string): boolean => entryId in readAll();

export const getAnalysis = (entryId: string): EntryAnalysis | null =>
  readAll()[entryId] ?? null;

export const listAnalyses = (): EntryAnalysis[] => Object.values(readAll());

export const putAnalysis = (analysis: EntryAnalysis): void => {
  const map = readAll();
  map[analysis.entryId] = analysis;
  writeAll(map);
  markPatternsDirty();
};

export const deleteAnalysis = (entryId: string): void => {
  const map = readAll();
  if (!(entryId in map)) return;
  delete map[entryId];
  writeAll(map);
  markPatternsDirty();
};
