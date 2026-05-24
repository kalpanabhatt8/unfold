"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const CanvasPage = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bookId = params?.id ?? "blank";
  const searchParams = useSearchParams();
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
  const draftRef = React.useRef<Draft>(baseDraft);
  const pendingSnapshotRef = React.useRef<CanvasSnapshot | null>(null);
  const isDraftHydratedRef = React.useRef(false);

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
      setIsDraftHydrated(true);
    } catch (error) {
      console.error("Failed to load draft", error);
      setIsDraftHydrated(true);
    }
  }, [baseDraft, bookId]);

  useEffect(() => {
    isDraftHydratedRef.current = isDraftHydrated;
  }, [isDraftHydrated]);

  const persistDraft = useCallback(
    (
      updates: Partial<Draft>,
      updatedAtOverride?: number,
      opts?: { skipRender?: boolean }
    ) => {
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

  const handleSnapshotChange = useCallback(
    (snapshot: CanvasSnapshot) => {
      if (!isDraftHydratedRef.current) {
        pendingSnapshotRef.current = snapshot;
        return;
      }
      pendingSnapshotRef.current = null;
      persistDraft({}, snapshot.updatedAt);
    },
    [persistDraft]
  );

  // Milestone save handler — fires on the 30s autosave tick and on manual
  // save. This is the seam for AI title generation: read the latest snapshot,
  // ship the writing-column text to the title model, and persist the result
  // back to the draft. AI plumbing is not wired yet; once it lands, call it
  // from here and merge the returned title via `persistDraft({ title })`.
  const handleMilestoneSave = useCallback(
    (snapshot: CanvasSnapshot) => {
      persistDraft({}, snapshot.updatedAt);
      // TODO(ai-title): trigger AI title generation from `snapshot.textColumns`
      // and call persistDraft({ title }) when it resolves. Keep this silent —
      // the product spec calls for "no confirmation dialogs — silent save".
    },
    [persistDraft]
  );

  useEffect(() => {
    if (!isDraftHydrated || !pendingSnapshotRef.current) return;
    const snapshot = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    persistDraft({}, snapshot.updatedAt);
  }, [isDraftHydrated, persistDraft]);

  const boardStorageKey = useMemo(() => `keeps-board-${bookId}`, [bookId]);

  const persistBoardSnapshot = useCallback(
    (snapshot: CanvasSnapshot) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          boardStorageKey,
          JSON.stringify(snapshot)
        );
      } catch (error) {
        console.error("Failed to persist board snapshot", error);
      }
      persistDraft({}, snapshot.updatedAt, { skipRender: true });
    },
    [boardStorageKey, persistDraft]
  );

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  const handleBack = useCallback(() => {
    if (isNavigatingBack) return;
    setIsNavigatingBack(true);
    const snapshot = boardRef.current?.captureForClose() ?? null;
    router.replace("/dashboard");
    if (!snapshot) return;
    // Defer the heavy stringify + localStorage work so navigation isn't blocked
    // by large canvas text.
    window.requestAnimationFrame(() => {
      persistBoardSnapshot(snapshot);
    });
  }, [isNavigatingBack, persistBoardSnapshot, router]);

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

      <CanvasBoard
        ref={boardRef}
        storageKey={boardStorageKey}
        onSnapshotChange={handleSnapshotChange}
        onSave={handleMilestoneSave}
        initialSnapshot={templateSnapshot}
        title={draft.title}
      />
    </main>
  );
};

export default CanvasPage;
