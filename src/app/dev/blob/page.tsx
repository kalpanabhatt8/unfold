"use client";

/**
 * Dev playground for BlobCharacter.
 *
 * Open at: /dev/blob
 *
 * Not linked from the app — purely a visual sandbox to iterate on the
 * character before wiring it into the canvas redesign.
 */

import React from "react";
import BlobCharacter, {
  type BlobState,
  type CompanionEmotion,
  LONG_SLEEP_AFTER_MS,
  useBlobState,
} from "@/components/canvas/blob-character";

const ALL_STATES: BlobState[] = [
  "idle",
  "typing",
  "sleeping",
  "waking",
  "saving",
  "greeting",
  "happy",
  "heavy",
  "neutral",
  "anxious",
  "angry",
  "confused",
  "tired",
  "calm",
];

const EMOTION_BUTTONS: CompanionEmotion[] = [
  "happy",
  "heavy",
  "neutral",
  "anxious",
  "angry",
  "confused",
  "tired",
  "calm",
];

const PASTELS = [
  { id: "canvas",   label: "Canvas",  value: "#F8F5F2" },
  { id: "blush",    label: "Blush",   value: "#F2E8E4" },
  { id: "ivory",    label: "Ivory",   value: "#FBF8F1" },
  { id: "sage",     label: "Sage",    value: "#E8EFE8" },
  { id: "mist",     label: "Mist",    value: "#E8EEF3" },
  { id: "lavender", label: "Lavender", value: "#EEEBF3" },
];

export default function BlobDevPage() {
  const live = useBlobState({ sleepAfterMs: LONG_SLEEP_AFTER_MS });
  const [bg, setBg] = React.useState(PASTELS[0].value); // Canvas — matches writing page
  const [size, setSize] = React.useState(72);
  const [debugLayout, setDebugLayout] = React.useState(false);

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
            One cohesive SVG · 14 expression states · pure CSS animation.
          </p>
        </header>

        {/* ── State grid ───────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-[0.18em] text-black/45">
            All states
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
            {ALL_STATES.map((s) => (
              <figure
                key={s}
                className="flex flex-col items-center gap-2 rounded-2xl border border-black/[0.05] bg-white/55 p-5 backdrop-blur-sm"
              >
                <div className="flex h-24 w-24 items-center justify-center">
                  <BlobCharacter state={s} size={size} debugLayout={debugLayout} />
                </div>
                <figcaption className="text-xs text-black/60">{s}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── Live state machine ──────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-[0.18em] text-black/45">
            Live (typing-driven · hover the sleeping character to wake)
          </h2>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-black/[0.05] bg-white/55 p-6 backdrop-blur-sm">
            <div className="flex h-24 w-24 items-center justify-center">
              <BlobCharacter
                state={live.state}
                size={size}
                hidden={live.hidden}
                onWakeUp={live.onWakeUp}
                debugLayout={debugLayout}
              />
            </div>
            <textarea
              onKeyDown={live.onActivity}
              placeholder="Type here — bobs while typing, reacts at 15s pause, sleeps after 3 min…"
              rows={4}
              className="w-full max-w-xl resize-none rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-md leading-relaxed outline-none placeholder:text-black/35"
              style={{ fontFamily: "Lora, Georgia, serif" }}
            />
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-black/65">
              <span>
                state: <code className="font-mono">{live.state}</code>
              </span>
              {EMOTION_BUTTONS.map((emotion) => (
                <button
                  key={emotion}
                  onClick={() => live.onEmotionReaction(emotion)}
                  className="rounded-full border border-black/10 bg-white/80 px-3 py-1 hover:bg-white"
                >
                  {emotion}
                </button>
              ))}
              <button
                onClick={() => live.runGreeting()}
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 hover:bg-white"
              >
                wave
              </button>
              <button
                onClick={() => live.onSave()}
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 hover:bg-white"
              >
                trigger save
              </button>
              <button
                onClick={() => live.setState("sleeping")}
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 hover:bg-white"
              >
                force sleep
              </button>
              <button
                onClick={() => live.onClosing()}
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 hover:bg-white"
              >
                trigger goodbye
              </button>
            </div>
          </div>
        </section>

        {/* ── Controls ────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-[0.18em] text-black/45">
            Controls
          </h2>

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
            <span className="ml-2 text-xs text-black/55">background</span>
          </div>

          <label className="flex items-center gap-3 text-xs text-black/65">
            <span className="w-20">size</span>
            <input
              type="range"
              min={40}
              max={120}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="flex-1 max-w-xs"
            />
            <span className="font-mono">{size}px</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-black/65">
            <input
              type="checkbox"
              checked={debugLayout}
              onChange={(e) => setDebugLayout(e.target.checked)}
            />
            Show Y-alignment guides (face center vs eyes+mouth block)
          </label>
          {debugLayout ? (
            <p className="text-xs text-black/50">
              Blue = cream face vertical center. Green = eyes+mouth bbox center
              (should sit on blue). Dashed red = face bounds.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
