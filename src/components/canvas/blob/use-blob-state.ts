"use client";

import React from "react";
import type { CompanionEmotion } from "@/lib/companion-ai";
import type { BlobEmotion, BlobPose } from "./types";
import { companionToBlobEmotion } from "./emotions";
import { pickEntranceGreeting } from "./entrance-greetings";
import {
  ENTRANCE_DURATION_MS,
  GREETING_DURATION_S,
  PEEK_DELAY_MS,
  PEEK_HOLD_MS,
} from "./layout";

export const GREETING_DURATION_MS = GREETING_DURATION_S * 1000;
export const EMOTION_REACTION_MS = 6_000;
/** Greeting fade-out length when the flower starts sliding in. */
const GREETING_FADE_MS = 450;

export type UseBlobStateOptions = {
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
  const peekTimerRef = React.useRef<number | null>(null);
  const slideTimerRef = React.useRef<number | null>(null);
  const greetingClearTimerRef = React.useRef<number | null>(null);
  const closingRef = React.useRef(false);
  const poseRef = React.useRef<BlobPose>(enterOnMount ? "peek" : "idle");
  const emotionRef = React.useRef<BlobEmotion>("neutral");

  React.useEffect(() => {
    poseRef.current = pose;
  }, [pose]);
  React.useEffect(() => {
    emotionRef.current = emotion;
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
      setGreeting(pickEntranceGreeting());
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
        }, enterDurationMs);
      }, peekHoldMs);
    }, peekDelayMs);
  }, [clearEntranceTimers, enterDurationMs, peekDelayMs, peekHoldMs]);

  React.useEffect(() => {
    if (!enterOnMount) return;
    runEnter();
    return clearAll;
  }, [clearAll, enterOnMount, runEnter]);

  const onActivity = React.useCallback(() => {
    if (closingRef.current) return;
    clearTimer(idleTimerRef);
    // Typing interrupts the entrance — drop the peek/greeting and lean in.
    clearEntranceTimers();
    setGreetingVisible(false);
    setGreeting(null);

    if (poseRef.current !== "jump" && poseRef.current !== "bloom") {
      setPose("typing");
    }

    idleTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setPose("idle");
    }, typingRestoreMs);
  }, [clearEntranceTimers, typingRestoreMs]);

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

  /** Live typing — swap face immediately, no auto-neutral timer. */
  const onCompanionLiveReaction = React.useCallback(
    (companionEmotion: CompanionEmotion, journalText?: string) => {
      if (closingRef.current) return;
      clearTimer(emotionTimerRef);
      setEmotion(companionToBlobEmotion(companionEmotion, journalText));
    },
    []
  );

  /** Milestone check-in — holds the expression, then eases back to neutral. */
  const onCompanionReaction = React.useCallback(
    (companionEmotion: CompanionEmotion, journalText?: string) => {
      onEmotionReaction(companionToBlobEmotion(companionEmotion, journalText));
    },
    [onEmotionReaction]
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
    onCompanionReaction,
    onCompanionLiveReaction,
    onClosing,
    runEnter,
  };
}
