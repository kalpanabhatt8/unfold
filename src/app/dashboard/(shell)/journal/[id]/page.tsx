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
import CanvasBoard, {
  type CanvasBoardHandle,
  type CanvasSnapshot,
} from "@/components/canvas/canvas-board";
import {
  claimCanvasSessionStamp,
  endCanvasSession,
} from "@/lib/canvas-session-stamp";
import {
  ENTRIES_UPDATED_EVENT,
  readEntryById,
  upsertEntry,
  type JournalEntry,
} from "@/lib/journal-entries";
import { notifyEntryCompleted } from "@/lib/patterns/entry-completion";
import { takeJournalQuoteFocus } from "@/lib/journal-quote-focus";

/** Flatten a snapshot's written blocks + captions into one lowercase-searchable string. */
const flattenSnapshotText = (snapshot: CanvasSnapshot): string => {
  const blockText = snapshot.textColumns
    .flat()
    .map((block) => block.text)
    .filter(Boolean)
    .join(" ");
  const captions = snapshot.imageBlocks
    .map((image) => image.caption)
    .filter((caption): caption is string => Boolean(caption))
    .join(" ");
  return [blockText, captions].filter(Boolean).join(" ").trim();
};

const JournalEntryPage = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const entryId = params?.id ?? "untitled";
  const searchParams = useSearchParams();
  const shouldAutoFocus = searchParams.get("new") === "1";

  const prevEntryIdRef = useRef<string | null>(null);
  if (prevEntryIdRef.current !== null && prevEntryIdRef.current !== entryId) {
    endCanvasSession(prevEntryIdRef.current);
  }
  prevEntryIdRef.current = entryId;

  const boardRef = useRef<CanvasBoardHandle>(null);

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  // Start null on server + first client render so hydration matches; claim the
  // stamp in useLayoutEffect (before paint) so CanvasBoard mounts without a flash.
  const [sessionEditedAt, setSessionEditedAt] = useState<number | null>(null);
  const entryRef = useRef<JournalEntry | null>(null);
  const isHydratedRef = useRef(false);
  const completionFiredRef = useRef(false);

  // Generic "entry completion" trigger. V1 source = seal: fire once when the
  // snapshot transitions to sealed. The analysis pipeline is agnostic to this.
  const maybeNotifyCompletion = useCallback(
    (sealedAt: number | null | undefined) => {
      if (completionFiredRef.current) return;
      if (typeof sealedAt !== "number") return;
      completionFiredRef.current = true;
      void notifyEntryCompleted(entryId, "seal");
    },
    [entryId],
  );

  useLayoutEffect(() => {
    const existing = readEntryById(entryId);
    setSessionEditedAt(
      claimCanvasSessionStamp(entryId, existing?.lastEditedAt),
    );
  }, [entryId]);

  // Hydrate (or create) this entry's metadata on open.
  // Existing entries: read-only — avoid rewriting drafts + marking dirty.
  useEffect(() => {
    const existing = readEntryById(entryId);
    if (existing) {
      entryRef.current = existing;
      setEntry(existing);
      setIsHydrated(true);
      // Already-sealed entries were completed in a prior session (the reconciler
      // covers any missing analysis) — only a fresh seal this session counts.
      completionFiredRef.current = typeof existing.sealedAt === "number";
      return;
    }
    const hydrated = upsertEntry(entryId, { title: "" });
    entryRef.current = hydrated;
    setEntry(hydrated);
    setIsHydrated(true);
    completionFiredRef.current = false;
  }, [entryId]);

  useEffect(() => {
    isHydratedRef.current = isHydrated;
  }, [isHydrated]);

  // Pick up title/seal edits made elsewhere (e.g. another tab), and stop
  // saving if this entry was deleted while the page was still mounted.
  useEffect(() => {
    if (!isHydrated) return;

    const syncFromStorage = () => {
      const stored = readEntryById(entryId);
      if (!stored) {
        isHydratedRef.current = false;
        setIsHydrated(false);
        entryRef.current = null;
        setEntry(null);
        return;
      }
      if (
        stored.title === entryRef.current?.title &&
        stored.sealedAt === entryRef.current?.sealedAt
      ) {
        return;
      }
      entryRef.current = stored;
      setEntry(stored);
    };

    window.addEventListener(ENTRIES_UPDATED_EVENT, syncFromStorage);
    return () =>
      window.removeEventListener(ENTRIES_UPDATED_EVENT, syncFromStorage);
  }, [entryId, isHydrated]);

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!readEntryById(entryId)) return;
      const next = upsertEntry(entryId, { title });
      entryRef.current = next;
      setEntry(next);
    },
    [entryId],
  );

  // High-frequency mirror save — cache searchable text + sealed state without
  // bumping `updatedAt` in a way that would reorder the sidebar mid-keystroke.
  const handleSnapshotChange = useCallback(
    (snapshot: CanvasSnapshot) => {
      if (!isHydratedRef.current) return;
      if (!readEntryById(entryId)) return;
      const next = upsertEntry(entryId, {
        searchText: flattenSnapshotText(snapshot),
        sealedAt: snapshot.sealedAt ?? null,
        updatedAt: entryRef.current?.updatedAt,
      });
      entryRef.current = next;
      maybeNotifyCompletion(snapshot.sealedAt);
    },
    [entryId, maybeNotifyCompletion],
  );

  // Milestone save — fires ~7s after typing stops; this is the point we treat
  // the entry as "last edited" for the header stamp.
  const handleMilestoneSave = useCallback(
    (snapshot: CanvasSnapshot) => {
      if (!readEntryById(entryId)) return;
      const next = upsertEntry(entryId, {
        searchText: flattenSnapshotText(snapshot),
        sealedAt: snapshot.sealedAt ?? null,
        lastEditedAt: snapshot.updatedAt,
      });
      entryRef.current = next;
      setEntry(next);
      maybeNotifyCompletion(snapshot.sealedAt);
    },
    [entryId, maybeNotifyCompletion],
  );

  const boardStorageKey = useMemo(
    () => `keeps-board-${entryId}`,
    [entryId],
  );

  // "+" in the sidebar opens a brand-new entry with `?new=1` — focus the
  // editor once the canvas has actually mounted, then drop the query flag.
  useEffect(() => {
    if (!shouldAutoFocus || sessionEditedAt === null) return;
    const frame = requestAnimationFrame(() => {
      boardRef.current?.focus("end");
    });
    router.replace(`/dashboard/journal/${entryId}`);
    return () => cancelAnimationFrame(frame);
  }, [shouldAutoFocus, sessionEditedAt, entryId, router]);

  // Patterns → Journal: highlight the quoted passage after the board mounts.
  useEffect(() => {
    if (sessionEditedAt === null) return;
    const quote = takeJournalQuoteFocus(entryId);
    if (!quote) return;

    let cancelled = false;
    const started = Date.now();
    let timer = 0;

    const tryHighlight = () => {
      if (cancelled) return;
      const result = boardRef.current?.highlightQuote(quote);
      if (result === "done" || result === "miss") return;
      if (Date.now() - started > 2_500) return;
      timer = window.setTimeout(tryHighlight, 32);
    };

    timer = window.setTimeout(tryHighlight, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [entryId, sessionEditedAt]);

  return (
    <main className="relative h-full min-h-0 w-full overflow-hidden">
      {sessionEditedAt !== null && (
        <CanvasBoard
          key={entryId}
          ref={boardRef}
          storageKey={boardStorageKey}
          onSnapshotChange={handleSnapshotChange}
          onSave={handleMilestoneSave}
          title={entry?.title ?? ""}
          onTitleChange={handleTitleChange}
          sessionEditedAt={sessionEditedAt}
          lastEditedAt={entry?.lastEditedAt}
        />
      )}
    </main>
  );
};

export default JournalEntryPage;
