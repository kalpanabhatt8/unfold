"use client";

/**
 * Live Patterns page checkpoints — console visibility for prod debugging.
 * Filter DevTools console with `[patterns]`.
 */

import type { PatternsPagePhase } from "@/lib/patterns/pattern-list-phase";
import type { SurfacedPattern } from "@/lib/patterns/types";

const PREFIX = "[patterns]";

export type PatternsReadySnapshot = {
  patterns?: SurfacedPattern[];
  meta?: { states: number; passages: number; displays: number };
  debug?: { userId: string; sealedEntryCount: number; analysisCount: number };
};

export type PatternsCheckpoint =
  | "hydrate:done"
  | "ready:fetch"
  | "ready:failed"
  | "eligible"
  | "not_eligible"
  | "rebuild:start"
  | "rebuild:done"
  | "rebuild:failed"
  | "rebuild:join_inflight"
  | "sync:kick"
  | "sync:kick_skip"
  | "poll"
  | "phase"
  | "error";

export const logPatternsCheckpoint = (
  checkpoint: PatternsCheckpoint,
  detail?: Record<string, unknown>,
): void => {
  if (typeof window === "undefined") return;
  console.info(`${PREFIX} ${checkpoint}`, detail ?? {});
};

export const snapshotFromReady = (
  payload: PatternsReadySnapshot | null,
  extras?: Record<string, unknown>,
): Record<string, unknown> => {
  if (!payload) return { ...extras, ready: null };
  return {
    ...extras,
    userId: payload.debug?.userId,
    sealedEntryCount: payload.debug?.sealedEntryCount ?? 0,
    analysisCount: payload.debug?.analysisCount ?? 0,
    remoteCount: payload.patterns?.length ?? 0,
    meta: payload.meta ?? null,
  };
};

/** Why the UI may show empty despite sealed entries. */
export const inferEmptyReason = (
  payload: PatternsReadySnapshot,
): string | null => {
  const sealed = payload.debug?.sealedEntryCount ?? 0;
  const analyses = payload.debug?.analysisCount ?? 0;
  const remote = payload.patterns?.length ?? 0;
  const displays = payload.meta?.displays ?? 0;

  if (remote > 0 || displays > 0) return null;
  if (sealed < 5) return "under_entry_threshold";
  if (analyses === 0) return "awaiting_analysis";
  if (analyses > 0 && sealed >= 5) {
    return "aggregation_no_surface";
  }
  return "unknown";
};

export const logPatternsPhase = (args: {
  phase: PatternsPagePhase;
  localCount: number;
  remoteCount: number;
  serverGenerating: boolean;
  payload: PatternsReadySnapshot | null;
}): void => {
  const snap = snapshotFromReady(args.payload, {
    phase: args.phase,
    localCount: args.localCount,
    remoteCount: args.remoteCount,
    serverGenerating: args.serverGenerating,
  });
  const emptyReason =
    args.payload && args.phase === "empty"
      ? inferEmptyReason(args.payload)
      : null;
  console.info(PREFIX, {
    ...snap,
    ...(emptyReason ? { emptyReason } : {}),
  });
};
