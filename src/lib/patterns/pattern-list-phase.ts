/**
 * Patterns page phase — separate loading, syncing, ready, and empty states.
 *
 * "No patterns yet" is only shown in the `empty` phase. Never while artifacts
 * are still hydrating or voice/titles are still generating on synced rows.
 */

import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import {
  hasSyncedPatternWorkInProgress,
  listServerReadyPatterns,
} from "@/lib/patterns/server-ready-patterns";
import type { PatternsAggregate } from "@/lib/patterns/types";
import {
  getLastPatternsPullMeta,
  hasPatternsMetaHydrated,
  hasPatternsPullAttempted,
  hasPatternsPullSucceeded,
} from "@/lib/sync/sync-client";

export type PatternsPagePhase = "loading" | "syncing" | "ready" | "empty";

export const resolvePatternsPagePhase = (
  aggregate: PatternsAggregate | null,
): PatternsPagePhase => {
  if (aggregate === null) return "loading";
  if (!hasPatternsMetaHydrated()) return "loading";

  if (listServerReadyPatterns().length > 0) return "ready";

  if (!hasPatternsPullAttempted() || !hasPatternsPullSucceeded()) {
    return "loading";
  }

  const pullMeta = getLastPatternsPullMeta();
  if (
    pullMeta &&
    (pullMeta.passages > 0 || pullMeta.displays > 0) &&
    listServerReadyPatterns().length === 0
  ) {
    // Server reported artifacts but local caches did not surface them yet.
    return "syncing";
  }

  if (hasSyncedPatternWorkInProgress()) return "syncing";

  return "empty";
};

/** Visible list — server artifacts first; aggregate fallback for same-session local gen. */
export const listVisiblePatterns = (): ReturnType<
  typeof listServerReadyPatterns
> => {
  const fromServer = listServerReadyPatterns();
  if (fromServer.length > 0) return fromServer;

  try {
    const { surfaced } = aggregateAnalyses();
    return surfaced.filter((row) => row.display != null);
  } catch {
    return [];
  }
};
