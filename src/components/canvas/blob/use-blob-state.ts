"use client";

import React from "react";
import type { BlobEmotion, BlobPose } from "./types";
import {
  companionAnalysisToBlob,
  needsNeutralTransition,
  type CompanionAnalysis,
  type CompanionSessionMeta,
} from "@/lib/companion-analysis";
import {
  logCompanionApplyDecision,
  logCompanionEmotionChange,
  logCompanionEmotionOverride,
} from "@/lib/companion-debug";
import { pickEntranceGreeting } from "./entrance-greetings";
import { COMPANION_EMOTION_TRANSITION_MS } from "@/lib/companion-pause";
import {
  ENTRANCE_DURATION_MS,
  GREETING_DURATION_S,
  PEEK_DELAY_MS,
  PEEK_HOLD_MS,
  SEAL_WHISPER_FADE_IN_MS,
  SEAL_WHISPER_FADE_OUT_MS,
  SEAL_WHISPER_STAY_MS,
  WAKE_DURATION_MS,
  WAKE_SURPRISE_MS,
} from "./layout";

export const GREETING_DURATION_MS = GREETING_DURATION_S * 1000;
const GREETING_FADE_MS = 450;

export type UseBlobStateOptions = {
  bookId?: string;
  enterDurationMs?: number;
  peekDelayMs?: number;
  peekHoldMs?: number;
  enterOnMount?: boolean;
  onEmotionApplied?: (emotion: BlobEmotion) => void;
  /** Fires when the seal whisper finishes (or is skipped) — arm idle sleep. */
  onSealWhisperSettled?: () => void;
};

export function useBlobState(opts: UseBlobStateOptions = {}) {
  const {
    bookId = "default",
    enterDurationMs = ENTRANCE_DURATION_MS,
    peekDelayMs = PEEK_DELAY_MS,
    peekHoldMs = PEEK_HOLD_MS,
    enterOnMount = true,
    onEmotionApplied,
    onSealWhisperSettled,
  } = opts;

  const onEmotionAppliedRef = React.useRef(onEmotionApplied);
  React.useEffect(() => {
    onEmotionAppliedRef.current = onEmotionApplied;
  }, [onEmotionApplied]);
  const onSealWhisperSettledRef = React.useRef(onSealWhisperSettled);
  React.useEffect(() => {
    onSealWhisperSettledRef.current = onSealWhisperSettled;
  }, [onSealWhisperSettled]);

  const [pose, setPose] = React.useState<BlobPose>(() =>
    enterOnMount ? "peek" : "idle"
  );
  const [emotion, setEmotion] = React.useState<BlobEmotion>("neutral");
  const [hidden, setHidden] = React.useState(enterOnMount);
  const [greeting, setGreeting] = React.useState<string | null>(null);
  const [greetingVisible, setGreetingVisible] = React.useState(false);
  const [whisper, setWhisper] = React.useState<string | null>(null);
  const [whisperVisible, setWhisperVisible] = React.useState(false);
  const [whisperFadeMs, setWhisperFadeMs] = React.useState(450);

  const transitionTimerRef = React.useRef<number | null>(null);
  const sealWhisperFadeOutTimerRef = React.useRef<number | null>(null);
  const sealWhisperRestTimerRef = React.useRef<number | null>(null);
  const enterTimerRef = React.useRef<number | null>(null);
  const wakeTimerRef = React.useRef<number | null>(null);
  const wakeSettleTimerRef = React.useRef<number | null>(null);
  const peekTimerRef = React.useRef<number | null>(null);
  const slideTimerRef = React.useRef<number | null>(null);
  const greetingClearTimerRef = React.useRef<number | null>(null);
  const closingRef = React.useRef(false);
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
    clearTimer(transitionTimerRef);
    clearTimer(wakeTimerRef);
    clearTimer(wakeSettleTimerRef);
    clearTimer(sealWhisperFadeOutTimerRef);
    clearTimer(sealWhisperRestTimerRef);
    clearEntranceTimers();
  }, [clearEntranceTimers]);

  const applyBlobEmotion = React.useCallback(
    (next: BlobEmotion, source = "applyBlobEmotion") => {
      if (sleepingRef.current) {
        if (awakeEmotionRef.current !== next) {
          logCompanionEmotionChange(source, awakeEmotionRef.current, next);
        }
        awakeEmotionRef.current = next;
        return;
      }
      const prev = emotionRef.current;
      if (prev !== next) {
        logCompanionEmotionChange(source, prev, next);
        console.log(`[🌻 blob] 🎭 emotion: "${prev}" → "${next}" (${source})`);
      }
      clearTimer(transitionTimerRef);
      emotionRef.current = next;
      setEmotion(next);
    },
    []
  );

  const applyBlobEmotionSmooth = React.useCallback(
    (
      next: BlobEmotion
    ): { applied: BlobEmotion | null; viaNeutral: boolean } => {
      const current = emotionRef.current;
      if (current === next) return { applied: null, viaNeutral: false };

      if (needsNeutralTransition(current, next)) {
        emotionRef.current = "neutral";
        setEmotion("neutral");
        logCompanionEmotionChange("transition-via-neutral", current, "neutral");
        transitionTimerRef.current = window.setTimeout(() => {
          applyBlobEmotion(next, "transition-complete");
        }, COMPANION_EMOTION_TRANSITION_MS);
        return { applied: next, viaNeutral: true };
      }

      applyBlobEmotion(next, "applyBlobEmotionSmooth");
      return { applied: next, viaNeutral: false };
    },
    [applyBlobEmotion]
  );

  /** Sealed session — calm and awake (reopen, or no whisper after stamp). */
  const enterSealedNeutral = React.useCallback(() => {
    if (closingRef.current) return;
    sleepingRef.current = false;
    clearTimer(transitionTimerRef);
    clearTimer(sealWhisperFadeOutTimerRef);
    clearTimer(sealWhisperRestTimerRef);
    setWhisperVisible(false);
    setWhisper(null);
    setPose("idle");
    setEmotion("neutral");
    awakeEmotionRef.current = "neutral";
  }, []);

  /** After the seal whisper fades — eyes closed, session complete. */
  const enterPeacefulResting = React.useCallback(() => {
    if (closingRef.current) return;
    sleepingRef.current = true;
    clearTimer(transitionTimerRef);
    clearTimer(sealWhisperFadeOutTimerRef);
    clearTimer(sealWhisperRestTimerRef);
    setWhisperVisible(false);
    setWhisper(null);
    setPose("idle");
    setEmotion("sleep");
  }, []);

  const onSealReaction = React.useCallback(
    (phrase: string | null) => {
      if (closingRef.current) return;

      clearTimer(sealWhisperFadeOutTimerRef);
      clearTimer(sealWhisperRestTimerRef);
      setWhisperVisible(false);

      if (!phrase) {
        enterSealedNeutral();
        onSealWhisperSettledRef.current?.();
        return;
      }

      setWhisperFadeMs(SEAL_WHISPER_FADE_IN_MS);
      setWhisper(phrase);
      requestAnimationFrame(() => {
        setWhisperVisible(true);
      });

      sealWhisperFadeOutTimerRef.current = window.setTimeout(() => {
        setWhisperFadeMs(SEAL_WHISPER_FADE_OUT_MS);
        setWhisperVisible(false);
      }, SEAL_WHISPER_FADE_IN_MS + SEAL_WHISPER_STAY_MS);

      sealWhisperRestTimerRef.current = window.setTimeout(() => {
        setWhisper(null);
        enterSealedNeutral();
        onSealWhisperSettledRef.current?.();
      }, SEAL_WHISPER_FADE_IN_MS + SEAL_WHISPER_STAY_MS + SEAL_WHISPER_FADE_OUT_MS);
    },
    [enterSealedNeutral]
  );

  const runEnter = React.useCallback(() => {
    if (closingRef.current) return;
    clearEntranceTimers();
    entranceCompleteRef.current = false;

    setHidden(true);
    setPose("peek");
    setGreeting(null);
    setGreetingVisible(false);

    peekTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setHidden(false);
      setPose("peek");
      setGreeting(pickEntranceGreeting(bookId));
      setGreetingVisible(true);

      slideTimerRef.current = window.setTimeout(() => {
        if (closingRef.current) return;
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

  /** UI pose while writing — typing, listening (attentive), or idle. */
  const onCompanionPhase = React.useCallback(
    (phase: "writing" | "listening" | "idle") => {
      if (closingRef.current || !entranceCompleteRef.current) return;
      if (poseRef.current === "jump" || poseRef.current === "bloom") return;

      if (phase === "writing") setPose("typing");
      else if (phase === "listening") setPose("listening");
      else setPose("idle");
    },
    []
  );

  const onEmotionFromWriting = React.useCallback((next: BlobEmotion) => {
    if (closingRef.current) return;
    if (next === "sleep") {
      sleepingRef.current = true;
      clearTimer(transitionTimerRef);
      setWhisperVisible(false);
      setEmotion("sleep");
      return;
    }
    sleepingRef.current = false;
    applyBlobEmotion(next);
  }, [applyBlobEmotion]);

  const onWakeFromSleep = React.useCallback(
    (opts?: { typing?: boolean }): boolean => {
      if (closingRef.current || !sleepingRef.current) return false;
      sleepingRef.current = false;
      clearTimer(transitionTimerRef);
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

  const verifyEmotionAfterUpdate = React.useCallback(
    (expected: BlobEmotion, viaNeutral: boolean) => {
      queueMicrotask(() => {
        const actual = emotionRef.current;
        if (viaNeutral && actual === "neutral") return;
        if (actual !== expected) {
          logCompanionEmotionOverride(expected, actual, "immediate-after-update");
        }
      });
      if (viaNeutral) {
        window.setTimeout(() => {
          const actual = emotionRef.current;
          if (actual !== expected) {
            logCompanionEmotionOverride(expected, actual, "after-neutral-transition");
          }
        }, COMPANION_EMOTION_TRANSITION_MS + 50);
      }
    },
    []
  );

  const logApplyDecision = React.useCallback(
    (
      decision: Omit<
        Parameters<typeof logCompanionApplyDecision>[0],
        "emotionAfterUpdate"
      >,
      applied: BlobEmotion | null,
      viaNeutral: boolean
    ) => {
      logCompanionApplyDecision({
        ...decision,
        emotionAfterUpdate: emotionRef.current,
      });
      if (applied) verifyEmotionAfterUpdate(applied, viaNeutral);
    },
    [verifyEmotionAfterUpdate]
  );

  const resetCompanionState = React.useCallback(() => {
    sleepingRef.current = false;
    clearTimer(transitionTimerRef);
    clearTimer(wakeTimerRef);
    clearTimer(wakeSettleTimerRef);
    setWhisperVisible(false);
    const prev = emotionRef.current;
    if (prev !== "neutral") {
      logCompanionEmotionChange("resetCompanionState", prev, "neutral");
    }
    setEmotion("neutral");
    awakeEmotionRef.current = "neutral";
  }, []);

  const onCompanionAnalysis = React.useCallback(
    (
      analysis: CompanionAnalysis,
      text: string,
      sessionMeta?: CompanionSessionMeta
    ) => {
      if (closingRef.current) return;

      const currentEmotion = emotionRef.current;
      const mappedEmotion = companionAnalysisToBlob(analysis);
      // Full-context reclassifies (deletion + initial resumed-draft load) read
      // the whole canvas, so trust them even at low confidence.
      const isFullCanvas =
        sessionMeta?.classificationStrategy === "deletion" ||
        sessionMeta?.classificationStrategy === "initial";
      const confidenceGatePassed =
        analysis.confidence !== "low" || isFullCanvas;
      const sameEmotion = currentEmotion === mappedEmotion;

      const baseDecision = {
        contextSent: text,
        rawResponse: analysis,
        mappedEmotion,
        currentEmotion,
        totalTextWords: sessionMeta?.totalTextWords,
      };

      if (!confidenceGatePassed) {
        logApplyDecision(
          {
            ...baseDecision,
            confidenceGatePassed: false,
            transitionViaNeutral: false,
            transitionAllowed: false,
            finalEmotionApplied: null,
            blockedReason: `confidence gate (${analysis.confidence})`,
          },
          null,
          false
        );
        return;
      }

      if (sameEmotion) {
        logApplyDecision(
          {
            ...baseDecision,
            confidenceGatePassed: true,
            transitionViaNeutral: false,
            transitionAllowed: false,
            finalEmotionApplied: null,
            blockedReason: "already showing mapped emotion",
          },
          null,
          false
        );
        return;
      }

      const { applied, viaNeutral } = applyBlobEmotionSmooth(mappedEmotion);

      logApplyDecision(
        {
          ...baseDecision,
          confidenceGatePassed: true,
          transitionViaNeutral: viaNeutral,
          transitionAllowed: applied !== null,
          finalEmotionApplied: applied,
        },
        applied,
        viaNeutral
      );

      if (applied) {
        onEmotionAppliedRef.current?.(applied);
      }
    },
    [applyBlobEmotionSmooth, logApplyDecision]
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
    whisper,
    whisperVisible,
    whisperFadeMs,
    onCompanionPhase,
    onCompanionAnalysis,
    onEmotionFromWriting,
    onWakeFromSleep,
    onClosing,
    runEnter,
    resetCompanionState,
    onSealReaction,
    enterSealedNeutral,
    enterPeacefulResting,
  };
};
