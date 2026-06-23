"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTemplateById } from "@/data/book-templates";
import { coverBackgroundVar } from "@/data/cover-gradients";
import CanvasBoard, {
  type CanvasBoardHandle,
  type CanvasSnapshot,
} from "@/components/canvas/canvas-board";
import {
  btnIcon,
  btnRadius,
  btnState,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import {
  claimCanvasSessionStamp,
  endCanvasSession,
} from "@/lib/canvas-session-stamp";
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
  subtitle: "Describe this notebook",
  background: coverBackgroundVar("g1"),
};

type Draft = RecentBook;

const readPersistedLastEditedAt = (bookId: string): number | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return undefined;
    const drafts = JSON.parse(raw) as Record<string, Draft>;
    const ts = drafts[bookId]?.lastEditedAt;
    return typeof ts === "number" && Number.isFinite(ts) ? ts : undefined;
  } catch {
    return undefined;
  }
};

const CanvasPage = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bookId = params?.id ?? "blank";
  const searchParams = useSearchParams();
  const prevBookIdRef = useRef<string | null>(null);
  if (prevBookIdRef.current !== null && prevBookIdRef.current !== bookId) {
    endCanvasSession(prevBookIdRef.current);
  }
  prevBookIdRef.current = bookId;
  const boardRef = useRef<CanvasBoardHandle>(null);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
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

  const baseDraft = useMemo((): Draft => {
    return {
      id: bookId,
      title: template?.title ?? blankDefaults.title,
      subtitle: template?.subtitle ?? blankDefaults.subtitle,
      coverImage: template?.coverImage ?? null,
      background: template
        ? coverBackgroundVar(template.coverGradientId)
        : blankDefaults.background,
      variant: template?.variant ?? blankDefaults.variant,
      titleColor: null,
      subtitleColor: null,
      sourceTemplateId:
        templateParam ?? (template ? template.id : blankDefaults.id),
      updatedAt: Date.now(),
    };
  }, [bookId, template, templateParam]);

  const [draft, setDraft] = useState<Draft>(baseDraft);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  /**
   * Resolved only on the client (useLayoutEffect). Avoids SSR/hydration
   * calling Date.now() and flashing wall-clock time before sessionStorage loads.
   */
  const [sessionEditedAt, setSessionEditedAt] = useState<number | null>(null);
  const draftRef = React.useRef<Draft>(baseDraft);
  const pendingSnapshotRef = React.useRef<CanvasSnapshot | null>(null);
  const isDraftHydratedRef = React.useRef(false);

  useLayoutEffect(() => {
    setSessionEditedAt(
      claimCanvasSessionStamp(bookId, readPersistedLastEditedAt(bookId))
    );
  }, [bookId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const draftsRaw = localStorage.getItem(DRAFTS_STORAGE_KEY);
      const drafts = draftsRaw
        ? (JSON.parse(draftsRaw) as Record<string, Draft>)
        : {};
      const existing = drafts[bookId];
      const now = Date.now();

      // Reaching the canvas page is the moment a book "becomes real" for the
      // dashboard's Recents list; flip the flag here so customization-only
      // drafts stay hidden until the user actually opens them.
      const nextDraft = {
        ...baseDraft,
        ...(existing ?? {}),
        canvasOpened: true,
        lastOpenedAt: now,
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
      setIsDraftHydrated(true);
    } catch (error) {
      console.error("Failed to load draft", error);
      setIsDraftHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  useEffect(() => {
    isDraftHydratedRef.current = isDraftHydrated;
  }, [isDraftHydrated]);

  useEffect(() => {
    if (!isDraftHydrated) return;

    const syncTitleFromDraft = () => {
      const stored = readDraftById(bookId);
      if (!stored || typeof stored.title !== "string") return;
      if (stored.title === draftRef.current.title) return;
      const next = { ...draftRef.current, title: stored.title };
      draftRef.current = next;
      setDraft(next);
    };

    window.addEventListener(RECENTS_UPDATED_EVENT, syncTitleFromDraft);
    return () =>
      window.removeEventListener(RECENTS_UPDATED_EVENT, syncTitleFromDraft);
  }, [bookId, isDraftHydrated]);

  const persistDraft = useCallback(
    (
      updates: Partial<Draft>,
      opts?: {
        /** When set, also bumps draft `updatedAt` (recents ordering). */
        updatedAt?: number;
        skipRender?: boolean;
      }
    ) => {
      const current = draftRef.current ?? baseDraft;
      const updatedAt =
        typeof opts?.updatedAt === "number"
          ? opts.updatedAt
          : current.updatedAt;
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
        background:
          (updates.background as string | undefined) ??
          current.background,
      };
      draftRef.current = nextDraft;
      if (!opts?.skipRender) {
        setDraft(nextDraft);
      }

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
          if (!opts?.skipRender) {
            setDraft(syncedDraft);
          }
          return syncedDraft;
        }
      } catch (error) {
        console.error("Failed to persist draft", error);
      }

      return nextDraft;
    },
    [baseDraft, bookId, template, templateParam]
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      persistDraft({ title });
    },
    [persistDraft]
  );

  const handleSnapshotChange = useCallback(
    (snapshot: CanvasSnapshot) => {
      if (!isDraftHydratedRef.current) {
        pendingSnapshotRef.current = snapshot;
        return;
      }
      pendingSnapshotRef.current = null;
      // Mirror saves must not advance header or recents timestamps mid-session.
      persistDraft({}, { skipRender: true });
    },
    [persistDraft]
  );

  // Milestone save handler — fires 7s after typing stops.
  const handleMilestoneSave = useCallback(
    (_snapshot: CanvasSnapshot) => {
      persistDraft({}, { skipRender: true });
    },
    [persistDraft]
  );

  useEffect(() => {
    if (!isDraftHydrated || !pendingSnapshotRef.current) return;
    const snapshot = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    persistDraft({}, { skipRender: true });
  }, [isDraftHydrated, persistDraft]);

  const boardStorageKey = useMemo(() => `keeps-board-${bookId}`, [bookId]);

  const persistBoardSnapshot = useCallback(
    (snapshot: CanvasSnapshot) => {
      if (typeof window === "undefined") return;
      const closedAt = snapshot.updatedAt;
      try {
        window.localStorage.setItem(
          boardStorageKey,
          JSON.stringify(snapshot)
        );
      } catch (error) {
        console.error("Failed to persist board snapshot", error);
      }
      persistDraft(
        { lastEditedAt: closedAt },
        { updatedAt: closedAt, skipRender: true }
      );
    },
    [boardStorageKey, persistDraft]
  );

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const handleBack = useCallback(() => {
    if (isNavigatingBack) return;
    setIsNavigatingBack(true);
    const snapshot = boardRef.current?.captureForClose() ?? null;
    if (snapshot) {
      persistBoardSnapshot(snapshot);
    }
    endCanvasSession(bookId);
    router.replace("/dashboard");
  }, [bookId, isNavigatingBack, persistBoardSnapshot, router]);

  const goToCoverEditor = useCallback(() => {
    // Open the cover editor while keeping this draft's "canvas opened" flag.
    // Passing `from=canvas` makes the editor's Back button return here.
    const template = templateParam ?? "blank";
    const snapshot = boardRef.current?.captureForClose() ?? null;
    if (snapshot) {
      persistBoardSnapshot(snapshot);
    }
    router.push(
      `/dashboard/books/${bookId}?from=canvas&template=${encodeURIComponent(
        template,
      )}`,
    );
  }, [bookId, router, templateParam, persistBoardSnapshot]);

  return (
    <main className="relative h-svh min-h-0 w-full overflow-hidden">
      <button
        type="button"
        onClick={handleBack}
        disabled={isNavigatingBack}
        className={`fixed left-4 top-4 z-50 ${btnRadius.pill} ${btnIcon("md")} ${btnState.default} ${btnState.hover} ${btnState.active} ${btnState.disabled}`}
        aria-label="Back to books"
        title="Back to books"
      >
        <ArrowLeft
          strokeWidth={iconStroke("md")}
          size={iconPx("md")}
          aria-hidden
          className={iconFixed}
        />
      </button>

      {sessionEditedAt !== null && (
        <CanvasBoard
          ref={boardRef}
          bookId={bookId}
          storageKey={boardStorageKey}
          onSnapshotChange={handleSnapshotChange}
          onSave={handleMilestoneSave}
          initialSnapshot={templateSnapshot}
          title={draft.title}
          onTitleChange={handleTitleChange}
          sessionEditedAt={sessionEditedAt}
          lastEditedAt={draft.lastEditedAt}
        />
      )}
    </main>
  );
};

export default CanvasPage;
