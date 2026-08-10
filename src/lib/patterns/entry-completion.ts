/**
 * Unfold - the generic "entry completion" trigger.
 *
 * The analysis pipeline listens here and is agnostic to WHAT completed an
 * entry. V1 wires `"seal"` (explicit) and `"inactivity"` (implicit: 24h idle
 * + 50+ words - analysis-only, entry stays unsealed in the UI).
 *
 * Ordering: crisis check → content-quality check → pattern extraction.
 * Either gate skip extraction entirely when flagged.
 *
 * Idempotency = current provenance: skip when an analysis already exists for
 * this entry with matching content hash AND current extraction promptVersion.
 * Content edits or prompt/catalog bumps re-analyze.
 *
 * Attempt durability: `analysis-attempt-store` records startedAt before any
 * await. Retries require outcome "fail" (fast path) or startedAt older than
 * ATTEMPT_STALE_MS (sole unlock for tab-close / crash with no outcome).
 */

import { fetchCrisisRisk } from "@/lib/ai/crisis-risk/client";
import { fetchContentQuality } from "@/lib/ai/content-quality/client";
import { shouldSkipPatternExtractionForQuality } from "@/lib/ai/content-quality/constants";
import { fetchEntryAnalysisDetailed } from "@/lib/ai/pattern-extraction/client";
import {
  readEntryById,
  readAllEntries,
  upsertEntry,
  type JournalEntry,
} from "@/lib/journal-entries";
import {
  clearAnalysisAttempt,
  isAnalysisAttemptAllowed,
  markAnalysisAttemptFailed,
  markAnalysisAttemptOk,
  markAnalysisAttemptStarted,
} from "@/lib/patterns/analysis-attempt-store";
import {
  extractionProvenance,
  isAnalysisCurrent,
} from "@/lib/patterns/analysis-freshness";
import { getAnalysis, putAnalysis } from "@/lib/patterns/analysis-store";
import { canUsePatternPipelineDebugClient } from "@/lib/patterns/pattern-pipeline-debug-access";
import { putPipelineDebug } from "@/lib/patterns/pattern-pipeline-debug-store";
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
 * analyze. Does not set `sealedAt` - the user still sees an open draft.
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

/** Backfill batch cap per invocation - keeps cost bounded. */
const RECONCILE_BATCH_LIMIT = 5;

/** Analyze one completed entry (once). Silent on skip/failure. */
export async function notifyEntryCompleted(
  entryId: string,
  source: CompletionSource,
): Promise<void> {
  if (!entryId || inflight.has(entryId)) return;

  const entry = readEntryById(entryId);
  if (entry?.crisisFlagged === true) return;
  if (entry?.qualityFlagged === true) return;

  const text = readEntryText(entryId);
  if (!text.trim()) return;

  const existing = getAnalysis(entryId);
  if (existing && isAnalysisCurrent(existing, text)) return;

  // Durable gate - deny while a recent attempt has no fail outcome (in flight
  // or abandoned < ATTEMPT_STALE_MS). Survives reload / other tabs.
  if (!isAnalysisAttemptAllowed(entryId)) return;

  // Claim same-tab lock before writing attempt / awaiting - #1 and #2 can race.
  inflight.add(entryId);
  // Sync write before any await - abandoned tabs unlock only via stale age.
  markAnalysisAttemptStarted(entryId);

  try {
    // Crisis gate - separate classification step before any pattern extraction.
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
      // Terminal skip - drop attempt so we don't stale-retry into the same flag.
      clearAnalysisAttempt(entryId);
      return; // do not call fetchEntryAnalysis / putAnalysis
    } else {
      console.info("[crisis-risk]", {
        flagged: false,
        entryId,
        at: Date.now(),
        path: source,
      });
    }

    // Content-quality gate - after crisis, before pattern extraction.
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
      clearAnalysisAttempt(entryId);
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

    // TEMPORARY — capture raw LLM + validation/arbitration in localStorage for
    // /dashboard/pattern-debug. Product analysis payload is unchanged.
    const captureDebug = canUsePatternPipelineDebugClient();
    const detailed = await fetchEntryAnalysisDetailed(text, {
      debug: captureDebug,
    });
    const payload = detailed.analysis;
    if (captureDebug && detailed.debug) {
      putPipelineDebug({
        entryId,
        capturedAt: Date.now(),
        source: "live_extraction",
        extraction: detailed.debug,
        requestFinalAnalysis: payload
          ? {
              topics: payload.topics,
              patterns: payload.patterns,
            }
          : null,
        failureReason: detailed.failureReason,
      });
    }
    if (!payload) {
      // Optional fast-path - reconciler may retry before stale timeout.
      markAnalysisAttemptFailed(entryId);
      return;
    }

    putAnalysis({ entryId, ...extractionProvenance(text), ...payload });
    markAnalysisAttemptOk(entryId);
  } catch (error) {
    console.error("Entry completion analysis failed", error);
    markAnalysisAttemptFailed(entryId);
  } finally {
    inflight.delete(entryId);
  }
}

/**
 * Self-healing backfill: analyze completed entries that are missing analysis
 * or whose analysis is stale (promptVersion / content hash). Explicitly sealed,
 * or implicitly sealed (24h idle + 50+ words). Rate-limited and sequential.
 *
 * Skips crisis- and quality-flagged entries so they never enter pattern extraction.
 */
export async function reconcileAnalyses(): Promise<void> {
  const needsExtraction = (entry: JournalEntry): boolean => {
    const text = readEntryText(entry.id);
    if (!text.trim()) return false;
    const existing = getAnalysis(entry.id);
    return !existing || !isAnalysisCurrent(existing, text);
  };

  const pending = readAllEntries()
    .filter((entry) => entry.crisisFlagged !== true)
    .filter((entry) => entry.qualityFlagged !== true)
    .filter((entry) => isAnalysisEligible(entry))
    .filter(needsExtraction)
    .filter((entry) => isAnalysisAttemptAllowed(entry.id))
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
