"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getTemplateById } from "@/data/book-templates";
import CanvasBoard, {
  type CanvasSnapshot,
} from "@/components/canvas/canvas-board";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  Edit,
  FilePenLine,
  Sparkle,
} from "lucide-react";
import { BookCover } from "@/components/book-cover";
import dynamic from "next/dynamic";
const Popup = dynamic(() => import("reactjs-popup"), { ssr: false });
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
  background: "linear-gradient(135deg, #f8f7ff 0%, #ebe9ff 100%)",
};

type Draft = RecentBook;

const deriveBackgroundStyle = (
  background: CanvasSnapshot["background"],
  fallback: string
) => {
  if (background.image) {
    const trimmed = background.image.trim();
    if (trimmed.length > 0) {
      const lower = trimmed.toLowerCase();
      if (
        lower.startsWith("url(") ||
        lower.includes("gradient(") ||
        lower.includes("gradient ")
      ) {
        return trimmed;
      }
      return `url(${trimmed})`;
    }
  }
  if (background.pattern) return background.pattern;
  if (background.texture) return background.texture;
  if (background.color) return background.color;
  return fallback;
};
const CanvasPage = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bookId = params?.id ?? "blank";
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template");

  const template = useMemo(() => {
    if (!templateParam || templateParam === "blank") return null;
    return getTemplateById(templateParam);
  }, [templateParam]);

  const templateSnapshot = useMemo<CanvasSnapshot | null>(() => {
    if (!template) return null;
    const snapshot = JSON.parse(
      JSON.stringify(template.canvas)
    ) as CanvasSnapshot;
    snapshot.updatedAt = Date.now();
    return snapshot;
  }, [template]);

  const templateBackgroundStyle = useMemo(
    () =>
      templateSnapshot
        ? deriveBackgroundStyle(
            templateSnapshot.background,
            blankDefaults.background
          )
        : blankDefaults.background,
    [templateSnapshot]
  );

  const baseDraft = useMemo((): Draft => {
    return {
      id: bookId,
      title: template?.title ?? blankDefaults.title,
      subtitle: template?.subtitle ?? blankDefaults.subtitle,
      coverImage: template?.coverImage ?? null,
      background: templateBackgroundStyle as string,
      variant: template?.variant ?? blankDefaults.variant,
      titleColor: template?.titleColor ?? null,
      subtitleColor: template?.subtitleColor ?? null,
      sourceTemplateId:
        templateParam ?? (template ? template.id : blankDefaults.id),
      updatedAt: Date.now(),
    };
  }, [
    bookId,
    template,
    templateBackgroundStyle,
    templateParam,
  ]);

  const [draft, setDraft] = useState<Draft>(baseDraft);
  const [lastSaved, setLastSaved] = useState<number>(baseDraft.updatedAt);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [, forceRefresh] = useState(0);
  const draftRef = React.useRef<Draft>(baseDraft);
  const pendingSnapshotRef = React.useRef<CanvasSnapshot | null>(null);
  const isDraftHydratedRef = React.useRef(false);
  const editCover = useCallback(() => {
    const templateKey =
      draftRef.current?.sourceTemplateId ?? templateParam ?? "blank";
    router.push(`/dashboard/books/${bookId}?template=${templateKey}`);
  }, [bookId, router, templateParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const draftsRaw = localStorage.getItem(DRAFTS_STORAGE_KEY);
      const drafts = draftsRaw
        ? (JSON.parse(draftsRaw) as Record<string, Draft>)
        : {};
      const existing = drafts[bookId];
      const now = Date.now();
      const nextDraft = {
        ...baseDraft,
        ...(existing ?? {}),
        updatedAt: now,
      };
      const updatedDrafts: Record<string, Draft> = {
        ...drafts,
        [bookId]: nextDraft,
      };
      const { drafts: limitedDrafts } =
        syncDraftsAndRecents<Draft>(updatedDrafts);
      const persistedDraft = limitedDrafts[bookId] ?? nextDraft;
      draftRef.current = persistedDraft;
      setDraft(persistedDraft);
      setLastSaved(persistedDraft.updatedAt);
      setIsDraftHydrated(true);
    } catch (error) {
      console.error("Failed to load draft", error);
      setIsDraftHydrated(true);
    }
  }, [baseDraft, bookId]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    isDraftHydratedRef.current = isDraftHydrated;
  }, [isDraftHydrated]);

  const persistDraft = useCallback(
    (updates: Partial<Draft>, updatedAtOverride?: number) => {
      const updatedAt = updatedAtOverride ?? Date.now();
      const current = draftRef.current ?? baseDraft;
      const resolvedTemplateId =
        updates.sourceTemplateId ??
        current.sourceTemplateId ??
        templateParam ??
        (template ? template.id : blankDefaults.id);
      const nextDraft: Draft = {
        ...current,
        ...updates,
        id: bookId,
        sourceTemplateId: resolvedTemplateId,
        updatedAt,
        background: updates.background as string ?? current.background,
      };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setLastSaved(updatedAt);
      console.debug("[CanvasPage] Persisting draft", {
        bookId,
        updatedAt,
        updates,
        sourceTemplateId: resolvedTemplateId,
      });

      if (typeof window === "undefined") {
        return nextDraft;
      }

      try {
        const draftsRaw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
        const drafts = draftsRaw
          ? (JSON.parse(draftsRaw) as Record<string, Draft>)
          : {};
        drafts[bookId] = nextDraft;
        const { drafts: syncedDrafts } =
          syncDraftsAndRecents<Draft>(drafts);
        const syncedDraft = syncedDrafts[bookId];
        if (syncedDraft) {
          draftRef.current = syncedDraft;
          setDraft(syncedDraft);
          setLastSaved(syncedDraft.updatedAt);
          console.debug("[CanvasPage] Draft persisted via sync", {
            bookId,
            updatedAt: syncedDraft.updatedAt,
          });
          return syncedDraft;
        }
      } catch (error) {
        console.error("Failed to persist draft", error);
      }

      return nextDraft;
    },
    [baseDraft, bookId, template, templateParam]
  );

  const applySnapshotToDraft = useCallback(
    (snapshot: CanvasSnapshot) => {
      const fallbackBackground =
        draftRef.current?.background ?? baseDraft.background;
      const backgroundStyle = deriveBackgroundStyle(
        snapshot.background,
        fallbackBackground
      );
      console.debug("[CanvasPage] Applying canvas snapshot to draft", {
        bookId,
        updatedAt: snapshot.updatedAt,
        snapshotBackground: snapshot.background,
        derivedBackground: backgroundStyle,
      });
      persistDraft({ background: backgroundStyle as string }, snapshot.updatedAt);
    },
    [baseDraft.background, persistDraft]
  );

  const handleSnapshotChange = useCallback(
    (snapshot: CanvasSnapshot) => {
      if (!isDraftHydratedRef.current) {
        pendingSnapshotRef.current = snapshot;
        console.debug("[CanvasPage] Snapshot queued until hydration", {
          bookId,
          updatedAt: snapshot.updatedAt,
        });
        return;
      }
      pendingSnapshotRef.current = null;
      applySnapshotToDraft(snapshot);
    },
    [applySnapshotToDraft]
  );

  useEffect(() => {
    if (!isDraftHydrated || !pendingSnapshotRef.current) return;
    const snapshot = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    console.debug("[CanvasPage] Flushing queued snapshot after hydration", {
      bookId,
      updatedAt: snapshot.updatedAt,
    });
    applySnapshotToDraft(snapshot);
  }, [applySnapshotToDraft, isDraftHydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !isDraftHydrated) return;
    const interval = window.setInterval(
      () => forceRefresh((tick) => tick + 1),
      60_000
    );
    return () => window.clearInterval(interval);
  }, [forceRefresh, isDraftHydrated]);

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) {
      const mins = Math.round(diff / 60_000);
      return `${mins} min${mins === 1 ? "" : "s"} ago`;
    }
    const hours = Math.round(diff / 3_600_000);
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  };

  const boardStorageKey = useMemo(() => `keeps-board-${bookId}`, [bookId]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[var(--color-background)] transition-colors duration-300">
      <CanvasBoard
        storageKey={boardStorageKey}
        initialBackground={draft.background}
        onSnapshotChange={handleSnapshotChange}
        initialSnapshot={templateSnapshot}
      />

      <div className="pointer-events-none absolute left-4 top-4 z-40 flex items-center gap-3 bg-[var(--color-iconbutton)] text-[var(--color-icon)] p-1 rounded-lg">
        <div className="flex flex-row gap-2 relative items-center">
          {/* <Popup
            trigger={
              <button
                type="button"
                className="pointer-events-auto flex items-center gap-0.5 text-sm text-ink-soft transition hover:text-ink focus:text-primary focus:bg-surface-base p-2 rounded-md"
              >
                <Sparkle strokeWidth={1.5} size={20} />
                <ChevronDown strokeWidth={1} size={16} />
              </button>
            }
            position="bottom center"
            closeOnDocumentClick
            arrow={false}
            contentStyle={{
              padding: 0,
              border: "none",
              borderRadius: "0.75rem",
              boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.10)",
              background: "white",
              minWidth: "14rem",
              zIndex: 50,
            }}
            overlayStyle={{ background: "none" }}
          >
            {((close: () => void) => (
              <div className="pointer-events-auto w-56 rounded-xl bg-white shadow-xl ring-1 ring-black/5 backdrop-blur-md p-2">
                <button
                  type="button"
                  onClick={() => {
                    router.push("/dashboard");
                    close();
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 !text-sm text-ink-soft transition hover:bg-primary hover:text-white"
                >
                  <ChevronLeft strokeWidth={1.5} size={18} />
                  Back to Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    console.log("Edit cover page clicked");
                    close();
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 !text-sm text-ink-soft transition hover:bg-primary hover:text-white"
                >
                  <FilePenLine strokeWidth={1.5} size={16} />
                  Edit Cover Page
                </button>
              </div>
            )) as unknown as React.ReactNode}
          </Popup> */}

          <Popup
            trigger={(open: boolean) => (
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                className={`pointer-events-auto flex items-center gap-0.5 p-[0.75rem] text-sm transition rounded-md bg-[var(--color-iconbutton)] text-[var(--color-icon)] border border-[var(--color-iconborder-border)] hover:bg-[var(--color-iconbutton-hover)] ${
                  open ? "bg-surface-base text-ink" : "text-ink-soft"
                }`}
              >
                <Sparkle
                  size={18}
                  className={`${
                    open ? "opacity-100" : "opacity-90"
                  } transition-opacity`}
                />
                {/* <ChevronDown
                  size={18}
                  className={`${
                    open ? "rotate-180" : ""
                  } transition-transform duration-200`}
                /> */}
              </button>
            )}
            position="bottom left"
            offsetY={5}
            closeOnDocumentClick
            arrow={false}
            contentStyle={{
              padding: 0,
              border: "var(--popup-border)",
              borderRadius: "0.75rem",
              boxShadow: "var(--popup-shadow)",
              background: "var(--popup-bg)",
              // minWidth: "14rem",
              zIndex: 50,
            }}
            overlayStyle={{ background: "none" }}
          >
            {
              ((close: () => void) => (
                <div className="pointer-events-auto w-56 rounded-xl bg-surface-base shadow-xl ring-1 ring-border-subtle backdrop-blur-md p-2">
                  <button
                    type="button"
                    onClick={() => {
                      router.push("/dashboard");
                      close();
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink-soft transition hover:bg-primary hover:text-[var(--color-background)]"
                  >
                    <ChevronLeft strokeWidth={1.5} size={18} />
                    Back to Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editCover();
                      close();
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink-soft transition hover:bg-primary hover:text-[var(--color-background)]"
                  >
                    <FilePenLine strokeWidth={1.5} size={16} />
                    Edit Cover Page
                  </button>
                </div>
              )) as unknown as React.ReactNode
            }
          </Popup>

          {/* <span className="h-4 w-px bg-border-subtle" aria-hidden /> */}

          {/* <h1 className="heading-font text-md font-semibold tracking-[0.02em] text-ink-strong md:text-md">
            {draft.title || "Untitled Book"}
          </h1> */}
          {/* <span className="text-[0.68rem] text-ink-soft">
          Saved {formatRelativeTime(lastSaved)}
        </span> */}
        </div>
      </div>
    </main>
  );
};

export default CanvasPage;
