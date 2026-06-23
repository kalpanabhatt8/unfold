"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import type { BlobEmotion } from "@/components/canvas/blob/types";
import {
  COMPANION_PAUSE_TRIGGER_MS,
  COMPANION_MIN_NEW_WORDS_FOR_EMOTION,
  COMPANION_SHORT_ENTRY_MAX_WORDS,
  COMPANION_DELETION_DEBOUNCE_MS,
  COMPANION_DELETION_REANALYZE_WORDS,
  COMPANION_LONG_WRITING_WORD_THRESHOLD,
  COMPANION_INACTIVITY_NEUTRAL_MS,
  COMPANION_POLL_INTERVAL_MS,
  COMPANION_PAUSE_REFLECTING_MS,
  COMPANION_INITIAL_ANALYSIS_MS,
  SLEEP_CANVAS_IDLE_MS,
} from "@/lib/companion-pause";
import {
  extractCompanionAnalyzeText,
  extractFullCanvasAnalyzeText,
  type CompanionAnalysis,
  type CompanionSessionMeta,
} from "@/lib/companion-analysis";
import { collectJournalWordTokens } from "@/lib/canvas-word-count";
import { isCompanionEmotion } from "@/lib/companion-emotions";
import { fetchCompanionAnalysis, warmCompanionRoute } from "@/lib/companion-fetch";
import { keywordFallback } from "@/lib/companion-local";

export const WRITING_SAVE_INACTIVITY_MS = COMPANION_PAUSE_REFLECTING_MS;

type AnalysisTrigger = "pause" | "long-writing" | "deletion" | "initial";

type WritingActivityOptions = {
  /** Word count from a live DOM snapshot (avoids stale React state). */
  wordCount?: number;
  /** Snapshot with live textarea / signature values merged in. */
  snapshot?: CanvasSnapshot;
};

function clearTimeoutRef(ref: React.MutableRefObject<number | null>) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

type UseCompanionOptions = {
  buildSnapshot: () => CanvasSnapshot;
  onMilestoneSave?: () => void;
  isContentReady?: boolean;
  /** Journal is sealed/stamped — session complete, companion rests (no logic). */
  isSealed?: boolean;
  blob?: {
    onCompanionPhase: (phase: "idle") => void;
    onCompanionAnalysis: (
      analysis: CompanionAnalysis,
      text: string,
      sessionMeta?: CompanionSessionMeta
    ) => void;
    onEmotionFromWriting: (emotion: BlobEmotion) => void;
    onWakeFromSleep: (opts?: { typing?: boolean }) => boolean;
    onCanvasEmpty?: () => void;
  };
};

export function useCompanion({
  buildSnapshot,
  onMilestoneSave,
  isContentReady = true,
  isSealed = false,
  blob,
}: UseCompanionOptions) {
  const buildSnapshotRef = useRef(buildSnapshot);
  const onMilestoneSaveRef = useRef(onMilestoneSave);
  const blobRef = useRef(blob);

  const isDirtyRef = useRef(false);
  const pendingAnalysisRef = useRef(false);
  const isSealedRef = useRef(false);
  /** One-shot guard — resume-draft analysis fires once per canvas load. */
  const resumeAnalysisStartedRef = useRef(false);

  const lastWordCountRef = useRef(0);
  const lastTypingTimeRef = useRef(0);
  /** Word count at last successful analysis — used for deletion threshold. */
  const wordsAtLastReactionRef = useRef(0);
  /** Baseline for pause / long-writing delta — resyncs after settled shrink. */
  const deltaBaselineRef = useRef(0);
  const pauseTriggeredRef = useRef(false);
  /** Freshest live snapshot + count from canvas notifications (DOM-merged). */
  const latestLiveSnapshotRef = useRef<CanvasSnapshot | null>(null);
  const latestLiveWordCountRef = useRef(0);
  /** Floor during an active deletion stretch — rejects stale upward reads. */
  const deletionFloorRef = useRef<number | null>(null);

  /** Monotonic id — only the latest analysis may apply its result. */
  const analysisGenerationRef = useRef(0);
  /** Freshest analysis intent queued while a request is in flight. */
  const queuedRunRef = useRef<{
    trigger: AnalysisTrigger;
    snapshot: CanvasSnapshot | null;
  } | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const inactivityNeutralTimerRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const deletionDebounceTimerRef = useRef<number | null>(null);

  buildSnapshotRef.current = buildSnapshot;
  onMilestoneSaveRef.current = onMilestoneSave;
  blobRef.current = blob;

  useEffect(() => {
    buildSnapshotRef.current = buildSnapshot;
    onMilestoneSaveRef.current = onMilestoneSave;
    blobRef.current = blob;
  }, [buildSnapshot, onMilestoneSave, blob]);

  const clearPollAndTimers = useCallback(() => {
    clearTimeoutRef(inactivityNeutralTimerRef);
    clearTimeoutRef(deletionDebounceTimerRef);
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const scheduleInactivityNeutral = useCallback(() => {
    clearTimeoutRef(inactivityNeutralTimerRef);
    inactivityNeutralTimerRef.current = window.setTimeout(() => {
      if (isSealedRef.current) return;
      console.log("[🌻 companion] 🌫️ 3min inactivity → neutral");
      blobRef.current?.onEmotionFromWriting("neutral");
    }, COMPANION_INACTIVITY_NEUTRAL_MS);
  }, []);

  const runAnalysis = useCallback(
    async (
      trigger: AnalysisTrigger,
      generation: number,
      snapshotOverride?: CanvasSnapshot
    ) => {
    if (isSealedRef.current) return;

    // Deletion + initial (resumed-draft load) both reclassify the whole canvas.
    const isDeletion = trigger === "deletion";
    const snapshot = snapshotOverride ?? buildSnapshotRef.current();
    const totalWords = collectJournalWordTokens(snapshot).length;
    const isShortEntry =
      trigger === "pause" && totalWords <= COMPANION_SHORT_ENTRY_MAX_WORDS;
    const isFullCanvas = isDeletion || trigger === "initial" || isShortEntry;
    const analysisBaseline = wordsAtLastReactionRef.current;
    const deltaBaseline = deltaBaselineRef.current;
    const text = isFullCanvas
      ? extractFullCanvasAnalyzeText(snapshot)
      : extractCompanionAnalyzeText(snapshot, deltaBaseline);
    if (!text.trim()) return;

    const newWords = totalWords - deltaBaseline;
    pendingAnalysisRef.current = true;

    console.log(
      `[🌻 companion] 🧠 runAnalysis #${generation} (${trigger}) | total: ${totalWords}w | analysing: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`
    );

    try {
      let analysis: CompanionAnalysis;
      let source: "claude" | "keyword";
      try {
        analysis = await fetchCompanionAnalysis(text);
        if (!isCompanionEmotion(analysis.emotion)) {
          throw new Error(`Invalid emotion: ${analysis.emotion}`);
        }
        source = "claude";
        console.log(
          `[🌻 companion] ✅ Claude → "${analysis.emotion}" (${analysis.confidence})`
        );
      } catch (err) {
        analysis = keywordFallback(text);
        source = "keyword";
        console.warn(
          `[🌻 companion] 🔤 Claude failed (${err instanceof Error ? err.message : String(err)}) → keyword: "${analysis.emotion}" (${analysis.confidence})`
        );
      }

      if (isSealedRef.current) return;

      // Stale-response guard: a newer analysis has superseded this one.
      if (generation !== analysisGenerationRef.current) {
        console.log(
          `[🌻 companion] ⏭️ stale analysis #${generation} ignored (latest #${analysisGenerationRef.current})`
        );
        return;
      }

      wordsAtLastReactionRef.current = totalWords;
      deltaBaselineRef.current = totalWords;
      lastWordCountRef.current = totalWords;
      deletionFloorRef.current = null;

      const sessionMeta: CompanionSessionMeta = {
        classificationStrategy: isDeletion
          ? "deletion"
          : trigger === "initial" || isShortEntry
            ? "initial"
            : "delta",
        newWordsSinceLastAnalysis: isFullCanvas ? totalWords : newWords,
        wordsRemoved: isDeletion
          ? Math.max(0, analysisBaseline - totalWords)
          : undefined,
        totalTextWords: totalWords,
        classifyTextWords: text.split(/\s+/).filter(Boolean).length,
      };

      console.log(`[🌻 companion] 📤 blob ← ${source} | "${analysis.emotion}"`);
      blobRef.current?.onCompanionAnalysis(analysis, text, sessionMeta);

      scheduleInactivityNeutral();
    } finally {
      pendingAnalysisRef.current = false;
      const queued = queuedRunRef.current;
      if (queued) {
        queuedRunRef.current = null;
        void runAnalysis(
          queued.trigger,
          analysisGenerationRef.current,
          queued.snapshot ?? undefined
        );
      }
    }
  },
  [scheduleInactivityNeutral]
);

  /**
   * Single entry point for all analysis triggers. Bumps the generation so any
   * in-flight (now-stale) request is discarded on completion; if a request is
   * already running, queues only the freshest intent to run next.
   */
  const requestAnalysis = useCallback(
    (trigger: AnalysisTrigger, snapshotOverride?: CanvasSnapshot) => {
      if (isSealedRef.current) return;
      const generation = ++analysisGenerationRef.current;
      if (pendingAnalysisRef.current) {
        queuedRunRef.current = { trigger, snapshot: snapshotOverride ?? null };
        return;
      }
      void runAnalysis(trigger, generation, snapshotOverride);
    },
    [runAnalysis]
  );

  const shouldTriggerAnalysis = useCallback(
    (pause: number, newWords: number, totalWords: number): boolean => {
      const pauseTrigger =
        pause >= COMPANION_PAUSE_TRIGGER_MS &&
        (newWords >= COMPANION_MIN_NEW_WORDS_FOR_EMOTION ||
          (totalWords > 0 && totalWords <= COMPANION_SHORT_ENTRY_MAX_WORDS));
      const longWritingTrigger =
        newWords >= COMPANION_LONG_WRITING_WORD_THRESHOLD;
      return pauseTrigger || longWritingTrigger;
    },
    []
  );

  const startPollInterval = useCallback(() => {
    if (pollIntervalRef.current !== null) return;

    pollIntervalRef.current = window.setInterval(() => {
      if (isSealedRef.current) return;
      if (pauseTriggeredRef.current) return;
      if (pendingAnalysisRef.current) return;

      const pause = Date.now() - lastTypingTimeRef.current;
      const snapshot = buildSnapshotRef.current();
      const currentWords = collectJournalWordTokens(snapshot).length;
      const newWords = currentWords - deltaBaselineRef.current;

      if (!shouldTriggerAnalysis(pause, newWords, currentWords)) return;

      const trigger: AnalysisTrigger =
        newWords >= COMPANION_LONG_WRITING_WORD_THRESHOLD &&
        pause < COMPANION_PAUSE_TRIGGER_MS
          ? "long-writing"
          : "pause";

      const shortEntry =
        trigger === "pause" &&
        currentWords <= COMPANION_SHORT_ENTRY_MAX_WORDS &&
        newWords < COMPANION_MIN_NEW_WORDS_FOR_EMOTION;

      console.log(
        `[🌻 companion] 🎯 ${trigger}${shortEntry ? " (short entry)" : ""} | paused ${(pause / 1000).toFixed(0)}s | +${newWords} words (${currentWords}w total) → analysis`
      );
      pauseTriggeredRef.current = true;
      requestAnalysis(trigger);
    }, COMPANION_POLL_INTERVAL_MS);
  }, [requestAnalysis, shouldTriggerAnalysis]);

  const resolveWordCount = useCallback((raw: number): number => {
    const previous = lastWordCountRef.current;
    const floor = deletionFloorRef.current;

    if (floor !== null) {
      if (raw < previous) {
        deletionFloorRef.current = Math.min(floor, raw);
        return raw;
      }
      if (raw > previous) {
        // Resumed writing after deleting — accept; not a stale shrink-session spike.
        deletionFloorRef.current = null;
        return raw;
      }
      return raw;
    }

    if (raw < previous) {
      deletionFloorRef.current = raw;
    }

    return raw;
  }, []);

  const clearDeletionSession = useCallback(() => {
    deletionFloorRef.current = null;
  }, []);

  /* ── Deletion: debounced, threshold-gated re-classify ─────────────────── */

  const scheduleDeletionAnalysis = useCallback(() => {
    clearTimeoutRef(deletionDebounceTimerRef);
    deletionDebounceTimerRef.current = window.setTimeout(() => {
      if (isSealedRef.current) return;

      const snapshot = buildSnapshotRef.current();
      const currentWords = collectJournalWordTokens(snapshot).length;
      latestLiveSnapshotRef.current = snapshot;
      latestLiveWordCountRef.current = currentWords;
      const analysisBaseline = wordsAtLastReactionRef.current;
      const deletedSinceAnalysis = Math.max(0, analysisBaseline - currentWords);

      // Resync pause / long-writing delta after any settled shrink (even sub-threshold).
      deltaBaselineRef.current = currentWords;
      clearDeletionSession();

      if (deletedSinceAnalysis < COMPANION_DELETION_REANALYZE_WORDS) {
        console.log(
          `[🌻 companion] 🗑️ deletion below threshold | -${deletedSinceAnalysis}w (need ${COMPANION_DELETION_REANALYZE_WORDS}) — delta baseline → ${currentWords}w`
        );
        return;
      }

      console.log(
        `[🌻 companion] 🗑️ deletion settled | -${deletedSinceAnalysis}w → re-analyze full canvas`
      );
      pauseTriggeredRef.current = true;
      requestAnalysis("deletion", snapshot);
    }, COMPANION_DELETION_DEBOUNCE_MS);
  }, [clearDeletionSession, requestAnalysis]);

  const scheduleMilestoneSave = useCallback(() => {
    clearTimeoutRef(saveTimerRef);
    saveTimerRef.current = window.setTimeout(() => {
      if (isSealedRef.current) return;
      if (isDirtyRef.current) {
        console.log("[🌻 companion] 💾 milestone save (7s)");
        onMilestoneSaveRef.current?.();
        isDirtyRef.current = false;
      }
    }, WRITING_SAVE_INACTIVITY_MS);
  }, []);

  const scheduleSleepIdle = useCallback(() => {
    clearTimeoutRef(sleepTimerRef);
    sleepTimerRef.current = window.setTimeout(() => {
      if (isSealedRef.current) return;
      console.log("[🌻 companion] 😴 sleep (4.5 min inactivity)");
      blobRef.current?.onEmotionFromWriting("sleep");
    }, SLEEP_CANVAS_IDLE_MS);
  }, []);

  const onCanvasActivity = useCallback(() => {
    if (isSealedRef.current) return;
    blobRef.current?.onWakeFromSleep();
    scheduleSleepIdle();
    scheduleInactivityNeutral();
  }, [scheduleSleepIdle, scheduleInactivityNeutral]);

  const onWritingActivity = useCallback(
    (opts?: WritingActivityOptions) => {
    if (isSealedRef.current) return;

    lastTypingTimeRef.current = Date.now();
    pauseTriggeredRef.current = false;
    scheduleInactivityNeutral();

    const snapshot = opts?.snapshot ?? buildSnapshotRef.current();
    const rawWordCount =
      opts?.wordCount ?? collectJournalWordTokens(snapshot).length;
    latestLiveSnapshotRef.current = snapshot;
    latestLiveWordCountRef.current = rawWordCount;

    const previousWordCount = lastWordCountRef.current;
    const currentWordCount = resolveWordCount(rawWordCount);
    const deletedWords = Math.max(0, previousWordCount - currentWordCount);
    lastWordCountRef.current = currentWordCount;

    blobRef.current?.onWakeFromSleep({ typing: true });
    scheduleSleepIdle();

    if (currentWordCount === 0) {
      console.log("[🌻 companion] 🗑️ canvas empty → reset");
      clearPollAndTimers();
      clearTimeoutRef(saveTimerRef);
      blobRef.current?.onCompanionPhase("idle");
      blobRef.current?.onCanvasEmpty?.();
      isDirtyRef.current = false;
      wordsAtLastReactionRef.current = 0;
      deltaBaselineRef.current = 0;
      deletionFloorRef.current = null;
      latestLiveSnapshotRef.current = null;
      return;
    }

    isDirtyRef.current = true;
    scheduleMilestoneSave();
    startPollInterval();

    // Net deletion this edit → debounce; threshold checked once deleting stops.
    if (currentWordCount < previousWordCount) {
      if (deletedWords > 0) {
        console.log(
          `[🌻 companion] 🗑️ deleting (${previousWordCount} → ${currentWordCount}) — debouncing`
        );
      }
      scheduleDeletionAnalysis();
      return;
    }

    // Adding text cancels a pending deletion re-classify.
    if (currentWordCount > previousWordCount) {
      if (deletionFloorRef.current !== null) {
        // Measure new words from the post-delete floor, not pre-shrink analysis baseline.
        deltaBaselineRef.current = previousWordCount;
      }
      clearTimeoutRef(deletionDebounceTimerRef);
      clearDeletionSession();
    }

    const newWords = currentWordCount - deltaBaselineRef.current;
    if (
      newWords >= COMPANION_LONG_WRITING_WORD_THRESHOLD &&
      !pendingAnalysisRef.current &&
      !pauseTriggeredRef.current
    ) {
      console.log(
        `[🌻 companion] 🎯 long-writing | +${newWords} words → analysis`
      );
      pauseTriggeredRef.current = true;
      requestAnalysis("long-writing");
    }
  },
  [
    clearPollAndTimers,
    clearDeletionSession,
    scheduleMilestoneSave,
    scheduleSleepIdle,
    scheduleInactivityNeutral,
    startPollInterval,
    scheduleDeletionAnalysis,
    requestAnalysis,
    resolveWordCount,
  ]);

  const sealEntry = useCallback(() => {
    isSealedRef.current = true;
    clearPollAndTimers();
    clearTimeoutRef(saveTimerRef);
    clearTimeoutRef(sleepTimerRef);
    pendingAnalysisRef.current = false;
    // Invalidate any in-flight analysis and drop the queue.
    analysisGenerationRef.current += 1;
    queuedRunRef.current = null;
    console.log("[🌻 companion] 🔒 entry sealed — companion disabled");
  }, [clearPollAndTimers]);

  const resetSession = useCallback(() => {
    clearPollAndTimers();
    clearTimeoutRef(saveTimerRef);
    pendingAnalysisRef.current = false;
    pauseTriggeredRef.current = false;
    // Invalidate any in-flight analysis and drop the queue.
    analysisGenerationRef.current += 1;
    queuedRunRef.current = null;

    const snapshot = buildSnapshotRef.current();
    const tokens = collectJournalWordTokens(snapshot);
    lastWordCountRef.current = tokens.length;
    wordsAtLastReactionRef.current = tokens.length;
    deltaBaselineRef.current = tokens.length;
    deletionFloorRef.current = null;
    latestLiveSnapshotRef.current = snapshot;
    latestLiveWordCountRef.current = tokens.length;
  }, [clearPollAndTimers]);

  // Canvas-open baseline — seeds word-count refs and arms the always-on
  // services. State 3 (sealed) parks the companion: no active logic, ever.
  // The live trigger system (pause / long-writing / deletion / inactivity)
  // is untouched.
  useEffect(() => {
    if (!isContentReady) return;

    const tokens = collectJournalWordTokens(buildSnapshotRef.current());
    lastWordCountRef.current = tokens.length;
    wordsAtLastReactionRef.current = tokens.length;
    deltaBaselineRef.current = tokens.length;
    latestLiveWordCountRef.current = tokens.length;

    // State 3 — Sealed journal: session is complete, companion is resting.
    if (isSealed) {
      sealEntry();
      return;
    }

    scheduleSleepIdle();
    scheduleInactivityNeutral();
    void warmCompanionRoute();
  }, [isContentReady, isSealed, scheduleSleepIdle, scheduleInactivityNeutral, sealEntry]);

  // State 2 — Resumed draft (unsealed canvas with existing text): react to the
  // existing context on its own, without waiting for a pause or for the user to
  // type. After a short UI-stabilization delay we run exactly ONE full-canvas
  // analysis and apply the detected emotion smoothly. The ref guard keeps it to
  // a single run per canvas load (no duplicate calls on re-render / fast
  // refresh). State 1 (empty canvas) never reaches the analysis.
  useEffect(() => {
    if (!isContentReady || isSealed) return;
    if (resumeAnalysisStartedRef.current) return;
    if (collectJournalWordTokens(buildSnapshotRef.current()).length === 0) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled || isSealedRef.current) return;
      if (resumeAnalysisStartedRef.current) return;
      resumeAnalysisStartedRef.current = true;

      // Make sure the classify route is compiled/awake before the very first
      // resume analysis, so it can't race-fail straight into keyword fallback.
      await warmCompanionRoute();
      if (cancelled || isSealedRef.current) return;

      const snapshot = buildSnapshotRef.current();
      const wordCount = collectJournalWordTokens(snapshot).length;
      if (wordCount === 0) return;

      console.log(
        `[🌻 companion] 📖 resumed draft (${wordCount}w) → one-shot initial analysis`
      );
      requestAnalysis("initial", snapshot);
    }, COMPANION_INITIAL_ANALYSIS_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isContentReady, isSealed, requestAnalysis]);

  useEffect(
    () => () => {
      clearPollAndTimers();
      clearTimeoutRef(saveTimerRef);
      clearTimeoutRef(sleepTimerRef);
    },
    [clearPollAndTimers]
  );

  return {
    onWritingActivity,
    onCanvasActivity,
    resetSession,
    sealEntry,
    getSessionMeta: () => ({
      totalTextWords: collectJournalWordTokens(buildSnapshotRef.current()).length,
    }),
  };
}
