"use client";

import React from "react";
import clsx from "clsx";
import type { BlobCharacterProps, BlobEmotion, BloomLevel } from "./types";
import { ASSET_SIZE, BASE, EMOTION_ASSETS, SLEEP_Z_LETTER } from "./assets";
import {
  BODY_CX,
  BODY_CY,
  BODY_TX,
  BODY_TY,
  BLUSH_CY,
  ENTRANCE_DURATION_S,
  FACE_RX,
  GLOW_RADIUS,
  GREETING_DURATION_S,
  LEFT_BLUSH_CX,
  LEFT_EYE_CX,
  LOVE_BG_POS,
  LOVE_BG_RISE_DURATION_S,
  LOVE_BG_STREAM_COUNT,
  MOUTH_CX,
  MOUTH_CY,
  PEEK_LIFT_PCT,
  PEEK_ROTATE_DEG,
  PEEK_TRANSFORM_ORIGIN,
  PEEK_TRANSLATE_PCT,
  RIGHT_BLUSH_CX,
  RIGHT_EYE_CX,
  EYE_CY,
  LEAF_LEFT_POS,
  LEAF_RIGHT_POS,
  LEAF_SCALE,
  LEAF_STEM_LEFT,
  LEAF_STEM_RIGHT,
  BLOOM_GLOW_STEP,
  BLOOM_SCALE_STEP,
  TYPING_LEAN_DURATION_S,
  TYPING_LEAN_FLOAT_PX,
  TYPING_LEAN_ROTATE_DEG,
  TYPING_LEAF_SWAY_DURATION_S,
  TYPING_LEAF_SWAY_DEG,
  SLEEP_ZZZ_CYCLE_S,
  SLEEP_ZZZ_LETTER_COUNT,
  SLEEP_ZZZ_LETTER_SCALE,
  SLEEP_ZZZ_POS,
  SLEEP_ZZZ_STAGGER_S,
  SLEEP_FACE_OFFSET_Y,
  MOUTH_CHANGE_DURATION_S,
} from "./layout";
import { POSES } from "./poses";
import {
  eyeSize,
  mouthSize,
  mouthPosition,
  resolveBodySrc,
  resolveEyeSrc,
  resolveMouthSrc,
} from "./emotions";

const GLOW = "#FFD27A";
const SPARKLE = "#F0B654";

function centeredImage(
  href: string,
  cx: number,
  cy: number,
  w: number,
  h: number,
  key?: string
) {
  return (
    <image
      key={key ?? href}
      href={href}
      x={cx - w / 2}
      y={cy - h / 2}
      width={w}
      height={h}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function Sparkle({
  cx,
  cy,
  r,
  className,
}: {
  cx: number;
  cy: number;
  r: number;
  className?: string;
}) {
  const k = r * 0.32;
  const d =
    `M ${cx} ${cy - r} C ${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy} ` +
    `C ${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r} ` +
    `C ${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy} ` +
    `C ${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
  return (
    <path
      d={d}
      fill={SPARKLE}
      className={className}
      style={{ opacity: 0, transformOrigin: `${cx}px ${cy}px` }}
    />
  );
}

function MouthImage({ emotion }: { emotion: BlobEmotion }) {
  const mouth = mouthSize(emotion);
  const pos = mouthPosition(emotion);
  return (
    <image
      key={emotion}
      href={resolveMouthSrc(emotion)}
      x={pos.x}
      y={pos.y}
      width={mouth.w}
      height={mouth.h}
      className="blob-mouth-image blob-mouth-change"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

export default function BlobCharacter({
  pose,
  emotion = "neutral",
  size = 200,
  className,
  hidden = false,
  bloomLevel = 0,
  onHighFive,
  debugLayout = false,
}: BlobCharacterProps) {
  const [paintReady, setPaintReady] = React.useState(false);
  React.useLayoutEffect(() => setPaintReady(true), []);

  const [highFived, setHighFived] = React.useState(false);
  React.useEffect(() => {
    if (pose !== "jump") setHighFived(false);
  }, [pose]);

  const cfg = POSES[pose];
  const mouthEmotion = cfg.mouthEmotion ?? emotion;

  const reactId = React.useId();
  const faceClipId = `blob-face-clip-${reactId.replace(/:/g, "")}`;
  const glowGradId = `blob-glow-grad-${reactId.replace(/:/g, "")}`;

  const clampedBloom = Math.max(0, Math.min(3, Math.round(bloomLevel))) as BloomLevel;
  const bloomScale = 1 + clampedBloom * BLOOM_SCALE_STEP;
  const glowBase = clampedBloom * BLOOM_GLOW_STEP;

  const bodySrc = resolveBodySrc(emotion);
  const leftEyeSrc = resolveEyeSrc(emotion, "left");
  const rightEyeSrc = resolveEyeSrc(emotion, "right");
  const leftEye = eyeSize(emotion, "left");
  const rightEye = eyeSize(emotion, "right");

  const loveBg = EMOTION_ASSETS.love.lovebg;

  const isJump = pose === "jump";
  const isPeek = pose === "peek";
  const isEnter = pose === "enter";

  const handleHighFive = React.useCallback(() => {
    if (!isJump || highFived) return;
    setHighFived(true);
    onHighFive?.();
  }, [highFived, isJump, onHighFive]);

  const seed = React.useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < reactId.length; i++) {
      h ^= reactId.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
  }, [reactId]);

  const poseLayerStyle = {
    width: "100%",
    height: "100%",
    transformOrigin: PEEK_TRANSFORM_ORIGIN,
    "--peek-translate": `-${PEEK_TRANSLATE_PCT}%`,
    "--peek-lift": `-${PEEK_LIFT_PCT}%`,
    "--peek-rotate": `${PEEK_ROTATE_DEG}deg`,
    ...(isPeek
      ? {
          transform:
            "translateX(var(--peek-translate)) translateY(var(--peek-lift)) rotate(var(--peek-rotate))",
        }
      : {}),
  } as React.CSSProperties;

  return (
    <div
      data-blob-pose={pose}
      data-blob-emotion={emotion}
      aria-hidden={isJump ? undefined : "true"}
      role={isJump ? "button" : undefined}
      aria-label={isJump ? "High-five the flower" : undefined}
      onClick={isJump ? handleHighFive : undefined}
      className={clsx(
        "select-none transition-opacity duration-300",
        !paintReady || hidden ? "opacity-0" : "opacity-100",
        isJump ? "cursor-pointer" : "cursor-default",
        className
      )}
      style={
        {
          width: size,
          height: size,
          "--blob-seed": seed,
        } as React.CSSProperties
      }
    >
      <div
        className={clsx(isEnter && "blob-entering", isPeek && "blob-peeking")}
        style={poseLayerStyle}
      >
      <svg viewBox="0 0 60 60" width="100%" height="100%" fill="none" className="overflow-visible">
        <defs>
          <clipPath id={faceClipId}>
            <circle cx={BODY_CX} cy={BODY_CY} r={FACE_RX} />
          </clipPath>
          <radialGradient
            id={glowGradId}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform={`translate(${BODY_CX} ${BODY_CY}) scale(${GLOW_RADIUS})`}
          >
            <stop stopColor={GLOW} stopOpacity="0.9" />
            <stop offset="0.55" stopColor={GLOW} stopOpacity="0.35" />
            <stop offset="1" stopColor={GLOW} stopOpacity="0" />
          </radialGradient>
        </defs>

        <g
          className="blob-glow"
          style={{ ["--blob-glow-base" as string]: glowBase } as React.CSSProperties}
        >
          <circle cx={BODY_CX} cy={BODY_CY} r={GLOW_RADIUS} fill={`url(#${glowGradId})`} />
        </g>

        {emotion === "love" && loveBg ? (
          <g transform={`translate(${LOVE_BG_POS.x} ${LOVE_BG_POS.y})`}>
            {Array.from({ length: LOVE_BG_STREAM_COUNT }, (_, i) => (
              <g
                key={i}
                className="blob-love-bg"
                style={
                  {
                    animationDelay: `${-((LOVE_BG_RISE_DURATION_S / LOVE_BG_STREAM_COUNT) * i)}s`,
                  } as React.CSSProperties
                }
              >
                <image
                  href={loveBg}
                  x={0}
                  y={0}
                  width={ASSET_SIZE.lovebg.w}
                  height={ASSET_SIZE.lovebg.h}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            ))}
          </g>
        ) : null}

        <g className="blob-body" data-body={cfg.body} style={{ transformOrigin: "30px 46px" }}>
          <g transform={`translate(${BODY_TX} ${BODY_TY})`}>
            <g
              className="blob-petals"
              data-body={cfg.body}
              style={{ transformOrigin: "25px 25px" }}
            >
              <g
                className="blob-bloom-scale"
                style={{
                  transformOrigin: "25px 25px",
                  transform: `scale(${bloomScale})`,
                }}
              >
                <image
                  href={bodySrc}
                  x={0}
                  y={0}
                  width={ASSET_SIZE.body.w}
                  height={ASSET_SIZE.body.h}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            </g>
          </g>

          <g className="blob-face-cluster" data-pose={pose}>
            {centeredImage(
              BASE.face,
              BODY_CX,
              BODY_CY,
              ASSET_SIZE.face.w,
              ASSET_SIZE.face.h,
              "face"
            )}

            <g clipPath={`url(#${faceClipId})`}>
              <g
                className="blob-features"
                transform={
                  emotion === "sleep"
                    ? `translate(0 ${SLEEP_FACE_OFFSET_Y})`
                    : undefined
                }
              >
                <g
                  className="blob-eyes"
                  data-eye-blink={emotion === "sleep" ? "none" : cfg.eyeBlink}
                >
                  {centeredImage(
                    leftEyeSrc,
                    LEFT_EYE_CX,
                    EYE_CY,
                    leftEye.w,
                    leftEye.h,
                    "eye-l"
                  )}
                  {centeredImage(
                    rightEyeSrc,
                    RIGHT_EYE_CX,
                    EYE_CY,
                    rightEye.w,
                    rightEye.h,
                    "eye-r"
                  )}
                </g>

                {centeredImage(
                  BASE.leftBlush,
                  LEFT_BLUSH_CX,
                  BLUSH_CY,
                  ASSET_SIZE.leftBlush.w,
                  ASSET_SIZE.leftBlush.h,
                  "blush-l"
                )}
                {centeredImage(
                  BASE.rightBlush,
                  RIGHT_BLUSH_CX,
                  BLUSH_CY,
                  ASSET_SIZE.leftBlush.w,
                  ASSET_SIZE.leftBlush.h,
                  "blush-r"
                )}

                <g className="blob-mouth" data-emotion={mouthEmotion}>
                  <MouthImage emotion={mouthEmotion} />
                </g>
              </g>
            </g>
          </g>

          {emotion === "sleep" ? (
            <g transform={`translate(${SLEEP_ZZZ_POS.x} ${SLEEP_ZZZ_POS.y})`}>
              {Array.from({ length: SLEEP_ZZZ_LETTER_COUNT }, (_, i) => (
                <g
                  key={i}
                  className="blob-sleep-z"
                  style={
                    {
                      animationDelay: `${i * SLEEP_ZZZ_STAGGER_S}s`,
                    } as React.CSSProperties
                  }
                >
                  <g
                    transform={`translate(${-SLEEP_Z_LETTER.anchor.x * SLEEP_ZZZ_LETTER_SCALE} ${-SLEEP_Z_LETTER.anchor.y * SLEEP_ZZZ_LETTER_SCALE}) scale(${SLEEP_ZZZ_LETTER_SCALE})`}
                  >
                    <path d={SLEEP_Z_LETTER.d} fill={SLEEP_Z_LETTER.fill} />
                  </g>
                </g>
              ))}
            </g>
          ) : null}

          {cfg.leaves !== "hidden" ? (
            <>
              <g
                transform={`translate(${LEAF_LEFT_POS.x} ${LEAF_LEFT_POS.y}) scale(${LEAF_SCALE})`}
              >
                <g className="blob-leaf-mount">
                  <g
                    className="blob-leaf blob-leaf-left"
                    data-leaves={cfg.leaves}
                    data-highfive={highFived ? "clap" : undefined}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: `${LEAF_STEM_LEFT.x}px ${LEAF_STEM_LEFT.y}px`,
                    }}
                  >
                    <image
                      href={BASE.leftLeaf}
                      x={0}
                      y={0}
                      width={ASSET_SIZE.leftLeaf.w}
                      height={ASSET_SIZE.leftLeaf.h}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                </g>
              </g>
              <g
                transform={`translate(${LEAF_RIGHT_POS.x} ${LEAF_RIGHT_POS.y}) scale(${LEAF_SCALE})`}
              >
                <g className="blob-leaf-mount">
                  <g
                    className="blob-leaf blob-leaf-right"
                    data-leaves={cfg.leaves}
                    data-highfive={highFived ? "clap" : undefined}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: `${LEAF_STEM_RIGHT.x}px ${LEAF_STEM_RIGHT.y}px`,
                    }}
                  >
                    <image
                      href={BASE.rightLeaf}
                      x={0}
                      y={0}
                      width={ASSET_SIZE.rightLeaf.w}
                      height={ASSET_SIZE.rightLeaf.h}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                </g>
              </g>
            </>
          ) : null}
        </g>

        {cfg.extras === "sparkle-burst" ? (
          <g>
            <Sparkle cx={46} cy={13} r={1.6} className="blob-sparkle-burst blob-sparkle-burst-1" />
            <Sparkle cx={50.5} cy={18} r={1.1} className="blob-sparkle-burst blob-sparkle-burst-2" />
            <Sparkle cx={43} cy={8} r={0.85} className="blob-sparkle-burst blob-sparkle-burst-3" />
          </g>
        ) : null}

        {debugLayout ? (
          <g className="pointer-events-none" opacity={0.45}>
            <circle cx={BODY_CX} cy={BODY_CY} r={0.55} fill="#3B82F6" />
            <circle cx={MOUTH_CX} cy={MOUTH_CY} r={0.55} fill="#22C55E" />
          </g>
        ) : null}
      </svg>

      <style jsx>{`
        :global(.blob-body) {
          transition: transform 0.45s cubic-bezier(0.34, 1.12, 0.64, 1);
        }
        :global(.blob-body[data-body="bob"]) {
          animation: blob-idle-breath 4.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          animation-delay: calc(var(--blob-seed, 0) * -2.3s);
        }
        @keyframes blob-idle-breath {
          0%, 100% { transform: translateY(0) scale(1, 1); }
          50%      { transform: translateY(-0.85px) scale(1.012, 0.992); }
        }
        :global(.blob-body[data-body="lean"]) {
          animation: blob-typing-listen ${TYPING_LEAN_DURATION_S}s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        @keyframes blob-typing-listen {
          0%, 100% {
            transform: rotate(${TYPING_LEAN_ROTATE_DEG}deg) translateY(0) scale(1, 1);
          }
          35% {
            transform: rotate(${TYPING_LEAN_ROTATE_DEG + 0.4}deg)
                       translateY(${TYPING_LEAN_FLOAT_PX}px)
                       scale(1.012, 0.988);
          }
          70% {
            transform: rotate(${TYPING_LEAN_ROTATE_DEG - 0.5}deg)
                       translateY(${TYPING_LEAN_FLOAT_PX * -0.25}px)
                       scale(0.996, 1.004);
          }
        }
        :global(.blob-body[data-body="bounce"]) {
          animation: blob-save-hop 1.1s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        @keyframes blob-save-hop {
          0%   { transform: translateY(0) scale(1, 1); }
          32%  { transform: translateY(-5.5px) scale(0.96, 1.06); }
          100% { transform: translateY(0) scale(1, 1); }
        }
        :global(.blob-body[data-body="wave"]) {
          animation: blob-greeting-wave ${GREETING_DURATION_S}s cubic-bezier(0.34, 1.28, 0.64, 1) forwards;
        }
        @keyframes blob-greeting-wave {
          0%   { transform: rotate(0deg) translateY(0); }
          32%  { transform: rotate(2deg) translateY(-2.8px); }
          100% { transform: rotate(0deg) translateY(0); }
        }

        :global(.blob-petals) { transition: transform 0.5s ease; }
        :global(.blob-petals[data-body="bob"]) {
          animation: blob-petals-drift 7.4s ease-in-out infinite;
        }
        @keyframes blob-petals-drift {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(0.6deg); }
        }

        :global(.blob-leaf) {
          transition: transform 0.45s cubic-bezier(0.34, 1.18, 0.64, 1);
        }
        :global(.blob-leaf-left[data-leaves="still"]) {
          animation: blob-leaf-still-l 5.3s ease-in-out infinite;
        }
        :global(.blob-leaf-right[data-leaves="still"]) {
          animation: blob-leaf-still-r 5.9s ease-in-out infinite;
        }
        @keyframes blob-leaf-still-l {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(-0.9deg); }
        }
        @keyframes blob-leaf-still-r {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(0.9deg); }
        }
        :global(.blob-leaf-left[data-leaves="sway"]) {
          animation: blob-leaf-sway-l ${TYPING_LEAF_SWAY_DURATION_S}s ease-in-out infinite;
        }
        :global(.blob-leaf-right[data-leaves="sway"]) {
          animation: blob-leaf-sway-r ${TYPING_LEAF_SWAY_DURATION_S + 0.25}s ease-in-out infinite;
        }
        @keyframes blob-leaf-sway-l {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(-${TYPING_LEAF_SWAY_DEG}deg); }
        }
        @keyframes blob-leaf-sway-r {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(${TYPING_LEAF_SWAY_DEG}deg); }
        }
        :global(.blob-leaf-left[data-leaves="perk"]) {
          animation: blob-leaf-perk-l 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        :global(.blob-leaf-right[data-leaves="perk"]) {
          animation: blob-leaf-perk-r 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes blob-leaf-perk-l {
          0%   { transform: rotate(0); }
          100% { transform: rotate(-14deg); }
        }
        @keyframes blob-leaf-perk-r {
          0%   { transform: rotate(0); }
          100% { transform: rotate(14deg); }
        }
        :global(.blob-leaf-left[data-leaves="highfive"]) {
          transform: rotate(-18deg);
        }
        :global(.blob-leaf-right[data-leaves="highfive"]) {
          transform: rotate(18deg);
        }

        :global(.blob-eyes[data-eye-blink="idle"] image) {
          transform-box: fill-box;
          transform-origin: center;
          animation: blob-idle-blink 5.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          animation-delay: calc(var(--blob-seed, 0) * -3.3s);
        }
        :global(.blob-eyes[data-eye-blink="typing"] image) {
          transform-box: fill-box;
          transform-origin: center;
          animation: blob-typing-blink 2.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        @keyframes blob-idle-blink {
          0%, 53%, 56%, 86%, 90%, 100% { transform: scaleY(1); }
          54.5%                         { transform: scaleY(0.08); }
          88%                           { transform: scaleY(0.08); }
        }
        @keyframes blob-typing-blink {
          0%, 38%, 47%, 70%, 73%, 78%, 100% { transform: scaleY(1); }
          42%                                { transform: scaleY(0.1); }
          75%                                { transform: scaleY(0.1); }
        }

        :global(.blob-mouth-image) {
          transform-box: fill-box;
          transform-origin: center center;
          pointer-events: none;
        }
        :global(.blob-mouth-change) {
          animation: blob-mouth-change ${MOUTH_CHANGE_DURATION_S}s cubic-bezier(0.22, 0.9, 0.3, 1) both;
        }
        @keyframes blob-mouth-change {
          0% {
            transform: scale(0.96, 0.92);
            opacity: 0.35;
          }
          40% {
            transform: scale(0.99, 0.97);
            opacity: 0.72;
          }
          100% {
            transform: scale(1, 1);
            opacity: 1;
          }
        }

        /* ── ENTRANCE — slide left→right and straighten into place ───── */
        :global(.blob-entering) {
          transform-origin: ${PEEK_TRANSFORM_ORIGIN};
          animation: blob-entrance ${ENTRANCE_DURATION_S}s cubic-bezier(0.22, 0.9, 0.3, 1) forwards;
        }
        @keyframes blob-entrance {
          0% {
            transform: translateX(var(--peek-translate)) translateY(var(--peek-lift))
              rotate(var(--peek-rotate));
          }
          55% {
            transform: translateX(4%) translateY(-2%) rotate(2.5deg);
          }
          78% {
            transform: translateX(-1.5%) translateY(0) rotate(-1deg);
          }
          100% {
            transform: translateX(0) translateY(0) rotate(0deg);
          }
        }

        :global(.blob-leaf-mount) {
          transform-box: fill-box;
          transform-origin: top center;
        }

        :global(.blob-sparkle-burst) {
          opacity: 0;
          animation: blob-sparkle-pop 1.15s ease forwards;
        }
        :global(.blob-sparkle-burst-1) { animation-delay: 0.05s; }
        :global(.blob-sparkle-burst-2) { animation-delay: 0.22s; }
        :global(.blob-sparkle-burst-3) { animation-delay: 0.38s; }
        @keyframes blob-sparkle-pop {
          0%   { opacity: 0; transform: scale(0.2); }
          40%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(0.5); }
        }

        :global(.blob-love-bg) {
          transform-box: fill-box;
          transform-origin: center center;
          animation: blob-love-hearts-rise ${LOVE_BG_RISE_DURATION_S}s linear infinite both;
        }
        @keyframes blob-love-hearts-rise {
          0% {
            opacity: 0.25;
            transform: translateY(10px);
          }
          80% {
            opacity: 0.9;
            transform: translateY(-6px);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px);
          }
        }

        :global(.blob-sleep-z) {
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: blob-z-rise ${SLEEP_ZZZ_CYCLE_S}s linear infinite both;
        }
        @keyframes blob-z-rise {
          0% {
            opacity: 0;
            transform: translate(0, 5px) scale(1);
          }
          10% {
            opacity: 0.95;
            transform: translate(0, 3px) scale(1);
          }
          55% {
            opacity: 0.85;
            transform: translate(2px, -4px) scale(0.78);
          }
          85% {
            opacity: 0.3;
            transform: translate(4px, -9px) scale(0.55);
          }
          100% {
            opacity: 0;
            transform: translate(5px, -12px) scale(0.42);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          :global(.blob-body),
          :global(.blob-petals),
          :global(.blob-leaf),
          :global(.blob-entering),
          :global(.blob-leaf-mount),
          :global(.blob-love-bg),
          :global(.blob-sleep-z),
          :global(.blob-sparkle-burst),
          :global(.blob-mouth-change) {
            animation: none !important;
          }
        }
      `}</style>
      </div>
    </div>
  );
}
