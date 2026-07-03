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

export const ENTRY_ANALYSES_STORAGE_KEY = "keeps-entry-analyses";
export const ANALYSES_UPDATED_EVENT = "keeps-analyses-updated";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const readAll = (): Record<string, EntryAnalysis> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ENTRY_ANALYSES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as Record<string, EntryAnalysis>) : {};
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
};

export const deleteAnalysis = (entryId: string): void => {
  const map = readAll();
  if (!(entryId in map)) return;
  delete map[entryId];
  writeAll(map);
};
