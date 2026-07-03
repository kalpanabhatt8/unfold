"use client";

import React from "react";
import clsx from "clsx";
import type { BlobCharacterProps, BlobEmotion, BloomLevel } from "./types";
import { ASSET_SIZE, BASE, EMOTION_ASSETS } from "./assets";
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
  SLEEP_ZZZ_LETTER_SCALE,
  SLEEP_ZZZ_POS,
  SLEEP_FACE_OFFSET_Y,
  SLEEP_BLUSH_CY,
  SLEEP_LEFT_BLUSH_CX,
  SLEEP_RIGHT_BLUSH_CX,
  SLEEP_BREATH_DURATION_S,
  SLEEP_BREATH_SCALE_MIN,
  SLEEP_BREATH_SCALE_MAX,
  SLEEP_BREATH_LIFT_PX,
  WAKE_BODY_DURATION_S,
  WAKE_BODY_SCALE_PEAK,
  WAKE_BODY_LIFT_PX,
  WAKE_LEAF_DURATION_S,
  WAKE_LEAF_LIFT_PX,
  WAKE_LEAF_ROTATE_LIFT,
  MOUTH_CHANGE_DURATION_S,
  MOUTH_CHANGE_EXPAND_DURATION_S,
  MOUTH_CHANGE_CONTRACT_DURATION_S,
  MOUTH_WAKE_SETTLE_DURATION_S,
  MOUTH_SHOCKED_OPEN_SCALE_Y,
  BLOB_SIZE_DESKTOP_PX,
  BLOB_SIZE_MOBILE_PX,
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

/** Smiles share the same anchor — scale between sizes instead of crossfading. */
const SMILE_EMOTIONS = new Set<BlobEmotion>([
  "neutral",
  "happy",
  "love",
  "excited",
  "smart",
]);

function mouthArea(size: { w: number; h: number }) {
  return size.w * size.h;
}

function MouthImage({ emotion }: { emotion: BlobEmotion }) {
  const imgRef = React.useRef<SVGImageElement>(null);
  const animRef = React.useRef<Animation | null>(null);
  const prevEmotionRef = React.useRef(emotion);
  const mouth = mouthSize(emotion);
  const pos = mouthPosition(emotion);

  React.useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const prev = prevEmotionRef.current;
    if (prev === emotion) return;

    const prevSize = mouthSize(prev);
    const nextSize = mouthSize(emotion);
    const sx = prevSize.w / nextSize.w;
    const sy = prevSize.h / nextSize.h;
    const smileTransition =
      SMILE_EMOTIONS.has(prev) && SMILE_EMOTIONS.has(emotion);

    prevEmotionRef.current = emotion;
    animRef.current?.cancel();

    const shockedSettle =
      prev === "shocked" &&
      (emotion === "neutral" || SMILE_EMOTIONS.has(emotion));

    if (shockedSettle) {
      img.style.opacity = "1";
      img.style.transition = "none";
      const startSy = Math.max(sy, MOUTH_SHOCKED_OPEN_SCALE_Y);
      animRef.current = img.animate(
        [
          { transform: `scale(${sx}, ${startSy})` },
          { transform: "scale(1, 1)" },
        ],
        {
          duration: MOUTH_WAKE_SETTLE_DURATION_S * 1000,
          easing: "cubic-bezier(0.25, 0.85, 0.35, 1)",
          fill: "forwards",
        }
      );
      animRef.current.onfinish = () => {
        img.style.transform = "scale(1, 1)";
      };
      return;
    }

    if (smileTransition) {
      img.style.opacity = "1";
      img.style.transition = "none";
      const expanding = mouthArea(nextSize) > mouthArea(prevSize);
      const frames: Keyframe[] = expanding
        ? [
            { transform: `scale(${sx}, ${sy})` },
            { transform: "scale(1.028, 1.055)", offset: 0.74 },
            { transform: "scale(1, 1)" },
          ]
        : [
            { transform: `scale(${sx}, ${sy})` },
            { transform: "scale(1, 1)" },
          ];

      animRef.current = img.animate(frames, {
        duration:
          (expanding
            ? MOUTH_CHANGE_EXPAND_DURATION_S
            : MOUTH_CHANGE_CONTRACT_DURATION_S) * 1000,
        easing: expanding
          ? "cubic-bezier(0.34, 1.32, 0.64, 1)"
          : "cubic-bezier(0.25, 0.85, 0.35, 1)",
        fill: "forwards",
      });
      animRef.current.onfinish = () => {
        img.style.transform = "scale(1, 1)";
      };
      return;
    }

    const ease = `transform ${MOUTH_CHANGE_DURATION_S}s cubic-bezier(0.22, 0.9, 0.3, 1)`;
    img.style.transition = "none";
    img.style.opacity = "0.35";
    img.style.transform = "scale(0.96, 0.92)";
    void img.getBoundingClientRect();
    img.style.transition = `${ease}, opacity ${MOUTH_CHANGE_DURATION_S * 0.55}s ease`;
    img.style.opacity = "1";
    img.style.transform = "scale(1, 1)";
  }, [emotion]);

  React.useEffect(() => () => animRef.current?.cancel(), []);

  return (
    <image
      ref={imgRef}
      href={resolveMouthSrc(emotion)}
      x={pos.x}
      y={pos.y}
      width={mouth.w}
      height={mouth.h}
      className="blob-mouth-image"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function useResponsiveBlobSize() {
  const [px, setPx] = React.useState(BLOB_SIZE_DESKTOP_PX);

  React.useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => {
      setPx(mq.matches ? BLOB_SIZE_DESKTOP_PX : BLOB_SIZE_MOBILE_PX);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return px;
}

export default function BlobCharacter({
  pose,
  emotion = "neutral",
  size: sizeProp,
  className,
  hidden = false,
  bloomLevel = 0,
  onHighFive,
  onWake,
  debugLayout = false,
}: BlobCharacterProps) {
  const responsiveSize = useResponsiveBlobSize();
  const size = sizeProp ?? responsiveSize;

  const [paintReady, setPaintReady] = React.useState(false);
  React.useLayoutEffect(() => setPaintReady(true), []);

  const [highFived, setHighFived] = React.useState(false);
  React.useEffect(() => {
    if (pose !== "jump") setHighFived(false);
  }, [pose]);

  const cfg = POSES[pose];
  const isSleeping = emotion === "sleep" && pose === "idle";
  const bodyKind = isSleeping ? "shrink" : cfg.body;
  const leavesKind = isSleeping ? "droop" : cfg.leaves;
  const mouthEmotion = cfg.mouthEmotion ?? emotion;
  const eyeBlink = (() => {
    if (emotion === "sleep") return "none";
    if (emotion === "shocked" && (pose === "wake" || pose === "typing")) {
      return "wake";
    }
    if (pose === "wake") return "wake-settle";
    return cfg.eyeBlink;
  })();

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

  const handleWake = React.useCallback(() => {
    if (!isSleeping) return;
    onWake?.();
  }, [isSleeping, onWake]);

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
    "--peek-translate": `${PEEK_TRANSLATE_PCT}%`,
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
      aria-hidden={isJump || isSleeping ? undefined : "true"}
      role={isJump ? "button" : isSleeping ? "button" : undefined}
      aria-label={
        isJump
          ? "High-five the flower"
          : isSleeping
            ? "Wake the flower"
            : undefined
      }
      onClick={isJump ? handleHighFive : isSleeping ? handleWake : undefined}
      onPointerEnter={isSleeping ? handleWake : undefined}
      className={clsx(
        "shrink-0 select-none transition-opacity duration-300",
        !paintReady || hidden ? "opacity-0" : "opacity-100",
        isJump || isSleeping ? "cursor-pointer" : "cursor-default",
        className
      )}
      style={
        {
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          maxWidth: size,
          maxHeight: size,
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

        <g className="blob-body" data-body={bodyKind} style={{ transformOrigin: "30px 46px" }}>
          <g transform={`translate(${BODY_TX} ${BODY_TY})`}>
            <g
              className="blob-petals"
              data-body={bodyKind}
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
                  data-eye-blink={eyeBlink}
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
                  emotion === "sleep" ? SLEEP_LEFT_BLUSH_CX : LEFT_BLUSH_CX,
                  emotion === "sleep" ? SLEEP_BLUSH_CY : BLUSH_CY,
                  ASSET_SIZE.leftBlush.w,
                  ASSET_SIZE.leftBlush.h,
                  "blush-l"
                )}
                {centeredImage(
                  BASE.rightBlush,
                  emotion === "sleep" ? SLEEP_RIGHT_BLUSH_CX : RIGHT_BLUSH_CX,
                  emotion === "sleep" ? SLEEP_BLUSH_CY : BLUSH_CY,
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

          {emotion === "sleep" && EMOTION_ASSETS.sleep.sleepZzz ? (
            <g transform={`translate(${SLEEP_ZZZ_POS.x} ${SLEEP_ZZZ_POS.y})`}>
              <g className="blob-sleep-zzz">
                <animate
                  attributeName="opacity"
                  values="0;0;0.95;0.85;0;0"
                  keyTimes="0;0.08;0.22;0.58;0.78;1"
                  dur={`${SLEEP_ZZZ_CYCLE_S}s`}
                  repeatCount="indefinite"
                />
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0.6; 0 0.6; 0 0; 0.8 -2; 1.2 -3.5; 1.2 -3.5"
                  keyTimes="0;0.02;0.22;0.58;0.78;1"
                  dur={`${SLEEP_ZZZ_CYCLE_S}s`}
                  repeatCount="indefinite"
                />
                <image
                  href={EMOTION_ASSETS.sleep.sleepZzz}
                  x={0}
                  y={0}
                  width={ASSET_SIZE.sleepZzz.w * SLEEP_ZZZ_LETTER_SCALE}
                  height={ASSET_SIZE.sleepZzz.h * SLEEP_ZZZ_LETTER_SCALE}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            </g>
          ) : null}

          {/* {leavesKind !== "hidden" ? (
            <>
              <g
                transform={`translate(${LEAF_LEFT_POS.x} ${LEAF_LEFT_POS.y}) scale(${LEAF_SCALE})`}
              >
                <g className="blob-leaf-mount">
                  <g
                    className="blob-leaf blob-leaf-left"
                    data-leaves={leavesKind}
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
                    data-leaves={leavesKind}
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
          ) : null} */}
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
        :global(.blob-body[data-body="shrink"]) {
          animation: blob-sleep-breath ${SLEEP_BREATH_DURATION_S}s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes blob-sleep-breath {
          0%, 100% {
            transform: scale(${SLEEP_BREATH_SCALE_MIN}, ${SLEEP_BREATH_SCALE_MIN - 0.005}) translateY(0.55px);
          }
          45% {
            transform: scale(${SLEEP_BREATH_SCALE_MAX}, ${SLEEP_BREATH_SCALE_MAX - 0.012})
                       translateY(${SLEEP_BREATH_LIFT_PX}px);
          }
          58% {
            transform: scale(${(SLEEP_BREATH_SCALE_MAX + SLEEP_BREATH_SCALE_MIN) / 2 + 0.003},
                             ${(SLEEP_BREATH_SCALE_MAX + SLEEP_BREATH_SCALE_MIN) / 2 - 0.005})
                       translateY(${SLEEP_BREATH_LIFT_PX * 0.55}px);
          }
        }
        :global(.blob-body[data-body="wake"]) {
          animation: blob-wake-body ${WAKE_BODY_DURATION_S}s cubic-bezier(0.34, 1.36, 0.64, 1) forwards;
        }
        @keyframes blob-wake-body {
          0%   { transform: scale(0.965, 0.97) translateY(0.6px); }
          18%  { transform: scale(0.95, 1.06) translateY(-0.4px); }
          42%  {
            transform: scale(${WAKE_BODY_SCALE_PEAK + 0.01}, ${WAKE_BODY_SCALE_PEAK - 0.05})
                       translateY(${WAKE_BODY_LIFT_PX}px);
          }
          62%  { transform: scale(0.99, 1.015) translateY(-0.2px); }
          100% { transform: scale(1, 1) translateY(0); }
        }

        :global(.blob-petals) { transition: transform 0.5s ease; }
        :global(.blob-petals[data-body="shrink"]) {
          animation: blob-petals-sleep ${SLEEP_BREATH_DURATION_S}s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes blob-petals-sleep {
          0%, 100% { transform: rotate(-0.5deg); }
          50%      { transform: rotate(0.5deg); }
        }
        :global(.blob-petals[data-body="wake"]) {
          animation: blob-petals-wake ${WAKE_BODY_DURATION_S}s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes blob-petals-wake {
          0%   { transform: rotate(-0.4deg); }
          25%  { transform: rotate(-2.6deg); }
          55%  { transform: rotate(2deg); }
          100% { transform: rotate(0); }
        }
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
        :global(.blob-leaf-left[data-leaves="droop"]) {
          animation: blob-leaf-droop-l ${SLEEP_BREATH_DURATION_S}s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        :global(.blob-leaf-right[data-leaves="droop"]) {
          animation: blob-leaf-droop-r ${SLEEP_BREATH_DURATION_S}s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes blob-leaf-droop-l {
          0%, 100% { transform: rotate(-6deg) translateY(0.7px); }
          50%      { transform: rotate(-4.5deg) translateY(0.3px); }
        }
        @keyframes blob-leaf-droop-r {
          0%, 100% { transform: rotate(6deg) translateY(0.7px); }
          50%      { transform: rotate(4.5deg) translateY(0.3px); }
        }
        :global(.blob-leaf-left[data-leaves="wake"]) {
          animation: blob-leaf-wake-l ${WAKE_LEAF_DURATION_S}s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        :global(.blob-leaf-right[data-leaves="wake"]) {
          animation: blob-leaf-wake-r ${WAKE_LEAF_DURATION_S}s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        @keyframes blob-leaf-wake-l {
          0%   { transform: rotate(-6deg) translateY(0.6px); }
          32%  { transform: rotate(${-6 + WAKE_LEAF_ROTATE_LIFT + 2}deg) translateY(${WAKE_LEAF_LIFT_PX}px); }
          100% { transform: rotate(0deg) translateY(0); }
        }
        @keyframes blob-leaf-wake-r {
          0%   { transform: rotate(6deg) translateY(0.6px); }
          32%  { transform: rotate(${6 - WAKE_LEAF_ROTATE_LIFT - 2}deg) translateY(${WAKE_LEAF_LIFT_PX}px); }
          100% { transform: rotate(0deg) translateY(0); }
        }

        :global(.blob-face-cluster[data-pose="wake"]) {
          animation: blob-face-cluster-wake ${WAKE_BODY_DURATION_S}s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        @keyframes blob-face-cluster-wake {
          0%   { transform: translateY(0.4px); }
          40%  { transform: translateY(-0.6px); }
          100% { transform: translateY(0); }
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
        :global(.blob-eyes[data-eye-blink="wake"] image) {
          transform-box: fill-box;
          transform-origin: center;
          animation: blob-eye-wake-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes blob-eye-wake-pop {
          0%   { transform: scaleY(0.05); }
          35%  { transform: scaleY(1.22); }
          65%  { transform: scaleY(0.92); }
          100% { transform: scaleY(1); }
        }
        :global(.blob-eyes[data-eye-blink="wake-settle"] image) {
          transform-box: fill-box;
          transform-origin: center;
          animation: blob-wake-settle-blink 1.35s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        @keyframes blob-wake-settle-blink {
          0%, 18%, 21%, 42%, 45%, 68%, 71%, 100% { transform: scaleY(1); }
          19.5%                                  { transform: scaleY(0.1); }
          43.5%                                  { transform: scaleY(0.1); }
          69.5%                                  { transform: scaleY(0.1); }
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
          /* Pivot on the lip line — width grows sideways, height opens downward. */
          transform-origin: 50% 30%;
          pointer-events: none;
        }

        /* ── ENTRANCE — slide right→left and straighten into place ───── */
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
            transform: translateX(-4%) translateY(-2%) rotate(-2.5deg);
          }
          78% {
            transform: translateX(1.5%) translateY(0) rotate(1deg);
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

        @media (prefers-reduced-motion: reduce) {
          :global(.blob-body),
          :global(.blob-petals),
          :global(.blob-leaf),
          :global(.blob-entering),
          :global(.blob-leaf-mount),
          :global(.blob-love-bg),
          :global(.blob-sparkle-burst),
          :global(.blob-mouth-image) {
            transition: none !important;
          }
        }
      `}</style>
      </div>
    </div>
  );
}
