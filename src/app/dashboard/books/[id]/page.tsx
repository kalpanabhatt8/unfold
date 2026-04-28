"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  title: "Untitled Book",
  subtitle: "Describe this notebook",
  background: coverBackgroundVar("g1"),
};

const backgroundOptions = [
  { id: "g1", label: "Gradient 1", value: coverBackgroundVar("g1") },
  { id: "g2", label: "Gradient 2", value: coverBackgroundVar("g2") },
  { id: "g3", label: "Gradient 3", value: coverBackgroundVar("g3") },
  { id: "g4", label: "Gradient 4", value: coverBackgroundVar("g4") },
];

const galleryOptions = [
  {
    id: "cover-clouds",
    label: "Clouds",
    preview:
      "linear-gradient(180deg, rgba(246,248,255,0.95) 0%, rgba(214,222,255,0.85) 60%, rgba(186,210,255,0.75) 100%)",
  },
  {
    id: "cover-grid",
    label: "Champagne Grid",
    preview:
      "linear-gradient(180deg, #fef9f0 0%, #f7f0de 100%), repeating-linear-gradient(90deg, rgba(0,0,0,0.04), rgba(0,0,0,0.04) 1px, transparent 1px, transparent 18px), repeating-linear-gradient(0deg, rgba(0,0,0,0.04), rgba(0,0,0,0.04) 1px, transparent 1px, transparent 18px)",
  },
  {
    id: "cover-soft-glow",
    label: "Soft Glow",
    preview:
      "linear-gradient(135deg, rgba(255,236,221,0.9) 0%, rgba(255,211,226,0.85) 45%, rgba(215,203,255,0.8) 100%)",
  },
];

type DraftPayload = RecentBook & { variant: BookCoverVariant };

const titleColorOptions = [
  { id: "ink-strong", label: "Deep Ink", value: "#3D3D3D" },
  { id: "plum", label: "Soft Plum", value: "#50456E" },
  { id: "lavender", label: "Lavender", value: "#6F5DD2" },
  { id: "fog", label: "Fog", value: "#7D7A99" },
  { id: "charcoal", label: "Charcoal", value: "#2E2A3F" },
];

const subtitleColorOptions = [
  { id: "ink-soft", label: "Muted Ink", value: "#5E5A6F" },
  { id: "dust", label: "Dust", value: "#6F6A80" },
  { id: "mauve", label: "Mauve", value: "#8A7FB6" },
  { id: "cool-grey", label: "Cool Grey", value: "#8F8F99" },
  { id: "warm-grey", label: "Warm Grey", value: "#A09993" },
];

const BookBuilderPage = () => {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = params?.id ?? "blank";
  const templateParam = searchParams.get("template");

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
  const [background, setBackground] = useState<string>(blankDefaults.background);
  const [customBackground, setCustomBackground] = useState<string>("");
  const [titleColor, setTitleColor] = useState<string>("");
  const [subtitleColor, setSubtitleColor] = useState<string>("");
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(
    templateParam ?? null
  );

  useEffect(() => {
    if (!templateParam) return;
    setSourceTemplateId(templateParam);
  }, [templateParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const draftsRaw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
      const drafts = draftsRaw
        ? (JSON.parse(draftsRaw) as Record<string, DraftPayload>)
        : {};
      const existing = drafts[draftId];

      if (existing) {
        if (existing.title) setTitle(existing.title);
        if (typeof existing.subtitle === "string") setSubtitle(existing.subtitle);
        if (typeof existing.coverImage === "string" || existing.coverImage === null) {
          setCoverImage(existing.coverImage ?? null);
        }

        if (existing.background) {
          const matchesPreset = backgroundOptions.some(
            (option) => option.value === existing.background
          );
          if (matchesPreset) {
            setBackground(existing.background);
            setCustomBackground("");
          } else {
            setCustomBackground(existing.background);
          }
        } else if (template) {
          setCustomBackground(coverBackgroundVar(template.coverGradientId));
        }

        if (existing.titleColor) setTitleColor(existing.titleColor);
        if (existing.subtitleColor) setSubtitleColor(existing.subtitleColor);
        if (typeof existing.sourceTemplateId === "string") {
          setSourceTemplateId(existing.sourceTemplateId);
        } else if (existing.sourceTemplateId === null) {
          setSourceTemplateId(null);
        }
      } else if (template) {
        setCustomBackground(coverBackgroundVar(template.coverGradientId));
      }
    } catch (error) {
      console.error("Failed to load draft configuration", error);
    } finally {
      setIsDraftHydrated(true);
    }
  }, [draftId, template]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setCoverImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearCoverImage = () => setCoverImage(null);

  const activeBackground = customBackground.trim() ? customBackground : background;

  const coverVariant: BookCoverVariant = coverImage ? "image" : "solid";

  const persistCurrentDraft = useCallback(
    (updatedAt: number) => {
      if (typeof window === "undefined") return;

      try {
        const draftsRaw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
        const drafts = draftsRaw
          ? (JSON.parse(draftsRaw) as Record<string, DraftPayload>)
          : {};
        drafts[draftId] = {
          id: draftId,
          title,
          subtitle: subtitle || undefined,
          coverImage: coverImage ?? null,
          background: activeBackground,
          variant: coverVariant,
          titleColor: titleColor || null,
          subtitleColor: subtitleColor || null,
          sourceTemplateId: sourceTemplateId ?? templateParam ?? (template ? template.id : "blank"),
          updatedAt,
        };
        syncDraftsAndRecents<DraftPayload>(drafts);
        console.debug("[BookBuilder] Persisted draft", {
          draftId,
          updatedAt,
          hasCover: Boolean(coverImage),
          background: activeBackground,
        });
      } catch (error) {
        console.error("Failed to persist draft", error);
      }
    },
    [
      activeBackground,
      coverImage,
      draftId,
      sourceTemplateId,
      subtitle,
      subtitleColor,
      template?.id,
      template?.variant,
      templateParam,
      title,
      titleColor,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !isDraftHydrated) return;
    const timeout = window.setTimeout(
      () => persistCurrentDraft(Date.now()),
      250
    );
    return () => window.clearTimeout(timeout);
  }, [isDraftHydrated, persistCurrentDraft]);

  // const handleNext = () => {
  //   if (!coverImage) {
  //     window.alert("Add a cover image before opening your notebook.");
  //     return;
  //   }
  //   const timestamp = Date.now();
  //   persistCurrentDraft(timestamp);

  //   const templateQuery =
  //     (sourceTemplateId ?? templateParam ?? (template ? template.id : "blank")) ||
  //     undefined;
  //   const queryString = templateQuery
  //     ? `?template=${encodeURIComponent(templateQuery)}`
  //     : "";

  //   router.push(`/dashboard/books/${draftId}/canvas${queryString}`);
  // };
  const handleNext = () => {
    const timestamp = Date.now();
    persistCurrentDraft(timestamp);
  
    const templateQuery =
      (sourceTemplateId ?? templateParam ?? (template ? template.id : "blank")) ||
      undefined;
    const queryString = templateQuery
      ? `?template=${encodeURIComponent(templateQuery)}`
      : "";
  
    router.push(`/dashboard/books/${draftId}/canvas${queryString}`);
  };
  
  return (
    <main className="min-h-screen w-full pb-24">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 pt-12 md:px-10 lg:pt-16">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="self-start text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft transition hover:text-ink"
        >
          ← Back to dashboard
        </button>

        <header className="flex flex-col gap-2 text-ink">
          <span className="text-xs uppercase tracking-[0.28em] text-ink-soft">
            Customize Cover
          </span>
          <h1 className="heading-font text-3xl font-semibold tracking-[0.02em] text-ink-strong md:text-4xl">
            {template ? template.title : "Blank Notebook"}
          </h1>
          <p className="body-font text-sm text-ink-muted md:max-w-2xl">
            Upload a cover photo, tweak the colors, and shape the title or description. Nothing is required—keep it minimal or go full aesthetic.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-3">
            <BookCover
              variant={coverVariant}
              title={title}
              subtitle={subtitle || undefined}
              coverImageUrl={coverImage}
              titleColor={titleColor || undefined}
              subtitleColor={subtitleColor || undefined}
              className="w-[9.375rem]"
              style={{ background: activeBackground }}
            />
            <div className="flex flex-wrap items-center justify-center gap-3 text-[0.68rem] uppercase tracking-[0.2em] text-ink-muted">
              <span>128×186px</span>
              <span aria-hidden>•</span>
              <span>Photo optional</span>
              <span aria-hidden>•</span>
              <span>Editable anytime</span>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <section className="rounded-2xl border border-border-subtle bg-surface-base/80 p-5 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Cover Photo
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex flex-1 min-w-[12.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-subtle bg-surface-raised px-4 py-4 text-xs uppercase tracking-[0.18em] text-ink transition hover:border-border-emphasis">
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  Upload image
                  <span className="text-[0.65rem] normal-case text-ink-muted">PNG or JPG • portrait looks best</span>
                </label>
              {coverImage ? (
                <button
                  type="button"
                  onClick={clearCoverImage}
                  className="rounded-full border border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft transition hover:border-border-emphasis hover:text-ink"
                >
                  Remove
                </button>
              ) : null}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <span className="text-[0.65rem] uppercase tracking-[0.18em] text-ink-soft">
                  Quick gallery
                </span>
                <div className="flex flex-wrap gap-3">
                  {galleryOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setCoverImage(option.preview)}
                      className="h-12 w-[5rem] rounded-xl border border-border-subtle transition hover:border-border-emphasis"
                      style={{ background: option.preview }}
                      aria-label={`Use ${option.label} cover`}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border-subtle bg-surface-base/80 p-5 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Background
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {backgroundOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBackground(option.value)}
                    className={clsx(
                      "h-10 w-[5rem] rounded-xl border transition",
                      background === option.value
                        ? "border-border-emphasis"
                        : "border-border-subtle hover:border-border-emphasis"
                    )}
                    style={{ background: option.value }}
                    aria-label={`Use ${option.label} background`}
                  />
                ))}
                <input
                  type="text"
                  value={customBackground}
                  onChange={(event) => setCustomBackground(event.target.value)}
                  placeholder="Custom CSS background"
                  className="w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-xs text-ink focus:border-border-emphasis focus:outline-none"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-border-subtle bg-surface-base/80 p-5 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Details
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[0.65rem] uppercase tracking-[0.18em] text-ink-soft">
                  Title
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-ink focus:border-border-emphasis focus:outline-none"
                    placeholder="Name this notebook"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[0.65rem] uppercase tracking-[0.18em] text-ink-soft">
                  Subtitle
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(event) => setSubtitle(event.target.value)}
                    className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-sm text-ink focus:border-border-emphasis focus:outline-none"
                    placeholder="Small description (optional)"
                  />
                </label>
                <div className="flex flex-col gap-4 pt-1">
                  <div className="flex flex-col gap-2">
                    <span className="text-[0.58rem] uppercase tracking-[0.18em] text-ink-soft">
                      Title color
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {titleColorOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setTitleColor(option.value)}
                          className={clsx(
                            "h-7 w-7 rounded-full border transition",
                            titleColor === option.value
                              ? "border-border-emphasis shadow-[0_0_0_2px_var(--color-border-emphasis)]"
                              : "border-border-subtle hover:border-border-emphasis"
                          )}
                          style={{ backgroundColor: option.value }}
                          aria-label={`Use ${option.label} for title`}
                        />
                      ))}
                      <label className="flex items-center gap-2 rounded-full border border-border-subtle px-3 py-1 text-[0.55rem] uppercase tracking-[0.16em] text-ink-soft transition hover:border-border-emphasis">
                        Custom
                        <input
                          type="color"
                          value={titleColor || "#3D3D3D"}
                          onChange={(event) => setTitleColor(event.target.value)}
                          className="h-5 w-5 cursor-pointer border-none bg-transparent p-0"
                          aria-label="Pick custom title color"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setTitleColor("")}
                        className="text-[0.55rem] uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink"
                      >
                        Default
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[0.58rem] uppercase tracking-[0.18em] text-ink-soft">
                      Description color
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {subtitleColorOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSubtitleColor(option.value)}
                          className={clsx(
                            "h-7 w-7 rounded-full border transition",
                            subtitleColor === option.value
                              ? "border-border-emphasis shadow-[0_0_0_2px_var(--color-border-emphasis)]"
                              : "border-border-subtle hover:border-border-emphasis"
                          )}
                          style={{ backgroundColor: option.value }}
                          aria-label={`Use ${option.label} for description`}
                        />
                      ))}
                      <label className="flex items-center gap-2 rounded-full border border-border-subtle px-3 py-1 text-[0.55rem] uppercase tracking-[0.16em] text-ink-soft transition hover:border-border-emphasis">
                        Custom
                        <input
                          type="color"
                          value={subtitleColor || "#6F6A80"}
                          onChange={(event) => setSubtitleColor(event.target.value)}
                          className="h-5 w-5 cursor-pointer border-none bg-transparent p-0"
                          aria-label="Pick custom description color"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setSubtitleColor("")}
                        className="text-[0.55rem] uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink"
                      >
                        Default
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleNext}
                className="rounded-full border border-border-emphasis bg-ink text-[var(--color-background)] px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition hover:opacity-90"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default BookBuilderPage;
