"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import type { BlobEmotion } from "@/components/canvas/blob/types";
import {
  COMPANION_MIN_WORD_DELTA,
  COMPANION_PAUSE_REACTING_MS,
  COMPANION_PAUSE_REFLECTING_MS,
  COMPANION_PAUSE_WRITING_MS,
  countCompanionClassifyWords,
  countCompanionContextWords,
  countCompanionDeltaWords,
  countCompanionSessionWords,
  extractCompanionClassifyContext,
  meetsCompanionDeltaWordThreshold,
  type CompanionAnalysis,
} from "@/lib/companion-ai";
import { collectJournalWordTokens } from "@/lib/canvas-word-count";
import { fetchCompanionAnalysis, warmCompanionRoute } from "@/lib/companion-fetch";
import { detectCompanionAnalysis } from "@/lib/companion-local";
import { SLEEP_CANVAS_IDLE_MS } from "@/lib/blob-emotion-detect";
import {
  logCompanionAnalysisStart,
  logCompanionRawResponse,
  logCompanionSessionReset,
  logCompanionSkipped,
} from "@/lib/companion-debug";
import { COMPANION_MIN_WORDS } from "@/lib/companion-pause";
import type { CompanionSessionMeta } from "@/lib/companion-analysis";

/** Coarser pause before milestone save — aligned with long-pause tier. */
export const WRITING_SAVE_INACTIVITY_MS = COMPANION_PAUSE_REFLECTING_MS;

type UseCompanionOptions = {
  buildSnapshot: () => CanvasSnapshot;
  onMilestoneSave?: () => void;
  isContentReady?: boolean;
  /** Timestamp (ms) until which face emotion updates are blocked. */
  emotionCooldownUntilRef?: React.MutableRefObject<number>;
  blob?: {
    onCompanionPhase: (phase: "writing" | "listening" | "idle") => void;
    onCompanionAnalysis: (
      analysis: CompanionAnalysis,
      text: string,
      sessionMeta?: CompanionSessionMeta
    ) => void;
    onEmotionFromWriting: (emotion: BlobEmotion) => void;
    onWakeFromSleep: (opts?: { typing?: boolean }) => boolean;
  };
};

export function useCompanion({
  buildSnapshot,
  onMilestoneSave,
  isContentReady = true,
  emotionCooldownUntilRef,
  blob,
}: UseCompanionOptions) {
  const buildSnapshotRef = useRef(buildSnapshot);
  const onMilestoneSaveRef = useRef(onMilestoneSave);
  const blobRef = useRef(blob);

  const isDirtyRef = useRef(false);
  const pendingAnalysisRef = useRef(false);
  const queuedAnalysisRef = useRef(false);
  const lastDeltaContextRef = useRef("");
  const hasAnalyzedRef = useRef(false);
  /** Tokens on canvas when this visit started — excludes pre-visit saved text. */
  const sessionBaselineTokenCountRef = useRef(0);
  /** Tokens on canvas after the last successful classification — delta starts here. */
  const analysisBaselineTokenCountRef = useRef(0);
  const detectionGenRef = useRef(0);
  const hydratedPauseRef = useRef(false);
  const writingTimerRef = useRef<number | null>(null);
  const listeningTimerRef = useRef<number | null>(null);
  const milestoneTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const sleepTimerRef = useRef<number | null>(null);

  useEffect(() => {
    buildSnapshotRef.current = buildSnapshot;
    onMilestoneSaveRef.current = onMilestoneSave;
    blobRef.current = blob;
  }, [buildSnapshot, onMilestoneSave, blob]);

  const clearTimer = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const clearPauseTimers = useCallback(() => {
    clearTimer(writingTimerRef);
    clearTimer(listeningTimerRef);
    clearTimer(milestoneTimerRef);
  }, []);

  const getAnalysisMeta = useCallback(
    (snapshot: CanvasSnapshot): CompanionSessionMeta => {
      const sessionBaseline = sessionBaselineTokenCountRef.current;
      const analysisBaseline = analysisBaselineTokenCountRef.current;
      return {
        deltaTextWords: countCompanionDeltaWords(snapshot, analysisBaseline),
        classifyTextWords: countCompanionClassifyWords(
          snapshot,
          analysisBaseline
        ),
        classificationStrategy: "delta-chunk" as const,
        sessionTextWords: countCompanionSessionWords(snapshot, sessionBaseline),
        totalTextWords: countCompanionContextWords(snapshot),
        sessionBaselineTokenCount: sessionBaseline,
        analysisBaselineTokenCount: analysisBaseline,
      };
    },
    []
  );

  const getClassifyContext = useCallback((snapshot: CanvasSnapshot): string => {
    return extractCompanionClassifyContext(
      snapshot,
      analysisBaselineTokenCountRef.current
    );
  }, []);

  const shouldAnalyze = useCallback(
    (snapshot: CanvasSnapshot, logSkips = false): boolean => {
      const analysisBaseline = analysisBaselineTokenCountRef.current;
      const sessionBaseline = sessionBaselineTokenCountRef.current;
      const isFirst = !hasAnalyzedRef.current;
      const deltaWords = countCompanionDeltaWords(snapshot, analysisBaseline);
      const sessionWordCount = countCompanionSessionWords(
        snapshot,
        sessionBaseline
      );
      const totalWordCount = countCompanionContextWords(snapshot);

      if (
        !meetsCompanionDeltaWordThreshold(snapshot, analysisBaseline, isFirst)
      ) {
        if (logSkips) {
          logCompanionSkipped("below_word_threshold", {
            deltaWords,
            sessionWordCount,
            totalWordCount,
            isFirstAnalysis: isFirst,
            minWords: isFirst ? COMPANION_MIN_WORDS : COMPANION_MIN_WORD_DELTA,
          });
        }
        return false;
      }

      const context = getClassifyContext(snapshot);

      if (context === lastDeltaContextRef.current) {
        if (logSkips) {
          logCompanionSkipped("duplicate_context", {
            deltaWords,
            contextLength: context.length,
          });
        }
        return false;
      }

      return true;
    },
    [getClassifyContext]
  );

  const runAnalysis = useCallback(async () => {
    if (pendingAnalysisRef.current) {
      queuedAnalysisRef.current = true;
      logCompanionSkipped("analysis_in_flight");
      return;
    }

    const cooldownUntil = emotionCooldownUntilRef?.current ?? 0;
    if (Date.now() < cooldownUntil) {
      logCompanionSkipped("emotion_cooldown", {
        remainingMs: cooldownUntil - Date.now(),
      });
      return;
    }

    const snapshot = buildSnapshotRef.current();
    if (!shouldAnalyze(snapshot, true)) return;

    pendingAnalysisRef.current = true;
    const generation = ++detectionGenRef.current;
    const contextText = getClassifyContext(snapshot);
    const meta = getAnalysisMeta(snapshot);

    const closeDebugGroup = logCompanionAnalysisStart(contextText, {
      strategy: meta.classificationStrategy,
      deltaTextWords: meta.deltaTextWords,
      classifyTextWords: meta.classifyTextWords,
      sessionTextWords: meta.sessionTextWords,
      totalWordCount: meta.totalTextWords,
      analysisBaselineTokenCount: meta.analysisBaselineTokenCount,
    });

    const commit = (analysis: CompanionAnalysis): boolean => {
      if (generation !== detectionGenRef.current) {
        logCompanionSkipped("stale_generation", { generation });
        return false;
      }
      const currentContext = getClassifyContext(buildSnapshotRef.current());
      if (currentContext !== contextText) {
        logCompanionSkipped("context_changed_during_request", {
          sentLength: contextText.length,
          currentLength: currentContext.length,
        });
        return false;
      }

      blobRef.current?.onCompanionAnalysis(analysis, contextText, meta);

      const tokenCount = collectJournalWordTokens(
        buildSnapshotRef.current()
      ).length;
      analysisBaselineTokenCountRef.current = tokenCount;
      lastDeltaContextRef.current = contextText;
      hasAnalyzedRef.current = true;
      return true;
    };

    try {
      const analysis = await fetchCompanionAnalysis(contextText);
      if (!commit(analysis)) {
        queuedAnalysisRef.current = true;
        closeDebugGroup();
      }
    } catch (error) {
      console.warn(
        "Companion analysis failed; falling back to local detection",
        error
      );
      const local = detectCompanionAnalysis(contextText);
      logCompanionRawResponse(local, "local");
      if (!commit(local)) {
        queuedAnalysisRef.current = true;
        closeDebugGroup();
      }
    } finally {
      pendingAnalysisRef.current = false;
      if (queuedAnalysisRef.current) {
        queuedAnalysisRef.current = false;
        queueMicrotask(() => void runAnalysis());
      }
    }
  }, [emotionCooldownUntilRef, getClassifyContext, getAnalysisMeta, shouldAnalyze]);

  const initSessionBaseline = useCallback(() => {
    const snapshot = buildSnapshotRef.current();
    const tokenCount = collectJournalWordTokens(snapshot).length;
    sessionBaselineTokenCountRef.current = tokenCount;
    analysisBaselineTokenCountRef.current = tokenCount;
    lastDeltaContextRef.current = "";
    hasAnalyzedRef.current = false;
  }, []);

  const resetSession = useCallback(() => {
    clearPauseTimers();
    clearTimer(saveTimerRef);
    pendingAnalysisRef.current = false;
    queuedAnalysisRef.current = false;
    detectionGenRef.current += 1;

    const snapshot = buildSnapshotRef.current();
    const prevAnalysisBaseline = analysisBaselineTokenCountRef.current;
    initSessionBaseline();

    logCompanionSessionReset({
      previousAnalysisBaseline: prevAnalysisBaseline,
      newAnalysisBaseline: analysisBaselineTokenCountRef.current,
      totalCanvasWords: countCompanionContextWords(snapshot),
      sessionWordsNow: countCompanionSessionWords(
        snapshot,
        sessionBaselineTokenCountRef.current
      ),
    });
  }, [clearPauseTimers, initSessionBaseline]);

  const schedulePauseTiers = useCallback(() => {
    clearPauseTimers();

    writingTimerRef.current = window.setTimeout(() => {
      blobRef.current?.onCompanionPhase("listening");
    }, COMPANION_PAUSE_WRITING_MS);

    listeningTimerRef.current = window.setTimeout(() => {
      blobRef.current?.onCompanionPhase("idle");
      void runAnalysis();
    }, COMPANION_PAUSE_REACTING_MS);

    milestoneTimerRef.current = window.setTimeout(() => {
      if (isDirtyRef.current) {
        onMilestoneSaveRef.current?.();
        isDirtyRef.current = false;
      }
    }, COMPANION_PAUSE_REFLECTING_MS);
  }, [clearPauseTimers, runAnalysis]);

  const scheduleMilestoneSave = useCallback(() => {
    clearTimer(saveTimerRef);
    saveTimerRef.current = window.setTimeout(() => {
      if (isDirtyRef.current) {
        onMilestoneSaveRef.current?.();
        isDirtyRef.current = false;
      }
    }, WRITING_SAVE_INACTIVITY_MS);
  }, []);

  const scheduleSleepIdle = useCallback(() => {
    clearTimer(sleepTimerRef);
    sleepTimerRef.current = window.setTimeout(() => {
      blobRef.current?.onEmotionFromWriting("sleep");
    }, SLEEP_CANVAS_IDLE_MS);
  }, []);

  const onCanvasActivity = useCallback(() => {
    blobRef.current?.onWakeFromSleep();
    scheduleSleepIdle();
  }, [scheduleSleepIdle]);

  const onWritingActivity = useCallback(() => {
    blobRef.current?.onWakeFromSleep({ typing: true });
    blobRef.current?.onCompanionPhase("writing");
    isDirtyRef.current = true;

    scheduleSleepIdle();
    schedulePauseTiers();
    scheduleMilestoneSave();
  }, [scheduleMilestoneSave, schedulePauseTiers, scheduleSleepIdle]);

  useEffect(() => {
    if (!isContentReady) return;
    initSessionBaseline();
    scheduleSleepIdle();
    void warmCompanionRoute();
  }, [isContentReady, initSessionBaseline, scheduleSleepIdle]);

  useEffect(() => {
    if (!isContentReady || hydratedPauseRef.current) return;
    hydratedPauseRef.current = true;
    if (
      !meetsCompanionDeltaWordThreshold(
        buildSnapshotRef.current(),
        analysisBaselineTokenCountRef.current,
        !hasAnalyzedRef.current
      )
    ) {
      return;
    }
    schedulePauseTiers();
  }, [isContentReady, schedulePauseTiers]);

  useEffect(
    () => () => {
      clearPauseTimers();
      clearTimer(saveTimerRef);
      clearTimer(sleepTimerRef);
    },
    [clearPauseTimers]
  );

  return {
    onWritingActivity,
    onCanvasActivity,
    resetSession,
    getSessionMeta: () => getAnalysisMeta(buildSnapshotRef.current()),
  };
}
