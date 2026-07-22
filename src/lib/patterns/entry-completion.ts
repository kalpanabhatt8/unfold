/**
 * Unfold — the generic "entry completion" trigger.
 *
 * The analysis pipeline listens here and is agnostic to WHAT completed an
 * entry. V1 wires `"seal"` (explicit) and `"inactivity"` (implicit: 24h idle
 * + 50+ words — analysis-only, entry stays unsealed in the UI).
 *
 * Ordering: crisis check → content-quality check → pattern extraction.
 * Either gate skip extraction entirely when flagged.
 *
 * V1 idempotency = existence: one analysis per entryId, ever. (When a
 * pre-final trigger is introduced later, add a content hash here so edited
 * drafts re-analyze.)
 */

import { fetchCrisisRisk } from "@/lib/ai/crisis-risk/client";
import { fetchContentQuality } from "@/lib/ai/content-quality/client";
import { shouldSkipPatternExtractionForQuality } from "@/lib/ai/content-quality/constants";
import { fetchEntryAnalysis } from "@/lib/ai/pattern-extraction/client";
import { contentHash } from "@/lib/content-hash";
import {
  readEntryById,
  readAllEntries,
  upsertEntry,
  type JournalEntry,
} from "@/lib/journal-entries";
import { hasAnalysis, putAnalysis } from "@/lib/patterns/analysis-store";
import { countWords, readEntryText } from "@/lib/patterns/entry-text";
import type { CompletionSource } from "@/lib/patterns/types";

/** Idle time before an unsealed draft counts as complete for patterns only. */
export const IMPLICIT_SEAL_INACTIVITY_MS = 24 * 60 * 60 * 1000;

/** Minimum words for the inactivity trigger (same ballpark as a real entry). */
export const IMPLICIT_SEAL_MIN_WORDS = 50;

/**
 * Resolve idle threshold for implicit analysis.
 *
 * Production always uses 24h. In development only, you can shorten it to
 * exercise the inactivity path without waiting a day:
 *
 *   NEXT_PUBLIC_IMPLICIT_SEAL_INACTIVITY_MS=120000   # 2 minutes (restart next)
 *   // or, in the browser console (no restart):
 *   window.__UNFOLD_IMPLICIT_SEAL_INACTIVITY_MS__ = 120_000
 */
export function getImplicitSealInactivityMs(): number {
  if (process.env.NODE_ENV !== "development") {
    return IMPLICIT_SEAL_INACTIVITY_MS;
  }

  if (typeof window !== "undefined") {
    const runtime = (
      window as Window & { __UNFOLD_IMPLICIT_SEAL_INACTIVITY_MS__?: number }
    ).__UNFOLD_IMPLICIT_SEAL_INACTIVITY_MS__;
    if (
      typeof runtime === "number" &&
      Number.isFinite(runtime) &&
      runtime > 0
    ) {
      return runtime;
    }
  }

  const raw = process.env.NEXT_PUBLIC_IMPLICIT_SEAL_INACTIVITY_MS;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return IMPLICIT_SEAL_INACTIVITY_MS;
}

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
  if (Date.now() - lastActivityAt(entry) < getImplicitSealInactivityMs()) {
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
  source: CompletionSource,
): Promise<void> {
  if (!entryId || hasAnalysis(entryId) || inflight.has(entryId)) return;

  inflight.add(entryId);
  try {
    const entry = readEntryById(entryId);
    if (entry?.crisisFlagged === true) return;
    if (entry?.qualityFlagged === true) return;

    const text = readEntryText(entryId);
    if (!text.trim()) return;

    // Crisis gate — separate classification step before any pattern extraction.
    // Fail open: API failure/timeout → treat as unflagged, log for monitoring.
    const crisis = await fetchCrisisRisk(text);
    if (crisis === null) {
      console.error("[crisis-risk] classify_failed", {
        entryId,
        at: Date.now(),
        path: source,
        reason: "client_null",
      });
    } else if (crisis.flagged === true) {
      const at = Date.now();
      upsertEntry(entryId, {
        crisisFlagged: true,
        crisisFlaggedAt: at,
        updatedAt: at,
      });
      console.info("[crisis-risk]", {
        flagged: true,
        entryId,
        at,
        path: source,
      });
      return; // do not call fetchEntryAnalysis / putAnalysis
    } else {
      console.info("[crisis-risk]", {
        flagged: false,
        entryId,
        at: Date.now(),
        path: source,
      });
    }

    // Content-quality gate — after crisis, before pattern extraction.
    // Fail open: API failure/timeout → treat as unflagged, log for monitoring.
    // Under-flag: only skip when flagged AND confidence ≥ floor.
    const quality = await fetchContentQuality(text);
    if (quality === null) {
      console.error("[content-quality] classify_failed", {
        entryId,
        at: Date.now(),
        path: source,
        reason: "client_null",
      });
    } else if (shouldSkipPatternExtractionForQuality(quality)) {
      const at = Date.now();
      upsertEntry(entryId, {
        qualityFlagged: true,
        qualityFlaggedAt: at,
        updatedAt: at,
      });
      console.info("[content-quality]", {
        flagged: true,
        confidence: quality.confidence,
        entryId,
        at,
        path: source,
      });
      return; // do not call fetchEntryAnalysis / putAnalysis
    } else {
      console.info("[content-quality]", {
        flagged: false,
        confidence: quality.confidence,
        entryId,
        at: Date.now(),
        path: source,
      });
    }

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
 *
 * Skips crisis- and quality-flagged entries so they never enter pattern extraction.
 */
export async function reconcileAnalyses(): Promise<void> {
  const pending = readAllEntries()
    .filter((entry) => entry.crisisFlagged !== true)
    .filter((entry) => entry.qualityFlagged !== true)
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
