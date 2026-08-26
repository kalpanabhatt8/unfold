/**
 * Unfold - entry completion triggers (client fallback stubs).
 *
 * Pattern extraction, crisis/quality gates, and artifact generation run on
 * the server when sealed entries sync. The browser only reads synced results.
 */

import type { CompletionSource } from "@/lib/patterns/types";

/** Server owns analysis — browser no-op. */
export async function notifyEntryCompleted(
  _entryId: string,
  _source: CompletionSource,
): Promise<void> {}

/** Server owns backfill — browser no-op. */
export async function reconcileAnalyses(): Promise<void> {}

export async function sealIdleEligibleEntries(): Promise<void> {}

export const IMPLICIT_SEAL_INACTIVITY_MS = 24 * 60 * 60 * 1000;
export const IMPLICIT_SEAL_MIN_WORDS = 50;

export function getImplicitSealInactivityMs(): number {
  return IMPLICIT_SEAL_INACTIVITY_MS;
}

export function isIdleEligibleForAutoSeal(_entry: {
  id: string;
  sealedAt?: number | null;
}): boolean {
  return false;
}

export function isAnalysisEligible(entry: {
  sealedAt?: number | null;
}): boolean {
  return typeof entry.sealedAt === "number";
}

function lastActivityAt(entry: {
  lastEditedAt?: number;
  updatedAt: number;
}): number {
  return entry.lastEditedAt ?? entry.updatedAt;
}

export { lastActivityAt };
