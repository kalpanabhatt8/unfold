"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Palette, Trash2, Upload } from "lucide-react";
import { RgbaColorPicker, type RgbaColor } from "react-colorful";
import { BookCover } from "@/components/book-cover";
import { BOOK_CONFIG } from "@/components/book-cover-config";
import {
  btnIcon,
  btnRadius,
  btnState,
  btnText,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import type { BookCoverVariant } from "@/components/book-cover";
import { bookCoverSamples, getTemplateById } from "@/data/book-templates";
import { coverBackgroundVar } from "@/data/cover-gradients";
import {
  DRAFTS_STORAGE_KEY,
  syncDraftsAndRecents,
  type RecentBook,
} from "@/lib/recent-books";

const blankDefaults = {
  id: "blank",
  variant: "solid" as const,
  title: "",
  subtitle: "",
  background: coverBackgroundVar("g1"),
};

// A tight, opinionated palette — five calm presets, no custom CSS field.
const backgroundPresets = [
  { id: "g1", value: coverBackgroundVar("g1") },
  { id: "g2", value: coverBackgroundVar("g2") },
  { id: "g3", value: coverBackgroundVar("g3") },
  { id: "g4", value: coverBackgroundVar("g4") },
  { id: "g5", value: coverBackgroundVar("g5") },
];

type DraftPayload = RecentBook & { variant: BookCoverVariant };
const hexToRgba = (hex: string): RgbaColor => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3 ? clean.split("").map((ch) => ch + ch).join("") : clean;
  const value = full.slice(0, 6);
  const r = Number.parseInt(value.slice(0, 2), 16) || 0;
  const g = Number.parseInt(value.slice(2, 4), 16) || 0;
  const b = Number.parseInt(value.slice(4, 6), 16) || 0;
  return { r, g, b, a: 1 };
};

const rgbaToCss = ({ r, g, b, a }: RgbaColor) =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.max(
    0,
    Math.min(1, a)
  ).toFixed(2)})`;

const channelToHex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");

const rgbaToHex = ({ r, g, b }: RgbaColor) =>
  `${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`.toUpperCase();

const sanitizeHexInput = (value: string) =>
  value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase();

const cssColorToRgba = (value: string): RgbaColor | null => {
  const trimmed = value.trim();
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) return hexToRgba(trimmed);

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)(?:\s*,\s*([+-]?\d*\.?\d+)\s*)?\)$/
  );
  if (!rgbaMatch) return null;

  const r = Number(rgbaMatch[1]);
  const g = Number(rgbaMatch[2]);
  const b = Number(rgbaMatch[3]);
  const a = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]);
  if (![r, g, b, a].every((channel) => Number.isFinite(channel))) return null;

  return {
    r: Math.max(0, Math.min(255, r)),
    g: Math.max(0, Math.min(255, g)),
    b: Math.max(0, Math.min(255, b)),
    a: Math.max(0, Math.min(1, a)),
  };
};

/** Readable hint chrome derived from the same color as the book cover background. */
const coverPhotoHintStyles = (backgroundCss: string): React.CSSProperties => {
  const parsed = cssColorToRgba(backgroundCss);
  if (!parsed) {
    return {
      color: "var(--text-secondary)",
      backgroundColor: "color-mix(in srgb, var(--gray-75) 88%, transparent)",
      borderColor: "rgba(0,0,0,0.08)",
    };
  }
  const { r, g, b, a } = parsed;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const base = rgbaToCss({ r, g, b, a: Math.min(1, a) });
  if (lum > 0.52) {
    const textR = Math.round(Math.max(24, Math.min(255, r * 0.28)));
    const textG = Math.round(Math.max(24, Math.min(255, g * 0.28)));
    const textB = Math.round(Math.max(24, Math.min(255, b * 0.28)));
    return {
      color: `rgb(${textR}, ${textG}, ${textB})`,
      backgroundColor: `color-mix(in srgb, ${base} 18%, white)`,
      borderColor: `color-mix(in srgb, ${base} 35%, rgba(0,0,0,0.12))`,
    };
  }
  return {
    color: "rgba(255, 252, 248, 0.94)",
    backgroundColor: `color-mix(in srgb, ${base} 42%, rgba(0,0,0,0.55))`,
    borderColor: `color-mix(in srgb, ${base} 55%, rgba(255,255,255,0.2))`,
    textShadow: "0 1px 14px rgba(0,0,0,0.22)",
  };
};

const BookBuilderPage = () => {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = params?.id ?? "blank";
  const templateParam = searchParams.get("template");
  // Cover page is one-time on first creation. Re-edits arrive with a `from`
  // hint so Back and the primary CTA return to the originating surface:
  //   - `from=canvas`    → keep writing (back/CTA → canvas)
  //   - `from=dashboard` → quick cover tweak (back/CTA → dashboard)
  //   - (none)           → first creation (back → dashboard, CTA → canvas)
  const fromHint = searchParams.get("from");
  const fromCanvas = fromHint === "canvas";
  const fromDashboard = fromHint === "dashboard";
  const shouldAutoFocusTitle = !fromCanvas && !fromDashboard;

  // Bare ids (`blank` / a template id) get rewritten into a unique draft id so
  // the book has a stable home in storage. Behaviour preserved from earlier.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (templateParam) return;

    const isBlank = draftId === "blank";
    const templateExists = !isBlank && Boolean(getTemplateById(draftId));
    if (!isBlank && !templateExists) return;

    const base = isBlank ? "blank" : draftId;
    const derivedId = `${base}-${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    router.replace(`/dashboard/books/${derivedId}?template=${base}`);
  }, [draftId, router, templateParam]);

  const template = useMemo(() => {
    if (!templateParam || templateParam === "blank") return null;
    return getTemplateById(templateParam);
  }, [templateParam]);

  const base = template ?? blankDefaults;
  const defaultBackground = template
    ? coverBackgroundVar(template.coverGradientId)
    : blankDefaults.background;

  const [title, setTitle] = useState(base.title);
  const [subtitle, setSubtitle] = useState(base.subtitle ?? "");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [pickerColor, setPickerColor] = useState<RgbaColor>(() =>
    hexToRgba("#8ba9cf")
  );
  const [hexInput, setHexInput] = useState("8BA9CF");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [background, setBackground] = useState<string>(defaultBackground);
  const [hydrated, setHydrated] = useState(false);
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(
    templateParam ?? null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!templateParam) return;
    setSourceTemplateId(templateParam);
  }, [templateParam]);

  useEffect(() => {
    if (!isColorPickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (colorPickerRef.current?.contains(target)) return;
      setIsColorPickerOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isColorPickerOpen]);

  // Hydrate from any existing draft so reopening the customization page never
  // forgets work in progress (cover image, background, edited title, etc.).
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
      const drafts = raw ? (JSON.parse(raw) as Record<string, DraftPayload>) : {};
      const existing = drafts[draftId];

      if (existing) {
        if (typeof existing.title === "string") setTitle(existing.title);
        if (typeof existing.subtitle === "string") setSubtitle(existing.subtitle);
        if (typeof existing.coverImage === "string" || existing.coverImage === null) {
          setCoverImage(existing.coverImage ?? null);
        }
        if (existing.background) setBackground(existing.background);
        if (typeof existing.sourceTemplateId === "string") {
          setSourceTemplateId(existing.sourceTemplateId);
        } else if (existing.sourceTemplateId === null) {
          setSourceTemplateId(null);
        }
      }
    } catch (error) {
      console.error("Failed to load draft configuration", error);
    } finally {
      setHydrated(true);
    }
  }, [draftId]);

  const variant: BookCoverVariant = coverImage ? "image" : "solid";
  const colorPresets = useMemo(() => {
    const basePresets = backgroundPresets.slice(0, 4);
    const baseValues = new Set(basePresets.map((preset) => preset.value));
    const parsedCurrent = cssColorToRgba(background);
    if (!parsedCurrent) return basePresets;
    const normalizedCurrent = rgbaToCss(parsedCurrent);
    if (baseValues.has(normalizedCurrent)) return basePresets;

    return [...basePresets, { id: "custom-last", value: normalizedCurrent }];
  }, [background]);
  const sampleImages = useMemo(() => {
    const baseImages = bookCoverSamples.slice(0, 4);
    if (!coverImage || baseImages.includes(coverImage)) return baseImages;
    return [...baseImages, coverImage];
  }, [coverImage]);

  const coverPhotoHintChrome = useMemo(
    () => coverPhotoHintStyles(background),
    [background]
  );

  useEffect(() => {
    const parsed = cssColorToRgba(background);
    if (!parsed) return;
    setPickerColor(parsed);
    setHexInput(rgbaToHex(parsed));
  }, [background]);

  const persistCurrentDraft = useCallback(
    (updatedAt: number) => {
      if (typeof window === "undefined") return;

      try {
        const draftsRaw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
        const drafts = draftsRaw
          ? (JSON.parse(draftsRaw) as Record<string, DraftPayload>)
          : {};
        const existing = drafts[draftId];
        drafts[draftId] = {
          ...existing,
          id: draftId,
          title: title.trim(),
          subtitle: subtitle.trim() ? subtitle.trim() : undefined,
          coverImage: coverImage ?? null,
          background,
          variant,
          // Customization preserves color overrides if a template provided them,
          // but never sets them itself — this page is intentionally minimal.
          titleColor: existing?.titleColor ?? null,
          subtitleColor: existing?.subtitleColor ?? null,
          sourceTemplateId:
            sourceTemplateId ??
            templateParam ??
            (template ? template.id : "blank"),
          // Customization-only saves do NOT flip canvasOpened — Recents stays
          // empty for this book until the canvas is actually opened.
          canvasOpened: existing?.canvasOpened === true,
          updatedAt,
        };
        syncDraftsAndRecents<DraftPayload>(drafts);
      } catch (error) {
        console.error("Failed to persist draft", error);
      }
    },
    [
      background,
      coverImage,
      draftId,
      sourceTemplateId,
      subtitle,
      template,
      templateParam,
      title,
      variant,
    ]
  );

  // Light debounce so every keystroke isn't writing to localStorage.
  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(
      () => persistCurrentDraft(Date.now()),
      250
    );
    return () => window.clearTimeout(timeout);
  }, [hydrated, persistCurrentDraft]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setCoverImage(result);
        setBackground(defaultBackground);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const goToCanvas = () => {
    persistCurrentDraft(Date.now());
    const tpl =
      sourceTemplateId ?? templateParam ?? (template ? template.id : "blank");
    const queryString = tpl ? `?template=${encodeURIComponent(tpl)}` : "";
    router.push(`/dashboard/books/${draftId}/canvas${queryString}`);
  };

  const goToDashboard = () => {
    persistCurrentDraft(Date.now());
    router.push("/dashboard");
  };

  const handleBack = () => {
    if (fromCanvas) {
      // Re-edit from canvas — return to where they were writing.
      goToCanvas();
      return;
    }
    // First creation and dashboard re-edits both back out to the dashboard.
    router.push("/dashboard");
  };

  const handlePrimary = () => {
    // Clicking the cover should always open this draft's canvas.
    goToCanvas();
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* Soft ambient backdrop — keeps the page from feeling like a form. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        // style={{
        //   background:
        //     "radial-gradient(60% 50% at 50% 22%, rgba(0,0,0,0.04), transparent 70%), var(--surface-0)",
        // }}
      />

      <button
        type="button"
        onClick={handleBack}
        className={`fixed left-4 top-4 z-30 px-3 ${btnRadius.pill} ${btnText("sm")} ${btnState.default} ${btnState.hover} ${btnState.active}`}
        aria-label={fromCanvas ? "Back to writing" : "Back to dashboard"}
        title={fromCanvas ? "Back to writing" : "Back to dashboard"}
      >
        <ArrowLeft strokeWidth={iconStroke("sm")} size={iconPx("sm")} aria-hidden className={iconFixed} />
        Back
      </button>

      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 py-24">
        {/* —— Live preview ——————————————————————————————————————————— */}
        <div className="flex w-full max-w-md flex-col items-center gap-1.5">
       
          {/* <input
            type="text"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            placeholder="Add a short subtitle"
            className="w-full bg-transparent text-center text-sm text-[var(--text-secondary)] placeholder:text-black/25 outline-none"
            spellCheck={false}
            aria-label="Book subtitle"
          /> */}
        </div>
        <div className="flex w-full max-w-md flex-col items-center gap-2.5 mb-4">
          {coverImage ? (
            <p
              role="status"
              className="w-full max-w-[min(100%,18rem)] rounded-lg border px-3 py-2 text-center text-[0.8125rem] leading-snug tracking-[-0.01em]"
              style={coverPhotoHintChrome}
            >
              Cover photo is on — your title still updates on the book. Tap the
              book when you are ready to write inside.
            </p>
          ) : null}
          <button
            type="button"
            onClick={handlePrimary}
            className={`${BOOK_CONFIG.lg.container} book-shadow-div cursor-pointer`}
            aria-label="Open book canvas"
            title="Open canvas"
          >
            <BookCover
              size="lg"
              variant={variant}
              title={title || " "}
              subtitle={subtitle || undefined}
              coverImageUrl={coverImage}
              className="h-full w-full"
              style={{ background }}
            />
          </button>
          {coverImage ? (
            <p
              className="w-full max-w-[min(100%,20rem)] rounded-lg border px-3 py-2 text-center text-[0.75rem] leading-snug text-balance opacity-95"
              style={coverPhotoHintChrome}
            >
              Change the photo with the thumbnails or upload below. Remove it to
              bring back solid cover colors.
            </p>
          ) : null}
        </div>
        <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            size={Math.max(title.length, 15)}
            placeholder="Untitled book"
            autoFocus={shouldAutoFocusTitle}
            className="w-auto bg-[var(--gray-75)] rounded-md p-2 text-center text-[1.6rem] font-medium leading-tight tracking-[-0.01em] text-[var(--text-primary)] placeholder:text-black/35 outline-none"
            style={{
              fontFamily:
                "var(--font-bricolage), var(--font-manrope), system-ui, sans-serif",
            }}
            spellCheck={false}
            aria-label="Book title"
          />

        {/* —— Inline title / subtitle —————————————————————————————————
             Inputs sit below the book and update it live. They look like
             plain text so the page feels like writing, not filling a form. */}

        {/* —— Minimal controls ———————————————————————————————————————
             A single calm row: background presets · divider · cover photo. */}
        <div className="surface-toolbar">
          <div
            role="group"
            aria-label="Cover colors"
            ref={colorPickerRef}
            className="relative rounded-[0.5rem] bg-white outline outline-1 outline-black/[0.08]"
          >
            <div className="flex items-center gap-0 overflow-hidden rounded-[0.5rem]">
              {colorPresets.map((preset) => {
                return (
                  <button
                    key={`${preset.id}-${preset.value}`}
                    type="button"
                    onClick={() => {
                      setBackground(preset.value);
                      setCoverImage(null);
                    }}
                    aria-label={`Use ${preset.id} background`}
                    className="h-10 w-10 shrink-0 transition hover:brightness-95"
                    style={{ background: preset.value }}
                  />
                );
              })}
              <button
                type="button"
                className={`relative inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center transition ${btnState.neutral} ${btnState.hover} ${btnState.active}`}
                aria-label="Pick custom cover color"
                title="Pick custom color"
                onClick={() => setIsColorPickerOpen((open) => !open)}
              >
                <Palette size={iconPx("md")} strokeWidth={iconStroke("md")} />
              </button>
            </div>

            {isColorPickerOpen ? (
              <div className="absolute left-0 bottom-[calc(100%+0.75rem)] z-50 w-[fit-content] rounded-2xl bg-white p-3 shadow-[0_18px_42px_rgba(0,0,0,0.14)]">
                <RgbaColorPicker
                  color={pickerColor}
                  onChange={(next) => {
                    setPickerColor(next);
                    setHexInput(rgbaToHex(next));
                    const css = rgbaToCss(next);
                    setBackground(css);
                    setCoverImage(null);
                  }}
                  className="color-picker !w-[full]"
                />
                <div className="mt-3 flex items-center gap-2 text-[var(--text-secondary)] w-[fit-content]">
                  <div className=" flex items-center overflow-hidden rounded-sm bg-black/[0.03]">
                    <span className="px-3 py-1.5 text-sm text-black/85">Hex</span>
                    <input
                      type="text"
                      value={hexInput}
                      onChange={(event) => {
                        const nextHex = sanitizeHexInput(event.target.value);
                        setHexInput(nextHex);
                        if (nextHex.length !== 6) return;
                        const nextRgba = {
                          ...hexToRgba(`#${nextHex}`),
                          a: pickerColor.a,
                        };
                        setPickerColor(nextRgba);
                        const css = rgbaToCss(nextRgba);
                        setBackground(css);
                        setCoverImage(null);
                      }}
                      placeholder="FFFFFF"
                      className="w-[7.5rem] bg-white px-3 py-1.5 text-sm uppercase tracking-[0.06em] text-black/90 outline-none"
                      aria-label="Hex color value"
                    />
                    <div className="flex items-center gap-1 bg-black/[0.03] px-2 py-1.5 text-sm text-black/75">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Math.round((pickerColor.a ?? 1) * 100)}
                        onChange={(event) => {
                          const raw = Number(event.target.value);
                          const safe = Number.isFinite(raw)
                            ? Math.max(0, Math.min(100, raw))
                            : 100;
                          const nextRgba = {
                            ...pickerColor,
                            a: safe / 100,
                          };
                          setPickerColor(nextRgba);
                          const css = rgbaToCss(nextRgba);
                          setBackground(css);
                          setCoverImage(null);
                        }}
                        className="w-[fit-content] bg-transparent text-right text-sm text-black/85 outline-none"
                        aria-label="Opacity percentage"
                      />
                      <span>%</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            role="group"
            aria-label="Preset cover images"
            className="flex items-center gap-0 overflow-hidden rounded-[0.5rem] bg-white outline outline-1 outline-black/[0.08]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          
            {sampleImages.map((imageSrc) => {
              return (
                <button
                  key={imageSrc}
                  type="button"
                  onClick={() => {
                    setCoverImage(imageSrc);
                    setBackground(defaultBackground);
                  }}
                  aria-label="Use preset cover image"
                  className="relative h-10 w-10 shrink-0 bg-cover bg-center transition hover:brightness-95"
                  style={{ backgroundImage: `url(${imageSrc})` }}
                />
              );
            })}
              <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`h-10 w-10 shrink-0 flex items-center justify-center border-none transition ${btnState.neutral} ${btnState.hover} ${btnState.active}`}
              aria-label="Upload cover photo"
              title="Upload cover photo"
            >
              <Upload strokeWidth={iconStroke("md")} size={iconPx("md")} aria-hidden className={iconFixed} />
            </button>

          
          </div>
          <button
              type="button"
              onClick={() => setCoverImage(null)}
              className={`${btnIcon("lg")} ${btnState.default} ${btnState.hover} ${btnState.active} !rounded-[0.5rem]`}
              aria-label="Remove cover photo"
              title="Remove cover photo"
            >
              <Trash2 strokeWidth={iconStroke("md")} size={iconPx("md")} aria-hidden className={iconFixed} />
            </button>

       
        </div>

      </section>
    </main>
  );
};

export default BookBuilderPage;
