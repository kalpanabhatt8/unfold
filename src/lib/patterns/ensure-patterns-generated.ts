"use client";

/**
 * Client-side pattern generation — POST /api/patterns/rebuild then read /ready.
 * Dedupes concurrent rebuild requests per tab.
 */

import { PATTERN_GENERATION_MIN_SEALED_ENTRIES } from "@/lib/patterns/generation-gate-public";
import {
  inferEmptyReason,
  logPatternsCheckpoint,
  snapshotFromReady,
} from "@/lib/patterns/patterns-debug";
import type { SurfacedPattern } from "@/lib/patterns/types";
import type { hydratePatternArtifactsFromSnapshot } from "@/lib/sync/sync-client";

export type ReadyPatternsResponse = {
  patterns?: SurfacedPattern[];
  snapshot?: {
    states: Parameters<typeof hydratePatternArtifactsFromSnapshot>[0]["states"];
    passages: Parameters<typeof hydratePatternArtifactsFromSnapshot>[0]["passages"];
    displays: Parameters<typeof hydratePatternArtifactsFromSnapshot>[0]["displays"];
  };
  meta?: { states: number; passages: number; displays: number };
  debug?: { userId: string; sealedEntryCount: number; analysisCount: number };
};

export type PatternRebuildResult = {
  ok: boolean;
  reason?: string;
  message?: string;
};

export const fetchReadyPatterns = async (): Promise<ReadyPatternsResponse | null> => {
  try {
    const response = await fetch("/api/patterns/ready");
    if (!response.ok) {
      logPatternsCheckpoint("ready:failed", { status: response.status });
      return null;
    }
    const payload = (await response.json()) as ReadyPatternsResponse;
    logPatternsCheckpoint("ready:fetch", snapshotFromReady(payload));
    return payload;
  } catch (error) {
    logPatternsCheckpoint("ready:failed", { error: String(error) });
    return null;
  }
};

/** True when a rebuild might still produce patterns (not yet analyzed, or not tried). */
export const isEligibleForPatternGeneration = (
  payload: ReadyPatternsResponse,
): boolean => {
  const sealedCount = payload.debug?.sealedEntryCount ?? 0;
  const analysisCount = payload.debug?.analysisCount ?? 0;
  const patternCount = payload.patterns?.length ?? 0;
  const displays = payload.meta?.displays ?? 0;

  if (patternCount > 0 || displays > 0) return false;
  if (sealedCount < PATTERN_GENERATION_MIN_SEALED_ENTRIES) return false;

  // All sealed entries analyzed — further rebuilds won't help until new seals.
  if (
    analysisCount >= sealedCount &&
    inferEmptyReason(payload) === "aggregation_no_surface"
  ) {
    return false;
  }

  return true;
};

let inflightRebuild: Promise<PatternRebuildResult> | null = null;

/** Runs analysis + artifact generation on the server; one in-flight call per tab. */
export const requestPatternRebuild = (): Promise<PatternRebuildResult> => {
  if (inflightRebuild) {
    logPatternsCheckpoint("rebuild:join_inflight");
    return inflightRebuild;
  }

  logPatternsCheckpoint("rebuild:start");

  inflightRebuild = (async () => {
    try {
      const response = await fetch("/api/patterns/rebuild", { method: "POST" });
      if (!response.ok) {
        logPatternsCheckpoint("rebuild:failed", { status: response.status });
        return { ok: false, reason: "http_error" };
      }
      const body = (await response.json()) as PatternRebuildResult;
      logPatternsCheckpoint("rebuild:done", {
        ok: body.ok === true,
        reason: body.reason,
        message: body.message,
      });
      return body;
    } catch (error) {
      logPatternsCheckpoint("rebuild:failed", { error: String(error) });
      return { ok: false, reason: "network_error" };
    }
  })().finally(() => {
    inflightRebuild = null;
  });

  return inflightRebuild;
};

/**
 * If the account qualifies but has no ready patterns, run rebuild then re-fetch.
 */
export const ensurePatternsOnServer = async (): Promise<{
  payload: ReadyPatternsResponse | null;
  rebuild: PatternRebuildResult | null;
}> => {
  const payload = await fetchReadyPatterns();
  if (!payload || !isEligibleForPatternGeneration(payload)) {
    return { payload, rebuild: null };
  }
  const rebuild = await requestPatternRebuild();
  const after = await fetchReadyPatterns();
  return { payload: after, rebuild };
};

/** Background kick during sync — never blocks the sync pass. */
export const kickPatternGenerationInBackground = (): void => {
  void (async () => {
    const payload = await fetchReadyPatterns();
    if (!payload) return;
    if (!isEligibleForPatternGeneration(payload)) {
      logPatternsCheckpoint("sync:kick_skip", {
        ...snapshotFromReady(payload),
        emptyReason: inferEmptyReason(payload),
      });
      return;
    }
    logPatternsCheckpoint("sync:kick", snapshotFromReady(payload));
    await requestPatternRebuild();
  })();
};
