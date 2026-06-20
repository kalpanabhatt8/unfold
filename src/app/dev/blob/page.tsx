"use client";

/**
 * Dev playground for BlobCharacter.
 * Open at: /dev/blob
 */

import React from "react";
import BlobCharacter, {
  BLOB_EMOTIONS,
  BLOB_POSES,
  type BlobEmotion,
  type BlobPose,
  useBlobState,
} from "@/components/canvas/blob-character";
import { EntranceGreeting } from "@/components/canvas/blob/entrance-greeting";

const PASTELS = [
  { id: "canvas", label: "Canvas", value: "#F8F5F2" },
  { id: "blush", label: "Blush", value: "#F2E8E4" },
  { id: "ivory", label: "Ivory", value: "#FBF8F1" },
  { id: "sage", label: "Sage", value: "#E8EFE8" },
  { id: "mist", label: "Mist", value: "#E8EEF3" },
  { id: "lavender", label: "Lavender", value: "#EEEBF3" },
];

export default function BlobDevPage() {
  const live = useBlobState();
  const [bg, setBg] = React.useState(PASTELS[0].value);
  const [size, setSize] = React.useState(72);
  const [debugLayout, setDebugLayout] = React.useState(false);
  const [previewPose, setPreviewPose] = React.useState<BlobPose>("idle");
  const [previewEmotion, setPreviewEmotion] = React.useState<BlobEmotion>("neutral");

  return (
    <main
      style={{ background: bg }}
      className="min-h-[100svh] w-full transition-colors duration-300"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-12 px-6 py-12">
        <header className="flex flex-col gap-1">
          <h1
            className="header-xl font-medium tracking-tight text-[#2C2C2A]"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            Blob character
          </h1>
          <p className="text-sm text-black/55">
            Asset-driven SVG · pose + emotion layers · folders in /public/Images/character/
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-[0.18em] text-black/45">
            Pose × emotion grid
          </h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {BLOB_POSES.map((p) => (
              <button
                key={p}
                onClick={() => setPreviewPose(p)}
                className={`rounded-full border px-3 py-1 ${
                  previewPose === p
                    ? "border-black/30 bg-white"
                    : "border-black/10 bg-white/70"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {BLOB_EMOTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setPreviewEmotion(e)}
                className={`rounded-full border px-3 py-1 ${
                  previewEmotion === e
                    ? "border-black/30 bg-white"
                    : "border-black/10 bg-white/70"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex h-28 items-center justify-center rounded-2xl border border-black/[0.05] bg-white/55">
            <BlobCharacter
              pose={previewPose}
              emotion={previewEmotion}
              size={size}
              debugLayout={debugLayout}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-[0.18em] text-black/45">
            All emotions (idle pose)
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {BLOB_EMOTIONS.map((e) => (
              <figure
                key={e}
                className="flex flex-col items-center gap-2 rounded-2xl border border-black/[0.05] bg-white/55 p-5"
              >
                <BlobCharacter pose="idle" emotion={e} size={size} debugLayout={debugLayout} />
                <figcaption className="text-xs text-black/60">{e}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-[0.18em] text-black/45">
            Live state machine
          </h2>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-black/[0.05] bg-white/55 p-6">
            <div className="relative flex items-center justify-center">
              <BlobCharacter
                pose={live.pose}
                emotion={live.emotion}
                size={size}
                hidden={live.hidden}
                debugLayout={debugLayout}
              />
              {live.greeting ? (
                <EntranceGreeting
                  as="span"
                  visible={live.greetingVisible}
                  peeking={live.pose === "peek"}
                >
                  {live.greeting}
                </EntranceGreeting>
              ) : null}
            </div>
            <textarea
              onKeyDown={() => live.onCompanionPhase("writing")}
              placeholder="Type here — typing pose while active, listening at 3s pause…"
              rows={4}
              className="w-full max-w-xl resize-none rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-md leading-relaxed outline-none placeholder:text-black/35"
              style={{ fontFamily: "Lora, Georgia, serif" }}
            />
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-black/65">
              <span>
                pose: <code className="font-mono">{live.pose}</code>
              </span>
              <span>
                emotion: <code className="font-mono">{live.emotion}</code>
              </span>
              {BLOB_EMOTIONS.map((emotion) => (
                <button
                  key={emotion}
                  onClick={() => live.onEmotionReaction(emotion)}
                  className="rounded-full border border-black/10 bg-white/80 px-3 py-1 hover:bg-white"
                >
                  {emotion}
                </button>
              ))}
              <button
                onClick={() => live.runEnter()}
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 hover:bg-white"
              >
                replay entrance
              </button>
              <button
                onClick={() => live.setPose("peek")}
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 hover:bg-white"
              >
                peek
              </button>
              <button
                onClick={() => live.onClosing()}
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 hover:bg-white"
              >
                goodbye
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-[0.18em] text-black/45">Controls</h2>
          <div className="flex flex-wrap items-center gap-2">
            {PASTELS.map((p) => (
              <button
                key={p.id}
                onClick={() => setBg(p.value)}
                aria-label={p.label}
                className={`h-7 w-7 rounded-full border transition ${
                  bg === p.value
                    ? "border-black/45 ring-2 ring-black/10"
                    : "border-black/15 hover:border-black/35"
                }`}
                style={{ background: p.value }}
              />
            ))}
          </div>
          <label className="flex items-center gap-3 text-xs text-black/65">
            <span className="w-20">size</span>
            <input
              type="range"
              min={40}
              max={120}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="max-w-xs flex-1"
            />
            <span className="font-mono">{size}px</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-black/65">
            <input
              type="checkbox"
              checked={debugLayout}
              onChange={(e) => setDebugLayout(e.target.checked)}
            />
            Show alignment guides
          </label>
        </section>
      </div>
    </main>
  );
}
