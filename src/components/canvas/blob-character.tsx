"use client";

/**
 * BlobCharacter — small companion above the cursor in the writing column.
 *
 * Visual language (UI):
 *   - Soft bean silhouette, warm radial “paper” face, light drop shadow.
 *   - Refined eyes with highlights; calm mouth curves per state.
 *   - Optional blush (wave), mini pencil (scribble), path-based sleep Zs.
 *
 * Five states (driven by `state`) — motion unchanged from spec:
 *   - "wave"     → bounces in, waves once.
 *   - "scribble" → tiny walk-cycle while the user types.
 *   - "looking"  → curious head tilt + eyes scan (3s+ pause).
 *   - "sleep"    → slow breathing, closed eyes, floating Zz (30s+ idle).
 *   - "goodbye"  → wave + hop + fade out on close.
 *
 * Sizing: default 72px (viewBox 40×40; arms/Zz may bleed). Swap the SVG
 * body for Lottie later; keep props and call sites the same.
 */

import React from "react";
import clsx from "clsx";

export type BlobState =
  | "wave"
  | "scribble"
  | "looking"
  | "sleep"
  | "goodbye";

export type BlobCharacterProps = {
  state: BlobState;
  /** Visual size in px (renders in a 40×40 viewBox). */
  size?: number;
  className?: string;
  /** Optional ink color override. Defaults to a warm graphite. */
  color?: string;
  /** Optional paper-tint fill. Set to "transparent" for pure outline. */
  fill?: string;
  /** Hide entirely without unmounting (smooth state transitions). */
  hidden?: boolean;
};

const DEFAULT_INK = "#2C2C2A";
const DEFAULT_PAPER = "rgba(255, 252, 246, 0.85)";

export default function BlobCharacter({
  state,
  size = 72,
  className,
  color = DEFAULT_INK,
  fill = DEFAULT_PAPER,
  hidden = false,
}: BlobCharacterProps) {
  const uid = React.useId().replace(/:/g, "_");
  const faceGradId = `blob-face-${uid}`;
  const softShadowId = `blob-shadow-${uid}`;
  const useWarmFace = fill === DEFAULT_PAPER;
  const outlineOnly = fill === "transparent";

  /** Smooth asymmetric bean — tuned for ~20×21 center. */
  const bodyD =
    "M12.1 20.6 \
     C11.9 14.9, 15.6 12.0, 20.0 12.0 \
     C24.8 12.0, 28.2 15.4, 28.1 20.2 \
     C28.0 25.4, 24.3 28.7, 19.7 28.7 \
     C14.9 28.7, 12.1 25.6, 12.1 20.6 Z";

  const faceFill = useWarmFace ? `url(#${faceGradId})` : fill;
  const faceFilter = outlineOnly ? undefined : `url(#${softShadowId})`;

  return (
    <div
      data-blob-state={state}
      aria-hidden="true"
      className={clsx(
        "pointer-events-none select-none",
        "transition-opacity duration-300",
        hidden ? "opacity-0" : "opacity-100",
        className
      )}
      style={{
        width: size,
        height: size,
        transform: "translateY(-2px)",
      }}
    >
      <svg
        viewBox="0 0 40 40"
        width="100%"
        height="100%"
        fill="none"
        stroke={color}
        strokeWidth={1.15}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="overflow-visible"
      >
        {!outlineOnly && (
          <defs>
            {useWarmFace && (
              <radialGradient
                id={faceGradId}
                cx="0.34"
                cy="0.28"
                r="0.92"
                gradientUnits="objectBoundingBox"
              >
                <stop offset="0%" stopColor="#FFFCF8" />
                <stop offset="55%" stopColor="#FAF4EB" />
                <stop offset="100%" stopColor="#EDE4D8" />
              </radialGradient>
            )}
            <filter
              id={softShadowId}
              x="-35%"
              y="-35%"
              width="170%"
              height="170%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.15" result="b" />
              <feOffset dx="0" dy="1.35" in="b" result="o" />
              <feFlood floodColor="#1a1816" floodOpacity="0.14" result="f" />
              <feComposite in="f" in2="o" operator="in" result="sh" />
              <feMerge>
                <feMergeNode in="sh" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}

        {/* Ground contact shadow */}
        <ellipse
          cx="20"
          cy="33.2"
          rx="9"
          ry="1.15"
          fill={color}
          stroke="none"
          opacity={state === "sleep" ? 0.14 : 0.08}
          className={clsx(
            state === "scribble" && "blob-shadow-bounce",
            state === "sleep" && "blob-shadow-breathe"
          )}
        />

        <g
          className={clsx(
            "blob-body",
            state === "wave" && "blob-body-wave",
            state === "scribble" && "blob-body-scribble",
            state === "looking" && "blob-body-look",
            state === "sleep" && "blob-body-sleep",
            state === "goodbye" && "blob-body-goodbye"
          )}
          style={{ transformOrigin: "20px 21px" }}
          filter={faceFilter}
        >
          <path d={bodyD} fill={outlineOnly ? "none" : faceFill} stroke="none" />
          {!outlineOnly && (
            <path
              d={bodyD}
              stroke={color}
              strokeWidth={1.05}
              strokeOpacity={0.22}
              transform="translate(0.45, -0.25)"
            />
          )}
          <path
            d={bodyD}
            fill="none"
            stroke={color}
            strokeWidth={outlineOnly ? 1.25 : 1.08}
          />
        </g>

        {/* Face */}
        {state === "sleep" ? (
          <g strokeWidth={1.05}>
            <path d="M15.9 20.4 q 1.55 1.15 3.05 0.05" />
            <path d="M21.0 20.4 q 1.55 1.15 3.05 0.05" />
          </g>
        ) : (
          <g
            className={clsx(
              state === "looking" && "blob-eyes-look",
              state === "scribble" && "blob-eyes-blink"
            )}
            style={{ transformOrigin: "20px 20px" }}
          >
            <circle cx="16.85" cy="20.15" r="1.15" fill={color} stroke="none" />
            <circle
              cx="17.35"
              cy="19.75"
              r="0.38"
              fill="#FFFCFA"
              fillOpacity={0.92}
              stroke="none"
            />
            <circle cx="23.15" cy="20.15" r="1.15" fill={color} stroke="none" />
            <circle
              cx="23.65"
              cy="19.75"
              r="0.38"
              fill="#FFFCFA"
              fillOpacity={0.92}
              stroke="none"
            />
            {state === "looking" && (
              <>
                <path
                  d="M15.4 17.85 q 1.6 -0.55 2.85 -0.05"
                  strokeWidth={0.85}
                  strokeOpacity={0.5}
                />
                <path
                  d="M21.75 17.85 q 1.6 -0.55 2.85 -0.05"
                  strokeWidth={0.85}
                  strokeOpacity={0.5}
                />
              </>
            )}
          </g>
        )}

        <path
          d={
            state === "wave"
              ? "M17.0 23.6 Q20.0 26.4 23.0 23.6"
              : state === "sleep"
                ? "M18.35 24.0 q 1.65 0.45 3.3 0"
                : "M18.2 23.75 q 1.8 1.05 3.6 0"
          }
          strokeWidth={state === "wave" ? 1.05 : 1.0}
          className={clsx(state === "wave" && "blob-mouth-open")}
          style={{ transformOrigin: "20px 24px" }}
        />

        {state === "wave" && (
          <g opacity={0.42}>
            <circle
              cx="14.1"
              cy="22.4"
              r="1.05"
              fill="#E8A8A0"
              stroke="none"
            />
            <circle
              cx="25.9"
              cy="22.4"
              r="1.05"
              fill="#E8A8A0"
              stroke="none"
            />
          </g>
        )}

        {(state === "wave" || state === "goodbye" || state === "scribble") && (
          <path
            d={
              state === "scribble"
                ? "M27.6 22.2 q 3.4 -0.75 4.5 -2.65"
                : "M27.2 17.6 q 4.6 -1.85 6.0 -5.8"
            }
            strokeWidth={1.05}
            className={clsx(
              state === "wave" && "blob-arm-wave",
              state === "goodbye" && "blob-arm-goodbye",
              state === "scribble" && "blob-arm-scribble"
            )}
            style={{ transformOrigin: "27.5px 19.5px" }}
          />
        )}

        {state === "sleep" && (
          <g className="blob-zz" fill="none" stroke={color} strokeWidth={0.75}>
            <path
              d="M27.8 12.2 q 0.9 0.35 1.1 1.15 q -0.85 0.5 -1.0 1.35"
              className="blob-zz-path"
            />
            <path
              d="M31.2 8.4 q 0.65 0.25 0.85 0.85 q -0.6 0.35 -0.75 1.0"
              className="blob-zz-path blob-zz-2"
            />
          </g>
        )}

        {state === "scribble" && (
          <g className="blob-pencil" fill={color} stroke="none">
            <path
              d="M31.2 17.2 l 2.1 -2.05 l 0.55 0.55 l -2.1 2.05 z"
              opacity={0.45}
            />
            <path d="M33.0 15.35 l 0.95 0.95" stroke={color} strokeWidth={0.9} />
          </g>
        )}
      </svg>

      <style jsx>{`
        /* ── Body motion ───────────────────────────────────────────── */

        .blob-body-wave {
          animation: blob-wave-bounce 1.2s ease-out 1 both;
        }
        @keyframes blob-wave-bounce {
          0% {
            transform: translateY(4px) scale(0.9, 0.9);
            opacity: 0;
          }
          40% {
            transform: translateY(-2px) scale(1.05, 0.95);
            opacity: 1;
          }
          70% {
            transform: translateY(0px) scale(0.98, 1.02);
          }
          100% {
            transform: translateY(0px) scale(1, 1);
          }
        }

        .blob-body-scribble {
          animation: blob-scribble-walk 0.7s ease-in-out infinite;
        }
        @keyframes blob-scribble-walk {
          0% {
            transform: translateY(0) rotate(-2deg);
          }
          50% {
            transform: translateY(-1.5px) rotate(2deg);
          }
          100% {
            transform: translateY(0) rotate(-2deg);
          }
        }

        .blob-body-look {
          animation: blob-look-tilt 2.6s ease-in-out infinite;
        }
        @keyframes blob-look-tilt {
          0%,
          100% {
            transform: rotate(-3deg);
          }
          50% {
            transform: rotate(3deg);
          }
        }

        .blob-body-sleep {
          animation: blob-sleep-breathe 3.4s ease-in-out infinite;
        }
        @keyframes blob-sleep-breathe {
          0%,
          100% {
            transform: scale(1, 1);
          }
          50% {
            transform: scale(1.05, 0.95);
          }
        }

        .blob-body-goodbye {
          animation: blob-goodbye-hop 1.1s ease-in 1 forwards;
        }
        @keyframes blob-goodbye-hop {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translateY(-5px) scale(1.04, 0.96);
            opacity: 0.9;
          }
          100% {
            transform: translateY(3px) scale(0.92, 1.05);
            opacity: 0;
          }
        }

        /* ── Arm motion ────────────────────────────────────────────── */

        .blob-arm-wave {
          animation: blob-arm-wave 0.55s ease-in-out 3 both;
        }
        .blob-arm-goodbye {
          animation: blob-arm-wave 0.7s ease-in-out infinite;
        }
        @keyframes blob-arm-wave {
          0%,
          100% {
            transform: rotate(-12deg);
          }
          50% {
            transform: rotate(24deg);
          }
        }

        .blob-arm-scribble {
          animation: blob-arm-scribble 0.32s ease-in-out infinite;
        }
        @keyframes blob-arm-scribble {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-1px) rotate(10deg);
          }
        }

        /* ── Eyes / mouth ─────────────────────────────────────────── */

        .blob-eyes-look {
          animation: blob-eyes-scan 2.6s ease-in-out infinite;
        }
        @keyframes blob-eyes-scan {
          0%,
          100% {
            transform: translateX(-0.6px);
          }
          50% {
            transform: translateX(0.8px);
          }
        }

        .blob-eyes-blink {
          animation: blob-eyes-blink 2.2s ease-in-out infinite;
        }
        @keyframes blob-eyes-blink {
          0%,
          92%,
          100% {
            transform: scaleY(1);
          }
          96% {
            transform: scaleY(0.1);
          }
        }

        .blob-mouth-open {
          animation: blob-mouth-grin 1.2s ease-out 1 both;
        }
        @keyframes blob-mouth-grin {
          0% {
            transform: scale(0.6, 0.6);
          }
          60% {
            transform: scale(1.2, 1.1);
          }
          100% {
            transform: scale(1, 1);
          }
        }

        /* ── Sleep Zz's (path-based) ───────────────────────────────── */

        .blob-zz :global(.blob-zz-path) {
          animation: blob-zz-float 2.4s ease-out infinite;
          opacity: 0;
        }
        .blob-zz :global(.blob-zz-path.blob-zz-2) {
          animation-delay: 1.2s;
        }
        @keyframes blob-zz-float {
          0% {
            transform: translateY(2px);
            opacity: 0;
          }
          25% {
            opacity: 0.65;
          }
          100% {
            transform: translateY(-6px);
            opacity: 0;
          }
        }

        /* ── Scribble pencil ───────────────────────────────────────── */

        .blob-pencil {
          animation: blob-pencil-tick 0.32s ease-in-out infinite;
          transform-origin: 32px 16px;
        }
        @keyframes blob-pencil-tick {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(0.5px, -0.5px) rotate(8deg);
          }
        }

        /* ── Shadow ───────────────────────────────────────────────── */

        .blob-shadow-bounce {
          animation: blob-shadow-bounce 0.7s ease-in-out infinite;
          transform-origin: 20px 33px;
        }
        @keyframes blob-shadow-bounce {
          0%,
          100% {
            transform: scaleX(1);
          }
          50% {
            transform: scaleX(0.85);
          }
        }

        .blob-shadow-breathe {
          animation: blob-shadow-breathe 3.4s ease-in-out infinite;
          transform-origin: 20px 33px;
        }
        @keyframes blob-shadow-breathe {
          0%,
          100% {
            transform: scaleX(1);
          }
          50% {
            transform: scaleX(1.06);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .blob-body-wave,
          .blob-body-scribble,
          .blob-body-look,
          .blob-body-sleep,
          .blob-body-goodbye,
          .blob-arm-wave,
          .blob-arm-goodbye,
          .blob-arm-scribble,
          .blob-eyes-look,
          .blob-eyes-blink,
          .blob-mouth-open,
          .blob-pencil,
          .blob-shadow-bounce,
          .blob-shadow-breathe {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  useBlobState — small state machine helper                                  */
/* -------------------------------------------------------------------------- */

/**
 * Drives the BlobCharacter's state from typing / idle activity.
 *
 * Usage:
 *   const { state, onActivity, onClosing } = useBlobState();
 *   <BlobCharacter state={state} />
 *
 *   Call onActivity() on every keystroke in the writing area.
 *   Call onClosing() right before navigating away; it switches to "goodbye"
 *   and resolves the returned promise once the animation has visually settled.
 */

export type UseBlobStateOptions = {
  /** ms of inactivity before switching to "looking". Spec: 3000. */
  lookAfterMs?: number;
  /** ms of inactivity before switching to "sleep". Spec: 30000. */
  sleepAfterMs?: number;
  /** ms the opening wave is held. */
  waveDurationMs?: number;
  /** ms the goodbye animation is held before resolving. */
  goodbyeDurationMs?: number;
};

export function useBlobState(opts: UseBlobStateOptions = {}) {
  const {
    lookAfterMs = 3000,
    sleepAfterMs = 30000,
    waveDurationMs = 1400,
    goodbyeDurationMs = 1100,
  } = opts;

  const [state, setState] = React.useState<BlobState>("wave");
  const lookTimerRef = React.useRef<number | null>(null);
  const sleepTimerRef = React.useRef<number | null>(null);
  const waveTimerRef = React.useRef<number | null>(null);
  const closingRef = React.useRef(false);

  const clearTimers = React.useCallback(() => {
    if (lookTimerRef.current !== null) {
      window.clearTimeout(lookTimerRef.current);
      lookTimerRef.current = null;
    }
    if (sleepTimerRef.current !== null) {
      window.clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
  }, []);

  // Initial wave → looking after waveDurationMs → sleep after sleepAfterMs.
  React.useEffect(() => {
    waveTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setState("looking");
      sleepTimerRef.current = window.setTimeout(() => {
        if (!closingRef.current) setState("sleep");
      }, Math.max(0, sleepAfterMs - lookAfterMs));
    }, waveDurationMs);
    return () => {
      if (waveTimerRef.current !== null)
        window.clearTimeout(waveTimerRef.current);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onActivity = React.useCallback(() => {
    if (closingRef.current) return;
    clearTimers();
    setState("scribble");
    lookTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setState("looking");
      sleepTimerRef.current = window.setTimeout(() => {
        if (!closingRef.current) setState("sleep");
      }, Math.max(0, sleepAfterMs - lookAfterMs));
    }, lookAfterMs);
  }, [clearTimers, lookAfterMs, sleepAfterMs]);

  const onClosing = React.useCallback((): Promise<void> => {
    closingRef.current = true;
    clearTimers();
    setState("goodbye");
    return new Promise((resolve) => {
      window.setTimeout(resolve, goodbyeDurationMs);
    });
  }, [clearTimers, goodbyeDurationMs]);

  return { state, setState, onActivity, onClosing };
}
