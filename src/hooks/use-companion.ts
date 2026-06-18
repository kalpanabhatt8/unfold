"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import type { CompanionEmotion } from "@/components/canvas/blob-character";
import {
  COMPANION_INACTIVITY_MS,
  COMPANION_LONG_WRITING_MS,
  COMPANION_TYPING_GAP_MS,
  LIVE_EMOTION_IDLE_MS,
  LIVE_RESPONSE_DELAY_MS,
  LIVE_WARM_LINE_COOLDOWN_MS,
  fetchCompanionResponse,
  meetsCompanionThreshold,
  type CompanionResponse,
} from "@/lib/companion-ai";
import {
  analyzeJournalLocally,
  detectCompanionEmotion,
  meetsLiveEmotionThreshold,
} from "@/lib/companion-local";
import { extractJournalPlainText } from "@/lib/canvas-word-count";

/** Message bubble: 1s in → 4s hold → 1s out → removed from DOM (6s total). */
const WARM_LINE_FADE_IN_MS = 1_000;
const WARM_LINE_STAY_MS = 4_000;
const WARM_LINE_FADE_OUT_MS = 1_000;
export const WARM_LINE_TOTAL_MS =
  WARM_LINE_FADE_IN_MS + WARM_LINE_STAY_MS + WARM_LINE_FADE_OUT_MS;

type BlobCompanionApi = {
  onActivity: () => void;
  /** Instant face while typing — no API, no auto-neutral timer. */
  onCompanionLiveReaction: (
    emotion: CompanionEmotion,
    journalText?: string
  ) => void;
  /** Milestone check-in — holds expression then fades to neutral. */
  onCompanionReaction: (
    emotion: CompanionEmotion,
    journalText?: string
  ) => void;
};

type UseCompanionOptions = {
  /** Accepted for caller convenience; the once-per-session flag is in-memory. */
  bookId?: string;
  buildSnapshot: () => CanvasSnapshot;
  onMilestoneSave: (snapshot: CanvasSnapshot) => void;
  blob: BlobCompanionApi;
  enabled?: boolean;
};

export function useCompanion({
  buildSnapshot,
  onMilestoneSave,
  blob,
  enabled = true,
}: UseCompanionOptions) {
  const [warmLine, setWarmLine] = useState<string | null>(null);
  const [warmLineVisible, setWarmLineVisible] = useState(false);

  const inactivityTimerRef = useRef<number | null>(null);
  const firstKeystrokeAtRef = useRef<number | null>(null);
  const longWritingGapTimerRef = useRef<number | null>(null);
  const warmLineTimerRef = useRef<number | null>(null);
  const liveReplyTimerRef = useRef<number | null>(null);
  const liveEmotionIdleRef = useRef<number | null>(null);
  const lastLiveEmotionRef = useRef<CompanionEmotion | null>(null);
  const lastWarmLineAtRef = useRef(0);
  const latestJournalTextRef = useRef("");
  const hasRespondedRef = useRef(false);
  const pendingCompanionRef = useRef(false);
  const buildSnapshotRef = useRef(buildSnapshot);

  useEffect(() => {
    buildSnapshotRef.current = buildSnapshot;
  }, [buildSnapshot]);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const clearLongWritingGapTimer = useCallback(() => {
    if (longWritingGapTimerRef.current !== null) {
      window.clearTimeout(longWritingGapTimerRef.current);
      longWritingGapTimerRef.current = null;
    }
  }, []);

  const clearLiveReplyTimer = useCallback(() => {
    if (liveReplyTimerRef.current !== null) {
      window.clearTimeout(liveReplyTimerRef.current);
      liveReplyTimerRef.current = null;
    }
  }, []);

  const clearLiveEmotionIdle = useCallback(() => {
    if (liveEmotionIdleRef.current !== null) {
      window.clearTimeout(liveEmotionIdleRef.current);
      liveEmotionIdleRef.current = null;
    }
  }, []);

  const hideWarmLine = useCallback(() => {
    if (warmLineTimerRef.current !== null) {
      window.clearTimeout(warmLineTimerRef.current);
      warmLineTimerRef.current = null;
    }
    setWarmLineVisible(false);
  }, []);

  const showWarmLine = useCallback(
    (line: string) => {
      hideWarmLine();
      setWarmLine(line);
      requestAnimationFrame(() => setWarmLineVisible(true));
      warmLineTimerRef.current = window.setTimeout(() => {
        setWarmLineVisible(false);
        warmLineTimerRef.current = window.setTimeout(() => {
          setWarmLine(null);
          warmLineTimerRef.current = null;
        }, WARM_LINE_FADE_OUT_MS);
      }, WARM_LINE_FADE_IN_MS + WARM_LINE_STAY_MS);
    },
    [hideWarmLine]
  );

  const applyLiveFace = useCallback(
    (plainText: string) => {
      if (!meetsLiveEmotionThreshold(plainText)) {
        if (lastLiveEmotionRef.current !== null) {
          lastLiveEmotionRef.current = null;
          blob.onCompanionLiveReaction("neutral", plainText);
        }
        return;
      }

      const emotion = detectCompanionEmotion(plainText);
      if (emotion === lastLiveEmotionRef.current) return;

      lastLiveEmotionRef.current = emotion;
      blob.onCompanionLiveReaction(emotion, plainText);
    },
    [blob]
  );

  const maybeShowLiveWarmLine = useCallback(
    (plainText: string) => {
      if (!enabled || !meetsLiveEmotionThreshold(plainText)) return;

      const result = analyzeJournalLocally(plainText);
      if (result.emotion === "neutral") return;

      const now = Date.now();
      if (now - lastWarmLineAtRef.current < LIVE_WARM_LINE_COOLDOWN_MS) return;

      lastWarmLineAtRef.current = now;
      blob.onCompanionLiveReaction(result.emotion, plainText);
      showWarmLine(result.line);
    },
    [blob, enabled, showWarmLine]
  );

  const scheduleLiveReply = useCallback(
    (plainText: string) => {
      clearLiveReplyTimer();
      liveReplyTimerRef.current = window.setTimeout(() => {
        maybeShowLiveWarmLine(latestJournalTextRef.current || plainText);
      }, LIVE_RESPONSE_DELAY_MS);
    },
    [clearLiveReplyTimer, maybeShowLiveWarmLine]
  );

  const scheduleLiveEmotionIdle = useCallback(() => {
    clearLiveEmotionIdle();
    liveEmotionIdleRef.current = window.setTimeout(() => {
      lastLiveEmotionRef.current = null;
      blob.onCompanionLiveReaction("neutral");
    }, LIVE_EMOTION_IDLE_MS);
  }, [blob, clearLiveEmotionIdle]);

  const showReaction = useCallback(
    (result: CompanionResponse, journalText: string) => {
      blob.onCompanionReaction(result.emotion, journalText);
      showWarmLine(result.line);
    },
    [blob, showWarmLine]
  );

  const maybeTriggerCompanion = useCallback(
    async (snapshot: CanvasSnapshot) => {
      if (!enabled) return;
      if (hasRespondedRef.current || pendingCompanionRef.current) return;

      if (!meetsCompanionThreshold(snapshot)) return;

      pendingCompanionRef.current = true;
      clearInactivityTimer();
      clearLongWritingGapTimer();
      const plainText = extractJournalPlainText(snapshot);

      let result: CompanionResponse;
      try {
        result = await fetchCompanionResponse(snapshot);
      } catch {
        result = analyzeJournalLocally(plainText);
      }

      if (hasRespondedRef.current) {
        pendingCompanionRef.current = false;
        return;
      }

      showReaction(result, plainText);
      hasRespondedRef.current = true;
      pendingCompanionRef.current = false;
    },
    [enabled, showReaction, clearInactivityTimer, clearLongWritingGapTimer]
  );

  const onInactivityElapsed = useCallback(() => {
    const snapshot = buildSnapshotRef.current();
    onMilestoneSave(snapshot);
    void maybeTriggerCompanion(snapshot);
  }, [maybeTriggerCompanion, onMilestoneSave]);

  const scheduleInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    inactivityTimerRef.current = window.setTimeout(
      onInactivityElapsed,
      COMPANION_INACTIVITY_MS
    );
  }, [clearInactivityTimer, onInactivityElapsed]);

  const onLongWritingGapElapsed = useCallback(() => {
    void maybeTriggerCompanion(buildSnapshotRef.current());
  }, [maybeTriggerCompanion]);

  const scheduleLongWritingGapTimer = useCallback(() => {
    clearLongWritingGapTimer();
    longWritingGapTimerRef.current = window.setTimeout(
      onLongWritingGapElapsed,
      COMPANION_TYPING_GAP_MS
    );
  }, [clearLongWritingGapTimer, onLongWritingGapElapsed]);

  const onWritingActivity = useCallback(
    (journalText?: string) => {
      blob.onActivity();

      const plainText =
        journalText ?? extractJournalPlainText(buildSnapshotRef.current());
      latestJournalTextRef.current = plainText;

      const now = Date.now();
      if (firstKeystrokeAtRef.current === null) {
        firstKeystrokeAtRef.current = now;
      }

      scheduleInactivityTimer();

      // Instant local face reaction (TypeScript keywords — no API).
      applyLiveFace(plainText);
      scheduleLiveReply(plainText);
      clearLiveEmotionIdle();
      scheduleLiveEmotionIdle();

      if (
        !hasRespondedRef.current &&
        now - firstKeystrokeAtRef.current >= COMPANION_LONG_WRITING_MS
      ) {
        scheduleLongWritingGapTimer();
      }
    },
    [
      applyLiveFace,
      blob,
      clearLiveEmotionIdle,
      scheduleInactivityTimer,
      scheduleLiveEmotionIdle,
      scheduleLiveReply,
      scheduleLongWritingGapTimer,
    ]
  );

  useEffect(() => {
    return () => {
      clearInactivityTimer();
      clearLongWritingGapTimer();
      clearLiveReplyTimer();
      clearLiveEmotionIdle();
      hideWarmLine();
    };
  }, [
    clearInactivityTimer,
    clearLongWritingGapTimer,
    clearLiveReplyTimer,
    clearLiveEmotionIdle,
    hideWarmLine,
  ]);

  return {
    warmLine,
    warmLineVisible,
    onWritingActivity,
  };
}
