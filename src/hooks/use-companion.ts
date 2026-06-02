"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import type { CompanionEmotion } from "@/components/canvas/blob-character";
import {
  COMPANION_INACTIVITY_MS,
  COMPANION_LONG_WRITING_MS,
  COMPANION_TYPING_GAP_MS,
  fetchCompanionResponse,
  meetsCompanionThreshold,
  type CompanionResponse,
} from "@/lib/companion-ai";
import { analyzeJournalLocally } from "@/lib/companion-local";
import { extractJournalPlainText } from "@/lib/canvas-word-count";

/** Message bubble: 1s in → 4s hold → 1s out → removed from DOM (6s total). */
const WARM_LINE_FADE_IN_MS = 1_000;
const WARM_LINE_STAY_MS = 4_000;
const WARM_LINE_FADE_OUT_MS = 1_000;
export const WARM_LINE_TOTAL_MS =
  WARM_LINE_FADE_IN_MS + WARM_LINE_STAY_MS + WARM_LINE_FADE_OUT_MS;

type BlobCompanionApi = {
  onActivity: () => void;
  onEmotionReaction: (emotion: CompanionEmotion) => void;
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
  // Trigger 2: timestamp of the first keystroke this session — NEVER reset
  // until the hook remounts (canvas reopen / refresh = fresh session).
  const firstKeystrokeAtRef = useRef<number | null>(null);
  // Trigger 2: the "wait for a 2s gap" timer, armed once past the long-writing
  // threshold and reset on every keystroke so we never interrupt mid-sentence.
  const longWritingGapTimerRef = useRef<number | null>(null);
  const warmLineTimerRef = useRef<number | null>(null);
  // One reaction per session, held in memory so it resets on every mount.
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

  const showReaction = useCallback(
    (result: CompanionResponse) => {
      blob.onEmotionReaction(result.emotion);
      showWarmLine(result.line);
    },
    [blob, showWarmLine]
  );

  const maybeTriggerCompanion = useCallback(
    async (snapshot: CanvasSnapshot) => {
      if (!enabled) return;
      if (hasRespondedRef.current || pendingCompanionRef.current) return;

      // Edge case: fewer than the minimum words → no reaction, either trigger.
      if (!meetsCompanionThreshold(snapshot)) return;

      pendingCompanionRef.current = true;
      clearInactivityTimer();
      clearLongWritingGapTimer();
      const plainText = extractJournalPlainText(snapshot);

      // Prefer the API for real context understanding; fall back to local
      // keyword detection if the key is missing, it errors, or it times out
      // (>3s). We wait for one result so the sunflower reacts exactly once.
      let result: CompanionResponse;
      try {
        result = await fetchCompanionResponse(snapshot);
      } catch {
        result = analyzeJournalLocally(plainText);
      }

      // Guard again — a parallel path may have responded while we awaited.
      if (hasRespondedRef.current) {
        pendingCompanionRef.current = false;
        return;
      }

      showReaction(result);
      hasRespondedRef.current = true;
      pendingCompanionRef.current = false;
    },
    [enabled, showReaction, clearInactivityTimer, clearLongWritingGapTimer]
  );

  // ── Trigger 1: stopped typing for 15s ──────────────────────────────────
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

  // ── Trigger 2: 10+ min of writing this session, react on the next 2s gap ─
  const onLongWritingGapElapsed = useCallback(() => {
    const snapshot = buildSnapshotRef.current();
    void maybeTriggerCompanion(snapshot);
  }, [maybeTriggerCompanion]);

  const scheduleLongWritingGapTimer = useCallback(() => {
    clearLongWritingGapTimer();
    longWritingGapTimerRef.current = window.setTimeout(
      onLongWritingGapElapsed,
      COMPANION_TYPING_GAP_MS
    );
  }, [clearLongWritingGapTimer, onLongWritingGapElapsed]);

  const onWritingActivity = useCallback(() => {
    blob.onActivity();

    const now = Date.now();
    // First keystroke starts the long-writing clock (idle-from-start → never).
    if (firstKeystrokeAtRef.current === null) {
      firstKeystrokeAtRef.current = now;
    }

    // Trigger 1: reset the inactivity countdown on every keystroke.
    scheduleInactivityTimer();

    // Trigger 2: once we're past the long-writing threshold while still
    // actively typing, arm the 2s-gap timer (reset each keystroke) so the
    // check-in lands on the next natural pause, not mid-sentence.
    if (
      !hasRespondedRef.current &&
      now - firstKeystrokeAtRef.current >= COMPANION_LONG_WRITING_MS
    ) {
      scheduleLongWritingGapTimer();
    }
  }, [blob, scheduleInactivityTimer, scheduleLongWritingGapTimer]);

  useEffect(() => {
    return () => {
      clearInactivityTimer();
      clearLongWritingGapTimer();
      hideWarmLine();
    };
  }, [clearInactivityTimer, clearLongWritingGapTimer, hideWarmLine]);

  return {
    warmLine,
    warmLineVisible,
    onWritingActivity,
  };
}
