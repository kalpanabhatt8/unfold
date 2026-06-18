"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import type { BlobEmotion } from "@/components/canvas/blob/types";
import type { CompanionEmotion } from "@/lib/companion-ai";
import {
  emotionDetectionPauseMs,
  fetchCompanionEmotion,
  getEmotionWindowText,
  meetsEmotionDetectionThreshold,
} from "@/lib/companion-ai";
import {
  detectCompanionEmotion,
  shouldPreferLocalEmotion,
} from "@/lib/companion-local";
import { SLEEP_CANVAS_IDLE_MS } from "@/lib/blob-emotion-detect";

/** Coarser pause before milestone save / title regen — separate from face reaction. */
export const WRITING_SAVE_INACTIVITY_MS = 15_000;

type UseCompanionOptions = {
  buildSnapshot: () => CanvasSnapshot;
  onMilestoneSave?: () => void;
  /** True after canvas text has hydrated from storage. */
  isContentReady?: boolean;
  blob?: {
    onActivity: () => void;
    onSessionEmotionDetected: (
      emotion: CompanionEmotion,
      text: string
    ) => void;
    /** Sleep animation layer — separate from session emotion (for now). */
    onEmotionFromWriting: (emotion: BlobEmotion) => void;
    onWakeFromSleep: () => void;
  };
};

export function useCompanion({
  buildSnapshot,
  onMilestoneSave,
  isContentReady = true,
  blob,
}: UseCompanionOptions) {
  const buildSnapshotRef = useRef(buildSnapshot);
  const onMilestoneSaveRef = useRef(onMilestoneSave);
  const blobRef = useRef(blob);

  const isDirtyRef = useRef(false);
  const pendingEmotionRef = useRef(false);
  const queuedEmotionRef = useRef(false);
  const hasDetectedOnceRef = useRef(false);
  const lastClassifiedTailRef = useRef("");
  const emotionTimerRef = useRef<number | null>(null);
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

  const getDetectionState = useCallback(
    () => ({
      hasDetectedBefore: hasDetectedOnceRef.current,
      lastClassifiedTail: lastClassifiedTailRef.current,
    }),
    []
  );

  const applyEmotion = useCallback(
    (emotion: CompanionEmotion, text: string) => {
      blobRef.current?.onSessionEmotionDetected(emotion, text);
    },
    []
  );

  const runSessionEmotionDetection = useCallback(async () => {
    if (pendingEmotionRef.current) {
      queuedEmotionRef.current = true;
      return;
    }

    const snapshot = buildSnapshotRef.current();
    if (!meetsEmotionDetectionThreshold(snapshot, getDetectionState())) return;

    pendingEmotionRef.current = true;
    const emotionText = getEmotionWindowText(snapshot);

    const localEmotion = detectCompanionEmotion(emotionText);
    applyEmotion(localEmotion, emotionText);

    try {
      const remoteEmotion = await fetchCompanionEmotion(emotionText);
      if (
        remoteEmotion !== localEmotion &&
        !shouldPreferLocalEmotion(localEmotion, remoteEmotion)
      ) {
        applyEmotion(remoteEmotion, emotionText);
      }
    } catch (error) {
      console.warn(
        "Companion emotion API failed after retries; keeping local result",
        error
      );
    } finally {
      hasDetectedOnceRef.current = true;
      lastClassifiedTailRef.current = emotionText;
      pendingEmotionRef.current = false;

      if (queuedEmotionRef.current) {
        queuedEmotionRef.current = false;
        queueMicrotask(() => void runSessionEmotionDetection());
      }
    }
  }, [applyEmotion, getDetectionState]);

  const scheduleEmotionCheck = useCallback(() => {
    clearTimer(emotionTimerRef);
    const pauseMs = emotionDetectionPauseMs(hasDetectedOnceRef.current);
    emotionTimerRef.current = window.setTimeout(() => {
      void runSessionEmotionDetection();
    }, pauseMs);
  }, [runSessionEmotionDetection]);

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
    blobRef.current?.onWakeFromSleep();
    blobRef.current?.onActivity();
    isDirtyRef.current = true;

    scheduleSleepIdle();
    scheduleEmotionCheck();
    scheduleMilestoneSave();
  }, [scheduleEmotionCheck, scheduleMilestoneSave, scheduleSleepIdle]);

  useEffect(() => {
    if (!isContentReady) return;
    scheduleSleepIdle();
  }, [isContentReady, scheduleSleepIdle]);

  useEffect(() => {
    if (!isContentReady) return;
    const snapshot = buildSnapshotRef.current();
    if (!meetsEmotionDetectionThreshold(snapshot, getDetectionState())) return;
    scheduleEmotionCheck();
  }, [getDetectionState, isContentReady, scheduleEmotionCheck]);

  useEffect(
    () => () => {
      clearTimer(emotionTimerRef);
      clearTimer(saveTimerRef);
      clearTimer(sleepTimerRef);
    },
    []
  );

  return { onWritingActivity, onCanvasActivity };
}
