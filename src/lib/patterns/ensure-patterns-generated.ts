"use client";

/**
 * Client-side pattern generation — mirrors what worked from the console:
 * POST /api/patterns/rebuild (awaits server completion), then read /ready.
 * Dedupes concurrent rebuild requests per tab.
 */

import { PATTERN_GENERATION_MIN_SEALED_ENTRIES } from "@/lib/patterns/generation-gate-public";
import {
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

export const isEligibleForPatternGeneration = (
  payload: ReadyPatternsResponse,
): boolean => {
  const sealedCount = payload.debug?.sealedEntryCount ?? 0;
  const patternCount = payload.patterns?.length ?? 0;
  return (
    patternCount === 0 &&
    sealedCount >= PATTERN_GENERATION_MIN_SEALED_ENTRIES
  );
};

let inflightRebuild: Promise<boolean> | null = null;

/** Runs analysis + artifact generation on the server; one in-flight call per tab. */
export const requestPatternRebuild = (): Promise<boolean> => {
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
        return false;
      }
      const body = (await response.json()) as { ok?: boolean; message?: string };
      logPatternsCheckpoint("rebuild:done", {
        ok: body.ok === true,
        message: body.message,
      });
      return body.ok === true;
    } catch (error) {
      logPatternsCheckpoint("rebuild:failed", { error: String(error) });
      return false;
    }
  })().finally(() => {
    inflightRebuild = null;
  });

  return inflightRebuild;
};

/**
 * If the account qualifies but has no ready patterns, run rebuild then re-fetch.
 * Safe to call from sync or the Patterns page.
 */
export const ensurePatternsOnServer = async (): Promise<ReadyPatternsResponse | null> => {
  const payload = await fetchReadyPatterns();
  if (!payload || !isEligibleForPatternGeneration(payload)) return payload;
  await requestPatternRebuild();
  return fetchReadyPatterns();
};

/** Background kick during sync — never blocks the sync pass. */
export const kickPatternGenerationInBackground = (): void => {
  void (async () => {
    const payload = await fetchReadyPatterns();
    if (!payload) return;
    if (!isEligibleForPatternGeneration(payload)) {
      logPatternsCheckpoint("sync:kick_skip", snapshotFromReady(payload));
      return;
    }
    logPatternsCheckpoint("sync:kick", snapshotFromReady(payload));
    await requestPatternRebuild();
  })();
};
