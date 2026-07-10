/**
 * Unfold — the generic "entry completion" trigger.
 *
 * The analysis pipeline listens here and is agnostic to WHAT completed an
 * entry. V1 wires `"seal"` (explicit) and `"inactivity"` (implicit: 24h idle
 * + 50+ words — analysis-only, entry stays unsealed in the UI).
 *
 * V1 idempotency = existence: one analysis per entryId, ever. (When a
 * pre-final trigger is introduced later, add a content hash here so edited
 * drafts re-analyze.)
 */

import { readAllEntries, type JournalEntry } from "@/lib/journal-entries";
import type { CompletionSource } from "@/lib/patterns/types";
import { hasAnalysis, putAnalysis } from "@/lib/patterns/analysis-store";
import { countWords, readEntryText } from "@/lib/patterns/entry-text";
import { fetchEntryAnalysis } from "@/lib/ai/pattern-extraction/client";
import { contentHash } from "@/lib/content-hash";

/** Idle time before an unsealed draft counts as complete for patterns only. */
export const IMPLICIT_SEAL_INACTIVITY_MS = 24 * 60 * 60 * 1000;

/** Minimum words for the inactivity trigger (same ballpark as a real entry). */
export const IMPLICIT_SEAL_MIN_WORDS = 50;

const lastActivityAt = (entry: JournalEntry): number =>
  entry.lastEditedAt ?? entry.updatedAt;

export const isExplicitlySealed = (entry: JournalEntry): boolean =>
  typeof entry.sealedAt === "number";

/**
 * Unsealed draft that has sat untouched long enough with enough text to
 * analyze. Does not set `sealedAt` — the user still sees an open draft.
 */
export const isImplicitlySealedForAnalysis = (entry: JournalEntry): boolean => {
  if (isExplicitlySealed(entry)) return false;
  if (Date.now() - lastActivityAt(entry) < IMPLICIT_SEAL_INACTIVITY_MS) {
    return false;
  }
  return countWords(readEntryText(entry.id)) >= IMPLICIT_SEAL_MIN_WORDS;
};

/** Whether pattern analysis may run for this entry (explicit or implicit seal). */
export const isAnalysisEligible = (entry: JournalEntry): boolean =>
  isExplicitlySealed(entry) || isImplicitlySealedForAnalysis(entry);

const completionSourceFor = (entry: JournalEntry): CompletionSource =>
  isExplicitlySealed(entry) ? "seal" : "inactivity";

/** In-flight guard so a rapid double-fire never double-calls the model. */
const inflight = new Set<string>();

/** Backfill batch cap per invocation — keeps cost bounded. */
const RECONCILE_BATCH_LIMIT = 5;

/** Analyze one completed entry (once). Silent on skip/failure. */
export async function notifyEntryCompleted(
  entryId: string,
  _source: CompletionSource,
): Promise<void> {
  if (!entryId || hasAnalysis(entryId) || inflight.has(entryId)) return;

  inflight.add(entryId);
  try {
    const text = readEntryText(entryId);
    if (!text.trim()) return;

    const payload = await fetchEntryAnalysis(text);
    if (!payload) return; // failure → not stored → retried by reconciler later

    putAnalysis({ entryId, sourceContentHash: contentHash(text), ...payload });
  } catch (error) {
    console.error("Entry completion analysis failed", error);
  } finally {
    inflight.delete(entryId);
  }
}

/**
 * Self-healing backfill: analyze completed entries missing analysis — explicitly
 * sealed, or implicitly sealed (24h idle + 50+ words). Rate-limited and
 * sequential to keep token cost predictable.
 */
export async function reconcileAnalyses(): Promise<void> {
  const pending = readAllEntries()
    .filter((entry) => isAnalysisEligible(entry))
    .filter((entry) => !hasAnalysis(entry.id))
    .sort((a, b) => {
      const aExplicit = isExplicitlySealed(a) ? 0 : 1;
      const bExplicit = isExplicitlySealed(b) ? 0 : 1;
      if (aExplicit !== bExplicit) return aExplicit - bExplicit;
      return lastActivityAt(a) - lastActivityAt(b);
    })
    .slice(0, RECONCILE_BATCH_LIMIT);

  for (const entry of pending) {
    await notifyEntryCompleted(entry.id, completionSourceFor(entry));
  }
}
