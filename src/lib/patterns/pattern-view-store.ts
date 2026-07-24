/**
 * Per-pattern "last seen" fingerprints for the sidebar unread badge.
 *
 * A ready pattern is unread when the user has never opened it, or when its
 * evidence fingerprint changed since they last expanded it. Device-local only
 * (not synced) - same shape as other thin pattern stores.
 */

import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import { isPatternFullyReady } from "@/lib/patterns/pattern-readiness";
import type { SurfacedPattern } from "@/lib/patterns/types";
import { isPatternName, type PatternName } from "@/lib/patterns/vocabulary";

export const PATTERN_VIEWS_STORAGE_KEY = "unfold-pattern-views";
export const PATTERN_VIEWS_UPDATED_EVENT = "unfold-pattern-views-updated";

export type PatternView = {
  patternName: PatternName;
  /** Evidence fingerprint the user last opened. */
  evidenceKey: string;
  seenAt: number;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isValidView = (v: unknown): v is PatternView => {
  if (!isRecord(v)) return false;
  if (typeof v.patternName !== "string" || !isPatternName(v.patternName)) {
    return false;
  }
  if (typeof v.evidenceKey !== "string") return false;
  if (typeof v.seenAt !== "number" || !Number.isFinite(v.seenAt)) return false;
  return true;
};

const notifyViewsUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PATTERN_VIEWS_UPDATED_EVENT));
};

const readAll = (): Record<string, PatternView> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PATTERN_VIEWS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const clean: Record<string, PatternView> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isValidView(value)) clean[key] = value;
    }
    return clean;
  } catch (error) {
    console.error("Failed to read pattern views", error);
    return {};
  }
};

const writeAll = (map: Record<string, PatternView>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PATTERN_VIEWS_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch (error) {
    console.error("Failed to save pattern views", error);
  }
};

export const getSeenEvidenceKey = (
  patternName: PatternName,
): string | null => {
  const hit = readAll()[patternName];
  return hit?.evidenceKey ?? null;
};

export const isPatternUnread = (
  patternName: PatternName,
  evidenceKey: string,
): boolean => getSeenEvidenceKey(patternName) !== evidenceKey;

/** True when a fully ready pattern has new or updated evidence since last open. */
export const isReadyPatternUnread = (pattern: SurfacedPattern): boolean => {
  if (!isPatternFullyReady(pattern)) return false;
  return isPatternUnread(pattern.name, buildEvidenceKey(pattern.evidence));
};

export const countUnreadReadyPatterns = (
  surfaced: SurfacedPattern[],
): number => surfaced.filter(isReadyPatternUnread).length;

/**
 * Record that the user opened this pattern at the given evidence fingerprint.
 * No-op when already marked for the same key.
 */
export const markPatternSeen = (
  patternName: PatternName,
  evidenceKey: string,
): void => {
  if (!evidenceKey) return;
  const map = readAll();
  const existing = map[patternName];
  if (existing?.evidenceKey === evidenceKey) return;
  map[patternName] = {
    patternName,
    evidenceKey,
    seenAt: Date.now(),
  };
  writeAll(map);
  notifyViewsUpdated();
};
