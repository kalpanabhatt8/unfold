/**
 * Unfold — lifecycle classifier for living patterns.
 *
 * Pure + deterministic. Given a surfaced pattern's evidence, the user's global
 * journaling activity, and the previous state, decide the pattern's stage of
 * life. Structure (shape, pacing, ending) is chosen downstream by the planner;
 * this module only answers "where is this pattern in its life right now?".
 *
 * Two design commitments drive the shape of this file:
 *   1. Small N. A pattern lives on 3–8 evidence points, so decisions are
 *      count-based and interpretable, never fragile slopes, and every stage
 *      change is damped by dwell-based hysteresis to avoid flicker.
 *   2. Honesty about absence. `resting` (no new evidence anywhere) is distinct
 *      from `weakening` (a genuine decline while journaling continues) — we
 *      never imply the user changed without data, so `resting` is checked first.
 *
 * All thresholds live in `lifecycle-config.ts` for calibration without
 * touching classifier logic.
 */

import {
  HALF_LIFE_DAYS,
  MIN_DWELL_DAYS,
  RECENT_WINDOW_DAYS,
  RETURN_GAP_DAYS,
  RETURNING_MAX_RECENT,
} from "@/lib/patterns/lifecycle-config";
import type { PatternEvidenceItem } from "@/lib/patterns/types";
import type { Lifecycle, PatternState } from "@/lib/patterns/pattern-state";
import { SURFACE_MIN_ENTRIES } from "@/lib/patterns/vocabulary";

const DAY_MS = 86_400_000;

/** Date anchor for an evidence item — mirrors aggregate/time-hint. */
const anchorTs = (item: PatternEvidenceItem): number =>
  item.sealedAt ?? item.lastEditedAt ?? item.createdAt;

const daysBetween = (a: number, b: number): number => Math.abs(a - b) / DAY_MS;

export type LifecycleSignals = {
  entryCount: number;
  firstSeen: number;
  lastSeen: number;
  ageDays: number;
  /** Evidence within RECENT_WINDOW of now. */
  recentCount: number;
  /** Evidence older than RECENT_WINDOW. */
  priorCount: number;
  /** Largest quiet span between consecutive evidence points, in days. */
  maxGapDays: number;
  daysSinceLastSeen: number;
  daysSinceGlobalActivity: number;
  /** Confidence-weighted, time-decayed mass. */
  strength: number;
  /** True when evidence spans more than one recent window. */
  hasTimeSpread: boolean;
};

/**
 * Derive the raw temporal signals. `globalActivityAt` is the latest analyzed
 * entry anchor across ALL entries (not just this pattern) — the caller
 * computes it; we defensively floor it at this pattern's own lastSeen.
 */
export function deriveLifecycleSignals(
  evidence: PatternEvidenceItem[],
  globalActivityAt: number,
  now: number,
): LifecycleSignals {
  const anchors = evidence.map(anchorTs).sort((a, b) => a - b);
  const entryCount = anchors.length;

  if (entryCount === 0) {
    return {
      entryCount: 0,
      firstSeen: now,
      lastSeen: now,
      ageDays: 0,
      recentCount: 0,
      priorCount: 0,
      maxGapDays: 0,
      daysSinceLastSeen: 0,
      daysSinceGlobalActivity: daysBetween(now, globalActivityAt),
      strength: 0,
      hasTimeSpread: false,
    };
  }

  const firstSeen = anchors[0];
  const lastSeen = anchors[anchors.length - 1];
  const recentCutoff = now - RECENT_WINDOW_DAYS * DAY_MS;

  let recentCount = 0;
  let strength = 0;
  for (const ts of anchors) {
    if (ts >= recentCutoff) recentCount += 1;
    strength += 0.5 ** (daysBetween(now, ts) / HALF_LIFE_DAYS);
  }

  let maxGapDays = 0;
  for (let i = 1; i < anchors.length; i += 1) {
    const gap = daysBetween(anchors[i], anchors[i - 1]);
    if (gap > maxGapDays) maxGapDays = gap;
  }

  return {
    entryCount,
    firstSeen,
    lastSeen,
    ageDays: daysBetween(now, firstSeen),
    recentCount,
    priorCount: entryCount - recentCount,
    maxGapDays,
    daysSinceLastSeen: daysBetween(now, lastSeen),
    daysSinceGlobalActivity: daysBetween(now, Math.max(globalActivityAt, lastSeen)),
    strength,
    hasTimeSpread: daysBetween(lastSeen, firstSeen) > RECENT_WINDOW_DAYS,
  };
}

/**
 * The decision ladder — first match wins. Order matters: `resting` precedes
 * `weakening` so absence never reads as decline; `returning` precedes
 * `emerging`/`strengthening` because a return also looks like new momentum.
 */
export function classifyRaw(s: LifecycleSignals): Lifecycle {
  if (s.daysSinceGlobalActivity > RECENT_WINDOW_DAYS) return "resting";

  if (
    s.maxGapDays >= RETURN_GAP_DAYS &&
    s.recentCount >= 1 &&
    s.recentCount <= RETURNING_MAX_RECENT &&
    s.priorCount >= 1
  ) {
    return "returning";
  }

  if (
    s.ageDays <= RECENT_WINDOW_DAYS &&
    s.entryCount < SURFACE_MIN_ENTRIES
  ) {
    return "emerging";
  }

  if (s.recentCount < s.priorCount && s.daysSinceLastSeen > RECENT_WINDOW_DAYS) {
    return "weakening";
  }

  if (s.recentCount >= 2 && s.recentCount >= s.priorCount) return "strengthening";

  return "strong";
}

/**
 * Dwell-based hysteresis: a stage that has been held for less than
 * MIN_DWELL_DAYS cannot be replaced yet. Prevents the same few evidence points
 * from flip-flopping the pattern's life stage across reloads.
 */
export function applyHysteresis(
  prev: PatternState | null,
  raw: Lifecycle,
  now: number,
): Lifecycle {
  if (!prev) return raw;
  if (raw === prev.lifecycle) return prev.lifecycle;

  // Graduate out of emerging immediately once depth supports voice shapes —
  // don't hold evidence-only for the full dwell window.
  if (
    prev.lifecycle === "emerging" &&
    (raw === "strengthening" || raw === "strong")
  ) {
    return raw;
  }

  const dwellDays = daysBetween(now, prev.lifecycleSince);
  return dwellDays < MIN_DWELL_DAYS ? prev.lifecycle : raw;
}

/**
 * Full classification: signals → raw stage → hysteresis. Returns the signals
 * too so the planner can reuse them without recomputing.
 */
export function classifyLifecycle(
  evidence: PatternEvidenceItem[],
  globalActivityAt: number,
  prev: PatternState | null,
  now: number,
  options?: { skipHysteresis?: boolean },
): { lifecycle: Lifecycle; signals: LifecycleSignals } {
  const signals = deriveLifecycleSignals(evidence, globalActivityAt, now);
  const raw = classifyRaw(signals);
  const lifecycle =
    options?.skipHysteresis === true
      ? raw
      : applyHysteresis(prev, raw, now);
  return { lifecycle, signals };
}
