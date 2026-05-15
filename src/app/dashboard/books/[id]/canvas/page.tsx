"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getTemplateById } from "@/data/book-templates";
import { coverBackgroundVar } from "@/data/cover-gradients";
import CanvasBoard, {
  type CanvasSnapshot,
} from "@/components/canvas/canvas-board";
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
  // The "Last opened" line in the canvas header should reflect the *previous*
  // open — not the open that's happening right now. We capture it on mount,
  // then write a fresh `lastOpenedAt` back to the draft for next time.
  const [previousOpenedAt, setPreviousOpenedAt] = useState<number | null>(null);
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
      // Capture the previous open time *before* we overwrite it, so the
      // header can render "Last opened 2d ago" instead of "just now".
      setPreviousOpenedAt(
        typeof existing?.lastOpenedAt === "number"
          ? existing.lastOpenedAt
          : null
      );
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
        background:
          (updates.background as string | undefined) ??
          current.background,
      };
      draftRef.current = nextDraft;
      setDraft(nextDraft);

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

  return (
    <main className="relative h-svh min-h-0 w-full overflow-hidden">
      <CanvasBoard
        storageKey={boardStorageKey}
        onSnapshotChange={handleSnapshotChange}
        onSave={handleMilestoneSave}
        initialSnapshot={templateSnapshot}
        title={draft.title}
        previousOpenedAt={previousOpenedAt}
      />
    </main>
  );
};

export default CanvasPage;
