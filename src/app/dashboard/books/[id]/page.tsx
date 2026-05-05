"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import type { BookCoverVariant } from "@/components/book-cover";
import { getTemplateById } from "@/data/book-templates";
import { coverBackgroundVar } from "@/data/cover-gradients";
import {
  DRAFTS_STORAGE_KEY,
  syncDraftsAndRecents,
  type RecentBook,
} from "@/lib/recent-books";

const blankDefaults = {
  id: "blank",
  variant: "solid" as const,
  title: "Untitled book",
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

const BookBuilderPage = () => {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = params?.id ?? "blank";
  const templateParam = searchParams.get("template");
  // Cover page is one-time on first creation; reaching it from the canvas adds
  // `?from=canvas` so we can route Back / the CTA back to writing instead of
  // the dashboard.
  const fromCanvas = searchParams.get("from") === "canvas";

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

  const [title, setTitle] = useState(base.title);
  const [subtitle, setSubtitle] = useState(base.subtitle ?? "");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [background, setBackground] = useState<string>(
    template ? coverBackgroundVar(template.coverGradientId) : blankDefaults.background
  );
  const [hydrated, setHydrated] = useState(false);
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(
    templateParam ?? null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!templateParam) return;
    setSourceTemplateId(templateParam);
  }, [templateParam]);

  // Hydrate from any existing draft so reopening the customization page never
  // forgets work in progress (cover image, background, edited title, etc.).
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
      const drafts = raw ? (JSON.parse(raw) as Record<string, DraftPayload>) : {};
      const existing = drafts[draftId];

      if (existing) {
        if (existing.title) setTitle(existing.title);
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
          title: title.trim() || blankDefaults.title,
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
      if (typeof result === "string") setCoverImage(result);
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

  const handleBack = () => {
    if (fromCanvas) {
      // Editing an existing book's cover — return to where they were writing.
      goToCanvas();
      return;
    }
    router.push("/dashboard");
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* Soft ambient backdrop — keeps the page from feeling like a form. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 22%, rgba(0,0,0,0.04), transparent 70%), var(--surface-0)",
        }}
      />

      <button
        type="button"
        onClick={handleBack}
        className="fixed left-4 top-4 z-30 inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/80 px-3 py-1.5 text-sm text-black/65 backdrop-blur-md transition hover:bg-white hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/30 focus-visible:outline-offset-2"
        aria-label={fromCanvas ? "Back to writing" : "Back to dashboard"}
      >
        <ArrowLeft strokeWidth={1.75} size={15} aria-hidden />
        Back
      </button>

      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-10 px-6 py-24">
        {/* —— Live preview ——————————————————————————————————————————— */}
        <div className="flex flex-col items-center">
          <div className="h-[19.875rem] w-[14.125rem] book-shadow-div">
            <BookCover
              variant={variant}
              title={title || " "}
              subtitle={subtitle || undefined}
              coverImageUrl={coverImage}
              className="h-full w-full"
              style={{ background }}
            />
          </div>
        </div>

        {/* —— Inline title / subtitle —————————————————————————————————
             Inputs sit below the book and update it live. They look like
             plain text so the page feels like writing, not filling a form. */}
        <div className="flex w-full max-w-md flex-col items-center gap-1.5">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled book"
            className="w-full bg-transparent text-center text-[1.6rem] font-medium leading-tight tracking-[-0.01em] text-[var(--text-primary)] placeholder:text-black/25 outline-none"
            style={{
              fontFamily:
                "var(--font-bricolage), var(--font-manrope), system-ui, sans-serif",
            }}
            spellCheck={false}
            aria-label="Book title"
          />
          <input
            type="text"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            placeholder="Add a short subtitle"
            className="w-full bg-transparent text-center text-sm text-[var(--text-secondary)] placeholder:text-black/25 outline-none"
            spellCheck={false}
            aria-label="Book subtitle"
          />
        </div>

        {/* —— Minimal controls ———————————————————————————————————————
             A single calm row: background presets · divider · cover photo. */}
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-full border border-black/[0.06] bg-white/80 px-3 py-2 shadow-[0_8px_28px_rgba(15,15,15,0.06)] backdrop-blur-md">
          <div
            role="group"
            aria-label="Background"
            className="flex items-center gap-2 px-1"
          >
            {backgroundPresets.map((preset) => {
              const active = preset.value === background && !coverImage;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setBackground(preset.value);
                    setCoverImage(null);
                  }}
                  aria-label={`Use ${preset.id} background`}
                  className={clsx(
                    "h-6 w-6 shrink-0 rounded-full border transition",
                    active
                      ? "border-black/45 ring-2 ring-black/10"
                      : "border-black/10 hover:border-black/30"
                  )}
                  style={{ background: preset.value }}
                />
              );
            })}
          </div>

          <span aria-hidden className="h-6 w-px shrink-0 bg-black/[0.08]" />

          <div className="flex items-center gap-1.5 pr-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-black/70 transition hover:bg-black/[0.05] hover:text-black"
            >
              <ImagePlus strokeWidth={1.75} size={15} aria-hidden />
              {coverImage ? "Change photo" : "Cover photo"}
            </button>
            {coverImage ? (
              <button
                type="button"
                onClick={() => setCoverImage(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-black/45 transition hover:bg-black/[0.05] hover:text-black/80"
                aria-label="Remove cover photo"
                title="Remove cover photo"
              >
                <Trash2 strokeWidth={1.75} size={14} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={goToCanvas}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--gray-900)] px-7 py-2.5 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/40 focus-visible:outline-offset-2"
        >
          {fromCanvas ? "Done" : "Open book"}
        </button>
      </section>
    </main>
  );
};

export default BookBuilderPage;
