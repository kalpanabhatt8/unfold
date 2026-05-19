"use client";

/**
 * BlobCharacter — soft mochi-style companion for the writing canvas.
 *
 * One cohesive SVG entity. The body (squishy head + two stub arms),
 * sparkly eyes, blush, and tiny mouth stay identical across every state;
 * only the eye shape, mouth shape, eyebrow, arm rotation, and body tilt
 * change. Purposely cute: big highlights, pink cheeks, gentle smile.
 *
 * States:
 *   - "idle"     → relaxed, gentle 3px bob, soft smile.
 *   - "typing"   → squinted eyes, focused little line of a mouth, taps.
 *   - "sleeping" → closed eyes + tiny "o" + floating Z's; tilts 12° right.
 *   - "waking"   → snap-open wide eyes + surprised "o" + arms up.
 *   - "saving"   → happy squint + big smile + arms up, then fades.
 *
 * Pure SVG + CSS animation — no external libraries, no Lottie.
 */

import React from "react";
import clsx from "clsx";

export type BlobState = "idle" | "typing" | "sleeping" | "waking" | "saving";

export type BlobCharacterProps = {
  state: BlobState;
  /** Visual size in px (renders inside a 60×60 viewBox so arms/Z's bleed). */
  size?: number;
  className?: string;
  /** Hide entirely without unmounting (smooth state transitions). */
  hidden?: boolean;
  /**
   * Called when the user hovers the character while it is sleeping.
   * Consumers wire this to `useBlobState().onWakeUp`.
   */
  onWakeUp?: () => void;
};

const INK = "#2C2C2A";
const PAPER = "#FBF6EE";
const HIGHLIGHT = "#FFFFFF";
const BLUSH = "#F4A8A0";

/* -------------------------------------------------------------------------- */
/*  Visual primitives                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Soft squishy head — slightly chubbier than a perfect ellipse, with a
 * touch of asymmetry so it never reads as a stamped-out circle.
 * Centered around (30, 30) — width ~40, height ~36.
 */
const HEAD_PATH =
  "M 10.0 29.0 \
   C 9.6 18.2 16.8 11.4 30.4 11.2 \
   C 44.0 11.6 50.6 18.6 50.0 30.6 \
   C 49.6 41.8 43.0 48.6 29.6 48.6 \
   C 16.0 48.2 9.4 41.8 10.0 29.0 Z";

/** Eye + face geometry. */
const EYE_RX = 5;
const EYE_RY = 6.5;
const LEFT_EYE_CX = 24;
const RIGHT_EYE_CX = 36;
const EYE_CY = 29;

const LEFT_BLUSH_CX = 16.5;
const RIGHT_BLUSH_CX = 43.5;
const BLUSH_CY = 36.5;

/* -------------------------------------------------------------------------- */
/*  Eye, eyebrow, mouth                                                       */
/* -------------------------------------------------------------------------- */

function Eye({ cx, state }: { cx: number; state: BlobState }) {
  if (state === "sleeping") {
    return (
      <path
        d={`M ${cx - 5} ${EYE_CY} q 5 1.8 10 0`}
        fill="none"
        stroke={INK}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    );
  }
  if (state === "saving") {
    return (
      <path
        d={`M ${cx - 5} ${EYE_CY + 1} q 5 -3.6 10 0`}
        fill="none"
        stroke={INK}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    );
  }

  // Idle / typing / waking — animated oval with sparkle highlights.
  return (
    <g
      className={`blob-eye blob-eye--${state}`}
      style={{ transformOrigin: `${cx}px ${EYE_CY}px` }}
    >
      <ellipse cx={cx} cy={EYE_CY} rx={EYE_RX} ry={EYE_RY} fill={INK} />
      {/* Big main shimmer — top-right. */}
      <ellipse
        cx={cx + 1.6}
        cy={EYE_CY - 2.6}
        rx={1.7}
        ry={2.1}
        fill={HIGHLIGHT}
      />
      {/* Tiny secondary sparkle — bottom-left. */}
      <circle
        cx={cx - 1.6}
        cy={EYE_CY + 2.4}
        r={0.85}
        fill={HIGHLIGHT}
        opacity={0.75}
      />
    </g>
  );
}

function Eyebrow({ state }: { state: BlobState }) {
  let d: string;
  switch (state) {
    case "typing":
      d = "M 19.5 17.4 Q 30 19.4 40.5 17.4";
      break;
    case "sleeping":
      d = "M 19.8 16.0 Q 30 14.4 40.2 16.0";
      break;
    case "waking":
      d = "M 19.5 12.4 Q 30 9.4 40.5 12.4";
      break;
    case "saving":
      d = "M 19.5 14.6 Q 30 11.6 40.5 14.6";
      break;
    case "idle":
    default:
      d = "M 19.8 17.4 Q 30 15.4 40.2 17.4";
      break;
  }
  return (
    <path
      className="blob-eyebrow"
      d={d}
      fill="none"
      stroke={INK}
      strokeWidth={1.4}
      strokeLinecap="round"
      opacity={0.85}
    />
  );
}

function Mouth({ state }: { state: BlobState }) {
  // Sleeping & waking — small open mouth (a tiny ink dot/oval).
  if (state === "sleeping") {
    return <ellipse cx={30} cy={39.4} rx={0.85} ry={1.3} fill={INK} />;
  }
  if (state === "waking") {
    return <ellipse cx={30} cy={40} rx={1.6} ry={2.1} fill={INK} />;
  }

  // Saving — big happy smile.
  if (state === "saving") {
    return (
      <path
        d="M 26.6 38.2 Q 30 41.6 33.4 38.2"
        fill="none"
        stroke={INK}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    );
  }

  // Typing — focused tiny line.
  if (state === "typing") {
    return (
      <path
        d="M 28.4 39.4 L 31.6 39.4"
        stroke={INK}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    );
  }

  // Idle — soft little smile.
  return (
    <path
      d="M 28.0 39.0 Q 30 40.4 32.0 39.0"
      fill="none"
      stroke={INK}
      strokeWidth={1.3}
      strokeLinecap="round"
    />
  );
}

/** Permanent rosy cheeks. Subtle — adds warmth without becoming a clown. */
function Blush() {
  return (
    <g opacity={0.55}>
      <ellipse
        cx={LEFT_BLUSH_CX}
        cy={BLUSH_CY}
        rx={3.2}
        ry={2.1}
        fill={BLUSH}
      />
      <ellipse
        cx={RIGHT_BLUSH_CX}
        cy={BLUSH_CY}
        rx={3.2}
        ry={2.1}
        fill={BLUSH}
      />
    </g>
  );
}

function SleepZs() {
  return (
    <g
      className="blob-zzz"
      fill={INK}
      stroke="none"
      style={{
        fontFamily:
          "var(--font-manrope), system-ui, -apple-system, sans-serif",
        fontWeight: 700,
      }}
    >
      <text className="blob-z blob-z-1" x={49} y={20} fontSize={8}>
        z
      </text>
      <text className="blob-z blob-z-2" x={53} y={13} fontSize={6}>
        z
      </text>
      <text className="blob-z blob-z-3" x={56} y={8} fontSize={4}>
        z
      </text>
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  BlobCharacter                                                              */
/* -------------------------------------------------------------------------- */

export default function BlobCharacter({
  state,
  size = 76,
  className,
  hidden = false,
  onWakeUp,
}: BlobCharacterProps) {
  const handlePointerEnter = React.useCallback(() => {
    if (state === "sleeping") onWakeUp?.();
  }, [state, onWakeUp]);

  return (
    <div
      data-blob-state={state}
      aria-hidden="true"
      onPointerEnter={handlePointerEnter}
      className={clsx(
        "select-none transition-opacity duration-300",
        hidden ? "opacity-0" : "opacity-100",
        state === "sleeping" ? "cursor-pointer" : "cursor-default",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 60 60"
        width="100%"
        height="100%"
        fill="none"
        className="overflow-visible"
      >
        {/* Soft contact shadow under the head — a calm grounding touch. */}
        <ellipse
          className={`blob-shadow blob-shadow--${state}`}
          cx={30}
          cy={51}
          rx={14}
          ry={1.4}
          fill={INK}
          opacity={0.1}
        />

        {/* Body group — receives per-state tilt + bob animations. */}
        <g
          className={`blob-body blob-body--${state}`}
          style={{ transformOrigin: "30px 46px" }}
        >
          {/* Arms — drawn before the head so the head sits on top. */}
          <rect
            className={`blob-arm blob-arm-left blob-arm-left--${state}`}
            x={2.5}
            y={26}
            width={8}
            height={14}
            rx={4}
            ry={4}
            fill={PAPER}
            stroke={INK}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <rect
            className={`blob-arm blob-arm-right blob-arm-right--${state}`}
            x={49.5}
            y={26}
            width={8}
            height={14}
            rx={4}
            ry={4}
            fill={PAPER}
            stroke={INK}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* Head */}
          <path
            d={HEAD_PATH}
            fill={PAPER}
            stroke={INK}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* Tiny tuft of hair on top — a little personality. */}
          <path
            d="M 28.6 11.6 Q 30 8 31.4 11.4"
            fill="none"
            stroke={INK}
            strokeWidth={1.4}
            strokeLinecap="round"
          />

          {/* Face */}
          <Eyebrow state={state} />
          <Eye cx={LEFT_EYE_CX} state={state} />
          <Eye cx={RIGHT_EYE_CX} state={state} />
          <Blush />
          <Mouth state={state} />
        </g>

        {state === "sleeping" && <SleepZs />}
      </svg>

      <style jsx>{`
        /* ── Body bob / tilt ─────────────────────────────────────── */

        :global(.blob-body) {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        :global(.blob-body--idle) {
          animation: blob-bob-idle 2s ease-in-out infinite;
        }
        @keyframes blob-bob-idle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        :global(.blob-body--typing) {
          animation: blob-typing-lean 0.9s ease-in-out infinite;
        }
        @keyframes blob-typing-lean {
          0%,
          100% {
            transform: rotate(5deg) translateY(0);
          }
          50% {
            transform: rotate(5deg) translateY(-1.5px);
          }
        }

        :global(.blob-body--sleeping) {
          animation: blob-bob-sleep 3s ease-in-out infinite;
        }
        @keyframes blob-bob-sleep {
          0%,
          100% {
            transform: rotate(12deg) translateY(0);
          }
          50% {
            transform: rotate(12deg) translateY(-4px);
          }
        }

        :global(.blob-body--waking) {
          animation: blob-wake 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes blob-wake {
          0% {
            transform: rotate(12deg) translateY(0);
          }
          15% {
            transform: rotate(0deg) translateY(-3px);
          }
          100% {
            transform: rotate(0deg) translateY(0);
          }
        }

        :global(.blob-body--saving) {
          animation: blob-save 1.1s ease-in-out forwards;
        }
        @keyframes blob-save {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          15% {
            transform: translateY(-6px);
            opacity: 1;
          }
          30% {
            transform: translateY(0);
            opacity: 1;
          }
          45% {
            transform: translateY(-6px);
            opacity: 1;
          }
          60% {
            transform: translateY(0);
            opacity: 1;
          }
          100% {
            transform: translateY(0);
            opacity: 0;
          }
        }

        /* ── Shadow — squashes a touch with each bob. ─────────────── */
        :global(.blob-shadow) {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: 30px 51px;
        }
        :global(.blob-shadow--idle) {
          animation: blob-shadow-bob 2s ease-in-out infinite;
        }
        :global(.blob-shadow--sleeping) {
          animation: blob-shadow-bob 3s ease-in-out infinite;
        }
        @keyframes blob-shadow-bob {
          0%,
          100% {
            transform: scaleX(1);
          }
          50% {
            transform: scaleX(0.9);
          }
        }

        /* ── Arms ────────────────────────────────────────────────── */

        :global(.blob-arm) {
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        :global(.blob-arm-right--typing) {
          transform-origin: 53.5px 27px;
          animation: blob-arm-tap 0.3s ease-in-out infinite;
        }
        @keyframes blob-arm-tap {
          0%,
          100% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(-30deg);
          }
        }

        :global(.blob-arm-left--sleeping) {
          transform-origin: 6.5px 27px;
          transform: rotate(-12deg) translateY(2px);
        }
        :global(.blob-arm-right--sleeping) {
          transform-origin: 53.5px 27px;
          transform: rotate(12deg) translateY(2px);
        }

        :global(.blob-arm-left--waking) {
          transform-origin: 6.5px 27px;
          animation: blob-arm-wake-l 0.5s ease-out forwards;
        }
        :global(.blob-arm-right--waking) {
          transform-origin: 53.5px 27px;
          animation: blob-arm-wake-r 0.5s ease-out forwards;
        }
        @keyframes blob-arm-wake-l {
          0% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(45deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
        @keyframes blob-arm-wake-r {
          0% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-45deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }

        :global(.blob-arm-left--saving) {
          transform-origin: 6.5px 27px;
          animation: blob-arm-save-l 1.1s ease-out forwards;
        }
        :global(.blob-arm-right--saving) {
          transform-origin: 53.5px 27px;
          animation: blob-arm-save-r 1.1s ease-out forwards;
        }
        @keyframes blob-arm-save-l {
          0% {
            transform: rotate(0deg);
          }
          20% {
            transform: rotate(60deg);
          }
          100% {
            transform: rotate(60deg);
          }
        }
        @keyframes blob-arm-save-r {
          0% {
            transform: rotate(0deg);
          }
          20% {
            transform: rotate(-60deg);
          }
          100% {
            transform: rotate(-60deg);
          }
        }

        /* ── Eyes ────────────────────────────────────────────────── */

        :global(.blob-eye) {
          transition: transform 0.15s ease-out;
        }
        :global(.blob-eye--idle) {
          transform: scaleY(1);
        }
        :global(.blob-eye--typing) {
          transform: scaleY(0.62);
        }
        :global(.blob-eye--waking) {
          animation: blob-eye-wake 0.15s ease-out forwards;
        }
        @keyframes blob-eye-wake {
          0% {
            transform: scaleY(0.05);
          }
          100% {
            transform: scaleY(1.23);
          }
        }

        /* ── Sleep Z's ───────────────────────────────────────────── */

        :global(.blob-z) {
          opacity: 0;
          animation: blob-z-float 1.8s ease-out infinite;
        }
        :global(.blob-z-1) {
          animation-delay: 0s;
        }
        :global(.blob-z-2) {
          animation-delay: 0.6s;
        }
        :global(.blob-z-3) {
          animation-delay: 1.2s;
        }
        @keyframes blob-z-float {
          0% {
            opacity: 0;
            transform: translateY(2px);
          }
          20% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
            transform: translateY(-10px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          :global(.blob-body),
          :global(.blob-body--idle),
          :global(.blob-body--typing),
          :global(.blob-body--sleeping),
          :global(.blob-body--waking),
          :global(.blob-body--saving),
          :global(.blob-shadow--idle),
          :global(.blob-shadow--sleeping),
          :global(.blob-arm-right--typing),
          :global(.blob-arm-left--waking),
          :global(.blob-arm-right--waking),
          :global(.blob-arm-left--saving),
          :global(.blob-arm-right--saving),
          :global(.blob-eye--waking),
          :global(.blob-z) {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  useBlobState — small state machine helper                                 */
/* -------------------------------------------------------------------------- */

/**
 * Drives the BlobCharacter's state from typing / idle / save activity.
 *
 * Lifecycle:
 *   - Mount → "idle" with the gentle bob.
 *   - onActivity()  → "typing" (auto-returns to idle ~0.9s after last call).
 *   - 20s of inactivity → "sleeping" (with floating Zs).
 *   - onWakeUp()    → "waking" → "idle" (only effective while sleeping).
 *   - onSave()      → "saving" → fades out → "idle" again.
 *   - onClosing()   → "saving" → resolves once the fade has settled.
 */

export type UseBlobStateOptions = {
  typingRestoreMs?: number;
  sleepAfterMs?: number;
  wakeDurationMs?: number;
  saveDurationMs?: number;
};

export function useBlobState(opts: UseBlobStateOptions = {}) {
  const {
    typingRestoreMs = 900,
    sleepAfterMs = 20_000,
    wakeDurationMs = 800,
    saveDurationMs = 1100,
  } = opts;

  const [state, setState] = React.useState<BlobState>("idle");
  const [hidden, setHidden] = React.useState(false);

  const sleepTimerRef = React.useRef<number | null>(null);
  const idleTimerRef = React.useRef<number | null>(null);
  const wakeTimerRef = React.useRef<number | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const closingRef = React.useRef(false);
  const stateRef = React.useRef<BlobState>("idle");

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearTimer = (
    ref: React.MutableRefObject<number | null>
  ) => {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const clearAll = React.useCallback(() => {
    clearTimer(sleepTimerRef);
    clearTimer(idleTimerRef);
    clearTimer(wakeTimerRef);
    clearTimer(saveTimerRef);
  }, []);

  const scheduleSleep = React.useCallback(() => {
    clearTimer(sleepTimerRef);
    sleepTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setState("sleeping");
    }, sleepAfterMs);
  }, [sleepAfterMs]);

  React.useEffect(() => {
    scheduleSleep();
    return clearAll;
  }, [clearAll, scheduleSleep]);

  const onActivity = React.useCallback(() => {
    if (closingRef.current) return;
    clearTimer(sleepTimerRef);
    clearTimer(idleTimerRef);
    setState("typing");
    idleTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setState("idle");
      scheduleSleep();
    }, typingRestoreMs);
  }, [scheduleSleep, typingRestoreMs]);

  const onWakeUp = React.useCallback(() => {
    if (closingRef.current) return;
    if (stateRef.current !== "sleeping") return;
    clearTimer(wakeTimerRef);
    setState("waking");
    wakeTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setState("idle");
      scheduleSleep();
    }, wakeDurationMs);
  }, [scheduleSleep, wakeDurationMs]);

  const onSave = React.useCallback(() => {
    if (closingRef.current) return;
    clearAll();
    setState("saving");
    saveTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setState("idle");
      scheduleSleep();
    }, saveDurationMs);
  }, [clearAll, saveDurationMs, scheduleSleep]);

  const onClosing = React.useCallback((): Promise<void> => {
    closingRef.current = true;
    clearAll();
    setState("saving");
    return new Promise((resolve) => {
      window.setTimeout(() => {
        setHidden(true);
        resolve();
      }, saveDurationMs);
    });
  }, [clearAll, saveDurationMs]);

  return {
    state,
    setState,
    hidden,
    onActivity,
    onWakeUp,
    onSave,
    onClosing,
  };
}
