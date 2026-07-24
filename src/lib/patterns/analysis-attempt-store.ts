/**
 * Durable per-entry analysis attempt records - localStorage, same persistence
 * class as `unfold-entry-analyses` (survives reload; shared across tabs).
 *
 * Retry policy:
 * - `startedAt` is written synchronously before any await.
 * - `outcome: "fail"` is an optional fast-path to retry sooner.
 * - The sole guaranteed unlock is stale age: now - startedAt >= ATTEMPT_STALE_MS
 *   (covers tab close / crash where no outcome is ever written).
 */

import "@/lib/storage-namespace";

export const ANALYSIS_ATTEMPTS_STORAGE_KEY = "unfold-analysis-attempts";

/**
 * Comfortably above worst-case client pipeline (~12s × 3 ≈ 36s), without
 * leaving a genuinely stuck entry unrecoverable too long.
 */
export const ATTEMPT_STALE_MS = 90_000;

export type AnalysisAttemptOutcome = "fail" | "ok";

export type AnalysisAttempt = {
  /** Wall-clock ms when this attempt began (sync write before any await). */
  startedAt: number;
  /**
   * Optional. `"fail"` = fast-path retry. `"ok"` = analysis stored (settled).
   * Absent = in flight or abandoned mid-request (unlocks only via stale age).
   */
  outcome?: AnalysisAttemptOutcome;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const readAll = (): Record<string, AnalysisAttempt> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ANALYSIS_ATTEMPTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return {};
    const out: Record<string, AnalysisAttempt> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!isRecord(value)) continue;
      const startedAt = value.startedAt;
      if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) continue;
      const attempt: AnalysisAttempt = { startedAt };
      if (value.outcome === "fail" || value.outcome === "ok") {
        attempt.outcome = value.outcome;
      }
      out[id] = attempt;
    }
    return out;
  } catch {
    return {};
  }
};

const writeAll = (map: Record<string, AnalysisAttempt>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ANALYSIS_ATTEMPTS_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    /* private mode / quota - best effort */
  }
};

export const getAnalysisAttempt = (
  entryId: string,
): AnalysisAttempt | null => readAll()[entryId] ?? null;

/**
 * Whether a new analysis call may start for this entryId.
 *
 * Allow when: no attempt yet (first try), OR outcome === "fail" (fast path),
 * OR startedAt is older than ATTEMPT_STALE_MS (sole guaranteed unlock).
 * Deny when a recent attempt has no fail outcome (in progress / too soon).
 */
export function isAnalysisAttemptAllowed(
  entryId: string,
  now: number = Date.now(),
): boolean {
  const attempt = getAnalysisAttempt(entryId);
  if (!attempt) return true;
  if (attempt.outcome === "fail") return true;
  if (attempt.outcome === "ok") return false;
  return now - attempt.startedAt >= ATTEMPT_STALE_MS;
}

/** Sync - call before any await. Clears prior outcome (new attempt in flight). */
export function markAnalysisAttemptStarted(
  entryId: string,
  now: number = Date.now(),
): void {
  if (!entryId) return;
  const map = readAll();
  map[entryId] = { startedAt: now };
  writeAll(map);
}

/** Optional fast-path - next reconcile may retry without waiting for stale. */
export function markAnalysisAttemptFailed(entryId: string): void {
  if (!entryId) return;
  const map = readAll();
  const prev = map[entryId];
  map[entryId] = {
    startedAt: prev?.startedAt ?? Date.now(),
    outcome: "fail",
  };
  writeAll(map);
}

/** Settled successfully (analysis stored) - do not retry. */
export function markAnalysisAttemptOk(entryId: string): void {
  if (!entryId) return;
  const map = readAll();
  const prev = map[entryId];
  map[entryId] = {
    startedAt: prev?.startedAt ?? Date.now(),
    outcome: "ok",
  };
  writeAll(map);
}

/** Drop attempt (e.g. terminal crisis/quality skip after startedAt was written). */
export function clearAnalysisAttempt(entryId: string): void {
  if (!entryId) return;
  const map = readAll();
  if (!(entryId in map)) return;
  delete map[entryId];
  writeAll(map);
}
