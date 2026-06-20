"use client";

import React from "react";
import type { BlobEmotion, BlobPose } from "./types";
import { companionToBlobEmotion } from "./emotions";
import type { CompanionEmotion } from "@/lib/companion-ai";
import { pickEntranceGreeting } from "./entrance-greetings";
import {
  ENTRANCE_DURATION_MS,
  GREETING_DURATION_S,
  PEEK_DELAY_MS,
  PEEK_HOLD_MS,
  WAKE_DURATION_MS,
  WAKE_SURPRISE_MS,
} from "./layout";

export const GREETING_DURATION_MS = GREETING_DURATION_S * 1000;
export const EMOTION_REACTION_MS = 6_000;
/** Greeting fade-out length when the flower starts sliding in. */
const GREETING_FADE_MS = 450;

export type UseBlobStateOptions = {
  /** Scopes entrance greetings to first vs returning visits for this book. */
  bookId?: string;
  typingRestoreMs?: number;
  enterDurationMs?: number;
  emotionDurationMs?: number;
  /** Delay after canvas open before the flower peeks in. */
  peekDelayMs?: number;
  /** How long the peek (tilt + greeting) holds before sliding in. */
  peekHoldMs?: number;
  /** When false, skip the peek→slide entrance (dev grid). */
  enterOnMount?: boolean;
};

export function useBlobState(opts: UseBlobStateOptions = {}) {
  const {
    bookId = "default",
    typingRestoreMs = 900,
    enterDurationMs = ENTRANCE_DURATION_MS,
    emotionDurationMs = EMOTION_REACTION_MS,
    peekDelayMs = PEEK_DELAY_MS,
    peekHoldMs = PEEK_HOLD_MS,
    enterOnMount = true,
  } = opts;

  const [pose, setPose] = React.useState<BlobPose>(() =>
    enterOnMount ? "peek" : "idle"
  );
  const [emotion, setEmotion] = React.useState<BlobEmotion>("neutral");
  // Stay invisible until the peek begins (after the 1s delay).
  const [hidden, setHidden] = React.useState(enterOnMount);
  const [greeting, setGreeting] = React.useState<string | null>(null);
  const [greetingVisible, setGreetingVisible] = React.useState(false);

  const idleTimerRef = React.useRef<number | null>(null);
  const enterTimerRef = React.useRef<number | null>(null);
  const emotionTimerRef = React.useRef<number | null>(null);
  const wakeTimerRef = React.useRef<number | null>(null);
  const wakeSettleTimerRef = React.useRef<number | null>(null);
  const peekTimerRef = React.useRef<number | null>(null);
  const slideTimerRef = React.useRef<number | null>(null);
  const greetingClearTimerRef = React.useRef<number | null>(null);
  const closingRef = React.useRef(false);
  /** False until peek → slide → idle finishes; typing must not skip this. */
  const entranceCompleteRef = React.useRef(!enterOnMount);
  const poseRef = React.useRef<BlobPose>(enterOnMount ? "peek" : "idle");
  const emotionRef = React.useRef<BlobEmotion>("neutral");
  const awakeEmotionRef = React.useRef<BlobEmotion>("neutral");
  const sleepingRef = React.useRef(false);

  React.useEffect(() => {
    poseRef.current = pose;
  }, [pose]);
  React.useEffect(() => {
    emotionRef.current = emotion;
    if (emotion !== "sleep") {
      awakeEmotionRef.current = emotion;
    }
  }, [emotion]);

  const clearTimer = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const clearEntranceTimers = React.useCallback(() => {
    clearTimer(peekTimerRef);
    clearTimer(slideTimerRef);
    clearTimer(enterTimerRef);
    clearTimer(greetingClearTimerRef);
  }, []);

  const clearAll = React.useCallback(() => {
    clearTimer(idleTimerRef);
    clearTimer(emotionTimerRef);
    clearTimer(wakeTimerRef);
    clearTimer(wakeSettleTimerRef);
    clearEntranceTimers();
  }, [clearEntranceTimers]);

  /**
   * Entrance choreography:
   *   open → (1s) → peek from left (tilt + greeting)
   *        → hold → slide left→right, straighten → idle.
   */
  const runEnter = React.useCallback(() => {
    if (closingRef.current) return;
    clearEntranceTimers();
    entranceCompleteRef.current = false;

    // Start hidden + framed in the peek pose so the first paint is correct.
    setHidden(true);
    setPose("peek");
    setGreeting(null);
    setGreetingVisible(false);

    peekTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      // Peek in: appear at the edge, tilted, with the greeting.
      setHidden(false);
      setPose("peek");
      setGreeting(pickEntranceGreeting(bookId));
      setGreetingVisible(true);

      slideTimerRef.current = window.setTimeout(() => {
        if (closingRef.current) return;
        // Slide in and straighten; fade the greeting out as it moves.
        setPose("enter");
        setGreetingVisible(false);
        greetingClearTimerRef.current = window.setTimeout(() => {
          setGreeting(null);
        }, GREETING_FADE_MS);

        enterTimerRef.current = window.setTimeout(() => {
          if (closingRef.current) return;
          if (poseRef.current !== "enter") return;
          setPose("idle");
          entranceCompleteRef.current = true;
        }, enterDurationMs);
      }, peekHoldMs);
    }, peekDelayMs);
  }, [bookId, clearEntranceTimers, enterDurationMs, peekDelayMs, peekHoldMs]);

  React.useEffect(() => {
    if (!enterOnMount) return;
    runEnter();
    return clearAll;
  }, [clearAll, enterOnMount, runEnter]);

  const onActivity = React.useCallback(() => {
    if (closingRef.current) return;
    // Let peek → greeting → slide → idle finish before reacting to typing.
    if (!entranceCompleteRef.current) return;
    clearTimer(idleTimerRef);
    clearTimer(wakeTimerRef);
    clearTimer(wakeSettleTimerRef);

    if (poseRef.current !== "jump" && poseRef.current !== "bloom") {
      setPose("typing");
    }

    idleTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setPose("idle");
    }, typingRestoreMs);
  }, [typingRestoreMs]);

  const onEmotionReaction = React.useCallback(
    (next: BlobEmotion) => {
      if (closingRef.current) return;
      clearTimer(emotionTimerRef);
      setEmotion(next);
      emotionTimerRef.current = window.setTimeout(() => {
        if (closingRef.current) return;
        setEmotion("neutral");
      }, emotionDurationMs);
    },
    [emotionDurationMs]
  );

  /** Sleep face — separate from journal emotion layer. */
  const onEmotionFromWriting = React.useCallback((next: BlobEmotion) => {
    if (closingRef.current) return;
    if (next === "sleep") {
      sleepingRef.current = true;
      clearTimer(emotionTimerRef);
      setEmotion("sleep");
      return;
    }
    sleepingRef.current = false;
    clearTimer(emotionTimerRef);
    setEmotion(next);
  }, []);

  const onWakeFromSleep = React.useCallback(
    (opts?: { typing?: boolean }): boolean => {
      if (closingRef.current || !sleepingRef.current) return false;
      sleepingRef.current = false;
      clearTimer(emotionTimerRef);
      clearTimer(wakeTimerRef);
      clearTimer(wakeSettleTimerRef);
      setEmotion("shocked");

      wakeSettleTimerRef.current = window.setTimeout(() => {
        if (closingRef.current) return;
        setEmotion("neutral");
      }, WAKE_SURPRISE_MS);

      if (opts?.typing) {
        wakeTimerRef.current = window.setTimeout(() => {
          if (closingRef.current) return;
          setEmotion(awakeEmotionRef.current);
        }, WAKE_DURATION_MS);
        return true;
      }

      clearTimer(idleTimerRef);
      setPose("wake");
      wakeTimerRef.current = window.setTimeout(() => {
        if (closingRef.current) return;
        setPose("idle");
        setEmotion(awakeEmotionRef.current);
      }, WAKE_DURATION_MS);
      return true;
    },
    []
  );

  /** Gemini / local classification from journal text — updates on each idle pause. */
  const onSessionEmotionDetected = React.useCallback(
    (companion: CompanionEmotion, text: string) => {
      if (closingRef.current) return;
      const next = companionToBlobEmotion(companion, text);
      if (sleepingRef.current) {
        awakeEmotionRef.current = next;
        return;
      }
      clearTimer(emotionTimerRef);
      setEmotion(next);
    },
    []
  );

  const onClosing = React.useCallback((): Promise<void> => {
    closingRef.current = true;
    clearAll();
    setPose("bloom");
    return new Promise((resolve) => {
      window.setTimeout(() => {
        setHidden(true);
        resolve();
      }, 1100);
    });
  }, [clearAll]);

  return {
    pose,
    emotion,
    setPose,
    setEmotion,
    hidden,
    greeting,
    greetingVisible,
    onActivity,
    onEmotionReaction,
    onEmotionFromWriting,
    onWakeFromSleep,
    onSessionEmotionDetected,
    onClosing,
    runEnter,
  };
}
