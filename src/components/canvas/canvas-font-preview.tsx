"use client";

/**
 * Temporary canvas font comparison — remove when a body font is chosen.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Didact_Gothic, Figtree, Host_Grotesk, Rethink_Sans } from "next/font/google";

const figtree = Figtree({ subsets: ["latin"], weight: ["400"], display: "swap" });
const didactGothic = Didact_Gothic({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const hostGrotesk = Host_Grotesk({
  subsets: ["latin"],
  weight: ["300"],
  display: "swap",
});
const rethink = Rethink_Sans({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const STARTERS = [
  "The morning light settled across the page like a quiet invitation to write.",
  "I linger over each word, letting the sentences find their own pace — unhurried and plain.",
  "Close enough to hear my own breath between them, without hurry or ornament.",
] as const;

const PREVIEW_FONTS = [
  { label: "Figtree", family: figtree.style.fontFamily, fontWeight: 400 },
  // { label: "Didact Gothic", family: didactGothic.style.fontFamily, fontWeight: 400 },
  // {
  //   label: "Host Grotesk",
  //   family: hostGrotesk.style.fontFamily,
  //   fontWeight: 300,
  // },
  { label: "Rethink Sans", family: rethink.style.fontFamily, fontWeight: 400 },
] as const;

const BODY_STYLE = {
  fontSize: "var(--text-md)",
  lineHeight: 1.65,
  letterSpacing: "0.02em",
  wordSpacing: "0.05em",
  fontWeight: 400,
  color: "var(--text-secondary)",
} as const;

const MIN_TEXTAREA_HEIGHT = `${3 * BODY_STYLE.lineHeight}em`;

type FontKey = (typeof PREVIEW_FONTS)[number]["label"];
type ParaTexts = [string, string, string];
type TextsState = Record<FontKey, ParaTexts>;

const initialTexts = (): TextsState =>
  Object.fromEntries(
    PREVIEW_FONTS.map((f) => [f.label, [...STARTERS] as ParaTexts])
  ) as TextsState;

type PreviewParagraphProps = {
  family: string;
  fontWeight: number;
  value: string;
  paraIndex: number;
  fontLabel: string;
  onChange: (value: string) => void;
};

function PreviewParagraph({
  family,
  fontWeight,
  value,
  paraIndex,
  fontLabel,
  onChange,
}: PreviewParagraphProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const syncHeight = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const minPx =
      parseFloat(getComputedStyle(ta).fontSize) * BODY_STYLE.lineHeight * 3;
    ta.style.height = `${Math.max(ta.scrollHeight, minPx)}px`;
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={taRef}
      value={value}
      rows={3}
      spellCheck
      aria-label={`${fontLabel} paragraph ${paraIndex + 1}`}
      placeholder={`Paragraph ${paraIndex + 1}…`}
      onChange={(e) => onChange(e.target.value)}
      className="m-0 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:outline-none placeholder:text-black/20"
      style={{
        ...BODY_STYLE,
        fontFamily: family,
        fontWeight,
        minHeight: MIN_TEXTAREA_HEIGHT,
      }}
    />
  );
}

type FontPreviewSectionProps = {
  label: FontKey;
  family: string;
  fontWeight: number;
  paragraphs: ParaTexts;
  onParagraphChange: (index: number, value: string) => void;
};

function FontPreviewSection({
  label,
  family,
  fontWeight,
  paragraphs,
  onParagraphChange,
}: FontPreviewSectionProps) {
  return (
    <section>
      <p
        className="mb-4 text-xs tracking-wide text-black/40"
        style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}
      >
        {label}
      </p>
      <div className="flex flex-col gap-6">
        {paragraphs.map((text, i) => (
          <PreviewParagraph
            key={i}
            family={family}
            fontWeight={fontWeight}
            value={text}
            paraIndex={i}
            fontLabel={label}
            onChange={(next) => onParagraphChange(i, next)}
          />
        ))}
      </div>
    </section>
  );
}

export default function CanvasFontPreview() {
  const [texts, setTexts] = useState(initialTexts);

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 overflow-y-auto overscroll-y-contain"
      style={{ background: "rgba(255, 254, 252, 0.97)" }}
      aria-label="Font preview (temporary)"
    >
      <div className="mx-auto flex w-full max-w-[min(92vw,45rem)] flex-col gap-16 px-6 py-20">
        {PREVIEW_FONTS.map(({ label, family, fontWeight }) => (
          <FontPreviewSection
            key={label}
            label={label}
            family={family}
            fontWeight={fontWeight}
            paragraphs={texts[label]}
            onParagraphChange={(index, next) =>
              setTexts((prev) => {
                const paras = [...prev[label]] as ParaTexts;
                paras[index] = next;
                return { ...prev, [label]: paras };
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
