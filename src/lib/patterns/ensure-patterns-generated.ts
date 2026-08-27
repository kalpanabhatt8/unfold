"use client";

/**
 * Client-side pattern generation — mirrors what worked from the console:
 * POST /api/patterns/rebuild (awaits server completion), then read /ready.
 * Dedupes concurrent rebuild requests per tab.
 */

import { PATTERN_GENERATION_MIN_SEALED_ENTRIES } from "@/lib/patterns/generation-gate-public";
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
  const response = await fetch("/api/patterns/ready");
  if (!response.ok) return null;
  return (await response.json()) as ReadyPatternsResponse;
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
  if (inflightRebuild) return inflightRebuild;

  inflightRebuild = (async () => {
    try {
      const response = await fetch("/api/patterns/rebuild", { method: "POST" });
      if (!response.ok) return false;
      const body = (await response.json()) as { ok?: boolean };
      return body.ok === true;
    } catch {
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
  let payload = await fetchReadyPatterns();
  if (!payload || !isEligibleForPatternGeneration(payload)) return payload;
  await requestPatternRebuild();
  return fetchReadyPatterns();
};

/** Background kick during sync — never blocks the sync pass. */
export const kickPatternGenerationInBackground = (): void => {
  void (async () => {
    const payload = await fetchReadyPatterns();
    if (!payload || !isEligibleForPatternGeneration(payload)) return;
    await requestPatternRebuild();
  })();
};
