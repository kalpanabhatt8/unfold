/**
 * Cache for landing-page pattern display metadata (title + optional summary).
 *
 * Keyed by pattern name + evidence fingerprint — refreshes when the evidence
 * set changes, independent of passage composition or voice fills.
 */

import type { PatternDisplay } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";
import { markPatternsDirty } from "@/lib/sync/local-flags";

export const PATTERN_DISPLAY_STORAGE_KEY = "unfold-pattern-display";
/** Same-tab signal when landing-page display metadata is written. */
export const PATTERN_DISPLAY_UPDATED_EVENT = "unfold-pattern-display-updated";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const notifyDisplayUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PATTERN_DISPLAY_UPDATED_EVENT));
};

const isValidDisplay = (v: unknown): v is PatternDisplay => {
  if (!isRecord(v)) return false;
  return (
    typeof v.displayTitle === "string" &&
    v.displayTitle.trim().length > 0 &&
    (v.summary === null || typeof v.summary === "string") &&
    typeof v.sourceEvidenceKey === "string" &&
    typeof v.createdAt === "number"
  );
};

const cacheKey = (name: PatternName, evidenceKey: string): string =>
  `${name}|${evidenceKey}`;

const readAll = (): Record<string, PatternDisplay> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PATTERN_DISPLAY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const clean: Record<string, PatternDisplay> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isValidDisplay(value)) clean[key] = value;
    }
    return clean;
  } catch (error) {
    console.error("Failed to read pattern display cache", error);
    return {};
  }
};

const writeAll = (map: Record<string, PatternDisplay>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PATTERN_DISPLAY_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch (error) {
    console.error("Failed to save pattern display", error);
  }
};

export const getCachedDisplay = (
  name: PatternName,
  evidenceKey: string,
): PatternDisplay | null => {
  const hit = readAll()[cacheKey(name, evidenceKey)];
  if (!hit || hit.sourceEvidenceKey !== evidenceKey) return null;
  return hit;
};

/** All cached displays with their cache-key pattern names, for sync. */
export const listCachedDisplays = (): Array<{
  patternName: string;
  display: PatternDisplay;
}> =>
  Object.entries(readAll()).map(([key, display]) => ({
    patternName: key.split("|")[0] ?? "",
    display,
  }));

export const putCachedDisplay = (
  name: PatternName,
  evidenceKey: string,
  display: Omit<PatternDisplay, "sourceEvidenceKey" | "createdAt"> & {
    sourceEvidenceKey?: string;
    createdAt?: number;
  },
): PatternDisplay => {
  const record: PatternDisplay = {
    displayTitle: display.displayTitle.trim(),
    summary: display.summary?.trim() ? display.summary.trim() : null,
    sourceEvidenceKey: evidenceKey,
    createdAt: display.createdAt ?? Date.now(),
  };
  const map = readAll();
  map[cacheKey(name, evidenceKey)] = record;
  writeAll(map);
  markPatternsDirty();
  notifyDisplayUpdated();
  return record;
};
