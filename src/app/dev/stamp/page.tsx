"use client";

/**
 * Stamp layout playground — open at /dev/stamp
 */

import React, { useState } from "react";
import { StampFace } from "@/components/canvas/journal-stamp";

const EXAMPLES = [
  { label: "Short", name: "Kalpana" },
  { label: "Fits one line", name: "Kalpana Bhatt" },
  { label: "Email style", name: "Kalpana Bhatt" },
  { label: "Long → split", name: "Christopher Montgomery" },
  { label: "Very long → first only", name: "Alexandrina Worthington" },
] as const;

export default function StampDevPage() {
  const [customName, setCustomName] = useState("Kalpana Bhatt");
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(128);

  return (
    <main
      className="min-h-[100svh] w-full"
      style={{
        background:
          "linear-gradient(#e8e8e8 1px, transparent 1px), linear-gradient(90deg, #e8e8e8 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        backgroundColor: "#faf8f5",
      }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-12">
        <header>
          <h1 className="text-xl font-semibold text-[#3a2820]">Stamp preview</h1>
          <p className="mt-1 text-sm text-black/50">
            Text-only imprint — wraps at word boundaries with equal inset padding.
          </p>
        </header>

        <section className="rounded-2xl border border-black/[0.08] bg-white/70 p-6">
          <label className="block text-sm font-medium text-black/60">
            Your name
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/25"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-black/60">
            Width ({width}px)
            <input
              type="range"
              min={120}
              max={280}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-black/60">
            Height ({height}px)
            <input
              type="range"
              min={48}
              max={160}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <div className="mt-8 flex justify-center">
            <StampFace
              userName={customName}
              width={width}
              height={height}
              inkAlpha={0.88}
            />
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          {EXAMPLES.map((ex) => (
            <div
              key={ex.label}
              className="flex flex-col items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/50 p-5"
            >
              <p className="text-xs uppercase tracking-widest text-black/40">
                {ex.label}
              </p>
              <StampFace userName={ex.name} width={200} height={128} inkAlpha={0.88} />
              <p className="text-center text-sm text-black/55">&quot;{ex.name}&quot;</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-dashed border-black/15 bg-white/40 p-5 text-sm text-black/55">
          <p className="font-medium text-black/70">Layout rules</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>One line by default — wraps only if it truly overflows</li>
            <li>Whole words move to the next line; never split mid-word</li>
            <li>Text box uses full width minus {12}px padding on each side</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
