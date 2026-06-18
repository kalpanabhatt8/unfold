"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  coverBackgroundVar,
  coverGradientIdFromBackground,
  resolveBookCoverBackground,
} from "@/data/cover-gradients";
import {
  coverOverlayTextStyles,
  estimateBackgroundLuminance,
  sampleCoverImageFromUrl,
} from "@/lib/cover-text-contrast";
import { BOOK_TITLE_PLACEHOLDER } from "@/lib/book-title";
import {
  DRAFTS_STORAGE_KEY,
  readDraftById,
  RECENTS_UPDATED_EVENT,
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
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const value = full.slice(0, 6);
  const r = Number.parseInt(value.slice(0, 2), 16) || 0;
  const g = Number.parseInt(value.slice(2, 4), 16) || 0;
  const b = Number.parseInt(value.slice(4, 6), 16) || 0;
  return { r, g, b, a: 1 };
};

const rgbaToCss = ({ r, g, b, a }: RgbaColor) =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.max(
    0,
    Math.min(1, a),
  ).toFixed(2)})`;

const channelToHex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");

const rgbaToHex = ({ r, g, b }: RgbaColor) =>
  `${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`.toUpperCase();

const sanitizeHexInput = (value: string) =>
  value
    .replace(/[^0-9a-fA-F]/g, "")
    .slice(0, 6)
    .toUpperCase();

const cssColorToRgba = (value: string): RgbaColor | null => {
  const trimmed = value.trim();
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) return hexToRgba(trimmed);

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)(?:\s*,\s*([+-]?\d*\.?\d+)\s*)?\)$/,
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
    hexToRgba("#8ba9cf"),
  );
  const [hexInput, setHexInput] = useState("8BA9CF");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [background, setBackground] = useState<string>(() =>
    resolveBookCoverBackground(defaultBackground),
  );
  const [hydrated, setHydrated] = useState(false);
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(
    templateParam ?? null,
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

  // When the popover opens, align picker + hex with the current cover
  // `background`. Do not re-sync on every `background` change while dragging —
  // that round-trips through CSS and fights the picker (visible flicker).
  useEffect(() => {
    if (!isColorPickerOpen) return;
    const parsed = cssColorToRgba(background);
    if (!parsed) return;
    setPickerColor(parsed);
    setHexInput(rgbaToHex(parsed));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only when opening
  }, [isColorPickerOpen]);

  const applyDraftToCoverState = useCallback((existing: RecentBook | null) => {
    if (!existing) return;
    if (typeof existing.title === "string") setTitle(existing.title);
    if (typeof existing.subtitle === "string") setSubtitle(existing.subtitle);
    if (
      typeof existing.coverImage === "string" ||
      existing.coverImage === null
    ) {
      setCoverImage(existing.coverImage ?? null);
    }
    if (existing.background) {
      const resolved = resolveBookCoverBackground(existing.background);
      setBackground(resolved);
      const parsedBg = cssColorToRgba(resolved);
      if (parsedBg) {
        setPickerColor(parsedBg);
        setHexInput(rgbaToHex(parsedBg));
      }
    }
    if (typeof existing.sourceTemplateId === "string") {
      setSourceTemplateId(existing.sourceTemplateId);
    } else if (existing.sourceTemplateId === null) {
      setSourceTemplateId(null);
    }
  }, []);

  // Hydrate from draft; re-sync when canvas (or dashboard) updates the same draft.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromStorage = () => {
      try {
        applyDraftToCoverState(readDraftById(draftId));
      } catch (error) {
        console.error("Failed to load draft configuration", error);
      }
    };

    syncFromStorage();
    setHydrated(true);

    window.addEventListener(RECENTS_UPDATED_EVENT, syncFromStorage);
    const onPageShow = () => syncFromStorage();
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener(RECENTS_UPDATED_EVENT, syncFromStorage);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [applyDraftToCoverState, draftId]);

  const variant: BookCoverVariant = coverImage ? "image" : "solid";

  const resolvedCoverGradient = useMemo(
    () => coverGradientIdFromBackground(background),
    [background],
  );
  const coverFallbackLuminance = useMemo(
    () => estimateBackgroundLuminance(background, resolvedCoverGradient),
    [background, resolvedCoverGradient],
  );
  const [coverImageRegionLum, setCoverImageRegionLum] = useState<number | null>(
    null,
  );
  useEffect(() => {
    if (variant !== "image" || !coverImage) {
      setCoverImageRegionLum(null);
      return;
    }
    let cancelled = false;
    void sampleCoverImageFromUrl(coverImage).then((lum) => {
      if (!cancelled) setCoverImageRegionLum(lum);
    });
    return () => {
      cancelled = true;
    };
  }, [variant, coverImage]);
  const coverEffectiveLuminance =
    variant === "image" && coverImageRegionLum !== null
      ? coverImageRegionLum
      : coverFallbackLuminance;
  const journalHintStyle = useMemo(
    () =>
      coverOverlayTextStyles({
        luminance: coverEffectiveLuminance,
        onImage: variant === "image" && Boolean(coverImage),
      }).hint,
    [coverEffectiveLuminance, variant, coverImage],
  );

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

  const persistCurrentDraft = useCallback(
    (updatedAt: number) => {
      if (typeof window === "undefined") return;

      try {
        const draftsRaw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
        const drafts = draftsRaw
          ? (JSON.parse(draftsRaw) as Record<string, DraftPayload>)
          : {};
        const existing = drafts[draftId] ?? readDraftById(draftId) ?? undefined;
        drafts[draftId] = {
          ...existing,
          id: draftId,
          title: title.trim(),
          subtitle: subtitle.trim() ? subtitle.trim() : undefined,
          coverImage: coverImage ?? null,
          background: resolveBookCoverBackground(background),
          variant,
          // Cover title/subtitle colors are derived automatically from the cover.
          titleColor: null,
          subtitleColor: null,
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
    ],
  );

  // Light debounce so every keystroke isn't writing to localStorage.
  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(
      () => persistCurrentDraft(Date.now()),
      250,
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
    // Replace so browser back from the canvas skips this one-time setup page.
    router.replace(`/dashboard/books/${draftId}/canvas${queryString}`);
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
        <ArrowLeft
          strokeWidth={iconStroke("sm")}
          size={iconPx("sm")}
          aria-hidden
          className={iconFixed}
        />
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
        <div className="mb-4 flex w-full max-w-md flex-col items-center gap-3">
          <button
            type="button"
            onClick={handlePrimary}
            className={`relative ${BOOK_CONFIG.lg.container} book-shadow-div cursor-pointer`}
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
              style={{
                background: resolveBookCoverBackground(background),
              }}
            />
          </button>
          <span
            aria-hidden
            className="pointer-events-none text-center text-xs leading-none tracking-[0.04em]"
            style={journalHintStyle}
          >
            Click to open canvas
          </span>
        </div>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          size={Math.max(title.length, 15)}
          placeholder={BOOK_TITLE_PLACEHOLDER}
          autoFocus={shouldAutoFocusTitle}
          className="header-xl w-auto rounded-md bg-[var(--gray-75)] p-2 text-center font-medium leading-tight tracking-[-0.01em] text-[var(--text-primary)] placeholder:text-black/35 outline-none"
          style={{
            fontFamily:
              "var(--font-heading)",
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
                      const parsedPreset = cssColorToRgba(preset.value);
                      if (parsedPreset) {
                        setPickerColor(parsedPreset);
                        setHexInput(rgbaToHex(parsedPreset));
                      }
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
                    <span className="px-3 py-1.5 text-sm text-black/85">
                      Hex
                    </span>
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
              <Upload
                strokeWidth={iconStroke("md")}
                size={iconPx("md")}
                aria-hidden
                className={iconFixed}
              />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCoverImage(null)}
            className={`${btnIcon("lg")} ${btnState.default} ${btnState.hover} ${btnState.active} !rounded-[0.5rem]`}
            aria-label="Remove cover photo"
            title="Remove cover photo"
          >
            <Trash2
              strokeWidth={iconStroke("md")}
              size={iconPx("md")}
              aria-hidden
              className={iconFixed}
            />
          </button>
        </div>
      </section>
    </main>
  );
};

export default BookBuilderPage;
