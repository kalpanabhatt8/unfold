"use client";

/**
 * CanvasBoard — full-width journal writing surface.
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  title (left)                last edited · saving? (right)    │
 *  │  ─────────────────────────────────────────────────────────── │
 *  │  centered writing column                                     │
 *  │  seal stamp (fixed corner)                                   │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * Save model:
 *   - Snapshot is mirrored to localStorage shortly after each change so the
 *     user never loses keystrokes if the tab dies.
 *   - After 7s of typing inactivity, `onSave` fires with the latest snapshot.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { List, ListChecks, Pilcrow } from "lucide-react";
import { JournalStamp, type JournalStampHandle } from "@/components/canvas/journal-stamp";
import {
  JournalTiptapEditor,
  type JournalTiptapEditorHandle,
} from "@/components/canvas/journal-tiptap-editor";
import { iconStrokePx } from "@/components/ui/button-system";
import { hasBookTitle, BOOK_TITLE_PLACEHOLDER, clampBookTitle, commitBookTitle } from "@/lib/book-title";
import {
  JOURNAL_SEAL_ANIM_MS,
  JOURNAL_SEAL_AURORA_MS,
  JOURNAL_SEAL_AURORA_START_MS,
} from "@/lib/journal-seal-animation";
import { useViewportLayout } from "@/hooks/use-viewport-layout";
import {
  collectJournalWordTokens,
  extractJournalPlainText,
  snapshotHasContent,
} from "@/lib/canvas-word-count";
import {
  createWritingSlots,
  emptyParagraph,
  newBlockId as newId,
} from "@/lib/journal-blocks";

import {
  MIN_WORDS_FOR_AI_TITLE,
  prefetchSealTitle,
  warmJournalTitleRoute,
} from "@/lib/journal-title";
import {
  commitEntrySeal,
  entryIdFromBoardStorageKey,
} from "@/lib/journal-seal";
import { readEntryById } from "@/lib/journal-entries";
import {
  CONTENT_COLUMN_MAX_WIDTH,
  PAGE_PADDING_X_CLASS,
} from "@/lib/layout";
import { useSaveStatus } from "@/hooks/use-save-status";
import { FLUSH_LOCAL_WRITES_EVENT } from "@/lib/sync/local-flags";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export const CANVAS_SNAPSHOT_VERSION = 4 as const;

export type TextBlockKind = "paragraph" | "bullet" | "checklist";

export type JournalTextBlock = {
  id: string;
  blockKind: TextBlockKind;
  text: string;
  /** Only meaningful when blockKind === "checklist". */
  checked?: boolean;
};

export type CanvasSnapshot = {
  version: typeof CANVAS_SNAPSHOT_VERSION;
  /** Single writing column (outer array kept for legacy snapshot shape). */
  textColumns: JournalTextBlock[][];
  background: string;
  /** Unix ms when the entry was sealed (irreversible). Absent = draft. */
  sealedAt?: number;
  updatedAt: number;
};

/* -------------------------------------------------------------------------- */
/*  Visual constants                                                          */
/* -------------------------------------------------------------------------- */

/** Page + canvas — tokens in `global.css`. */
export const CANVAS_BACKGROUND = "var(--canvas-bg-gradient)";

/** Centered writing column width — shared with Patterns (`layout.ts`). */
const WRITING_COLUMN_MAX_WIDTH = CONTENT_COLUMN_MAX_WIDTH;

/** Writing ink — shared by the editor surface. */
const WRITING_INK = "var(--canvas-ink)";

/** Save behaviour. Local mirror is fast (no data loss); milestone save fires
 *  after 7s of typing inactivity. */
const LOCAL_MIRROR_DEBOUNCE_MS = 600;
/** Milestone save (persists `lastEditedAt`) fires after this typing pause. */
const MILESTONE_SAVE_INACTIVITY_MS = 7_000;
/** Patterns → Journal quote tint: visible hold, then CSS fade, then clear. */
const QUOTE_HIGHLIGHT_HOLD_MS = 18_000;
/** Slow ease-out of tint + ink back to sealed. */
const QUOTE_HIGHLIGHT_FADE_MS = 5_000;
const QUOTE_HIGHLIGHT_TOTAL_MS =
  QUOTE_HIGHLIGHT_HOLD_MS + QUOTE_HIGHLIGHT_FADE_MS;

/** Stable compare for "did the user change the writing?" — ignores block ids. */
const fingerprintBlocks = (blocks: JournalTextBlock[]): string =>
  JSON.stringify(
    blocks.map((b) => ({
      k: b.blockKind,
      t: b.text,
      c: b.checked ?? false,
    })),
  );

/** Minimum selected-character count before the text format bar appears. */
const TEXT_CTX_SELECTION_MIN = 4;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const arrayOrEmpty = <T,>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : [];

/** Collapse legacy multi-column snapshots into one writing track. */
const flattenToSingleColumn = (
  cols: JournalTextBlock[][],
): JournalTextBlock[][] => {
  const merged = cols.flat();
  return [merged.length > 0 ? merged : createWritingSlots()];
};

/* -------------------------------------------------------------------------- */
/*  Snapshot helpers                                                          */
/* -------------------------------------------------------------------------- */

export const emptySnapshot = (): CanvasSnapshot => ({
  version: CANVAS_SNAPSHOT_VERSION,
  textColumns: [createWritingSlots()],
  background: CANVAS_BACKGROUND,
  updatedAt: Date.now(),
});

const snapshotHasBodyText = (snap: CanvasSnapshot): boolean =>
  snapshotHasContent(snap);

/** Rebuild minimal paragraph blocks when a sealed board was lost but searchText remains. */
const blocksFromSearchText = (searchText: string): JournalTextBlock[] => {
  const paragraphs = searchText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    const trimmed = searchText.trim();
    if (!trimmed) return createWritingSlots();
    return [{ id: newId(), blockKind: "paragraph", text: trimmed }];
  }
  return paragraphs.map((text) => ({
    id: newId(),
    blockKind: "paragraph" as const,
    text,
  }));
};

const sanitizeTextBlock = (raw: unknown): JournalTextBlock | null => {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : newId();
  const blockKindRaw = raw.blockKind;
  const blockKind: TextBlockKind =
    blockKindRaw === "bullet" || blockKindRaw === "checklist"
      ? blockKindRaw
      : "paragraph";
  return {
    id,
    blockKind,
    text: typeof raw.text === "string" ? raw.text : "",
    checked: blockKind === "checklist" ? Boolean(raw.checked) : undefined,
  };
};

/**
 * Best-effort migration from any prior snapshot version (v1 positional,
 * v2 positional + multi-line lists, v3 sequential mixed blocks) into v4.
 * Image / multi-column data is dropped — journal is text-only.
 */
function migrateLegacy(raw: Record<string, unknown>): CanvasSnapshot {
  const flatText: JournalTextBlock[] = [];

  const v3Blocks = arrayOrEmpty<Record<string, unknown>>(raw.blocks);
  if (v3Blocks.length > 0) {
    for (const b of v3Blocks) {
      if (b.kind === "image") continue;
      const text = sanitizeTextBlock(b);
      if (text) flatText.push(text);
    }
  } else {
    const textRaw = arrayOrEmpty<Record<string, unknown>>(raw.textElements);
    const sortedText = [...textRaw].sort((a, b) => {
      const az = typeof a.z === "number" ? a.z : 0;
      const bz = typeof b.z === "number" ? b.z : 0;
      return az - bz;
    });
    for (const t of sortedText) {
      const kindRaw = t.blockKind;
      const blockKind: TextBlockKind =
        kindRaw === "bullet" || kindRaw === "checklist" ? kindRaw : "paragraph";
      const text = typeof t.text === "string" ? t.text : "";
      if (blockKind === "paragraph") {
        flatText.push({
          id: typeof t.id === "string" ? t.id : newId(),
          blockKind: "paragraph",
          text,
        });
      } else {
        const lines = text.length > 0 ? text.split("\n") : [""];
        for (const line of lines) {
          if (blockKind === "checklist") {
            const m = line.match(/^\[\s*([ xX]?)\]\s*(.*)$/);
            const checked = m ? /^[xX]$/.test((m[1] ?? "").trim()) : false;
            const inner = m ? m[2] : line;
            flatText.push({
              id: newId(),
              blockKind: "checklist",
              text: inner,
              checked,
            });
          } else {
            flatText.push({
              id: newId(),
              blockKind: "bullet",
              text: line.replace(/^•\s*/, ""),
            });
          }
        }
      }
    }
  }

  return {
    version: CANVAS_SNAPSHOT_VERSION,
    textColumns: [flatText.length > 0 ? flatText : [emptyParagraph()]],
    background: CANVAS_BACKGROUND,
    updatedAt: Date.now(),
  };
}

export function normalizeSnapshot(value: unknown): CanvasSnapshot | null {
  if (!isRecord(value)) return null;

  const ver =
    typeof value.version === "number" && Number.isFinite(value.version)
      ? value.version
      : 0;

  if (ver !== CANVAS_SNAPSHOT_VERSION || !Array.isArray(value.textColumns)) {
    try {
      return migrateLegacy(value);
    } catch {
      return null;
    }
  }

  let textColumns = arrayOrEmpty<unknown>(value.textColumns).map((col) =>
    arrayOrEmpty<unknown>(col)
      .map(sanitizeTextBlock)
      .filter((b): b is JournalTextBlock => Boolean(b)),
  );

  textColumns = flattenToSingleColumn(
    textColumns.length === 0 ? [createWritingSlots()] : textColumns,
  );

  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : Date.now();

  const sealedAt =
    typeof value.sealedAt === "number" && Number.isFinite(value.sealedAt)
      ? value.sealedAt
      : undefined;

  return {
    version: CANVAS_SNAPSHOT_VERSION,
    textColumns,
    background: CANVAS_BACKGROUND,
    sealedAt,
    updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/*  Top-level component                                                       */
/* -------------------------------------------------------------------------- */

type CanvasBoardProps = {
  storageKey: string;
  initialSnapshot?: CanvasSnapshot | null;
  /**
   * Fires whenever the local snapshot is mirrored to storage. High-frequency.
   * Parents typically use it to sync the dashboard "recents" timestamp.
   */
  onSnapshotChange?: (snapshot: CanvasSnapshot) => void;
  /**
   * Fires on milestone saves: 7s after typing stops.
   * Persists draft metadata. Empty titles may be auto-generated after sealing.
   */
  onSave?: (snapshot: CanvasSnapshot) => void;
  /** Book title — editable in the canvas header. */
  title?: string;
  /** Persists a trimmed title; empty string keeps the “New book” placeholder. */
  onTitleChange?: (title: string) => void;
  /**
   * Header date/time for this session — frozen from open until close. Parents
   * pass the persisted `lastEditedAt` on return visits, or `Date.now()` on the
   * first open when no prior close timestamp exists.
   */
  sessionEditedAt: number;
  /** Last time this draft was edited (persisted) — for stale-draft prompts. */
  lastEditedAt?: number;
  /** Book cover background (CSS) — used for a subtle 6% page tint. */
  coverBackground?: string;
};

/**
 * Imperative handle exposed via `ref`. Used by the page-level back button
 * to grab an in-memory snapshot. Heavy localStorage writes are deferred by
 * the page until after navigation.
 */
export type CanvasBoardHandle = {
  captureForClose: () => CanvasSnapshot;
  /** Imperative focus for parents (e.g. auto-focus a freshly created entry). */
  focus: (position?: "start" | "end") => void;
  /**
   * Highlight a Patterns quote in the writing column, scroll it into view,
   * then fade/clear after a few seconds or on user scroll.
   * - `pending` — editor/content not ready yet (caller may retry)
   * - `done` — highlight applied (or attempted and found)
   * - `miss` — ready but quote not in the doc (stop retrying)
   */
  highlightQuote: (quote: string) => "pending" | "done" | "miss";
};

function CanvasBoardInner(
  {
    storageKey,
    initialSnapshot,
    onSnapshotChange,
    onSave,
    title,
    onTitleChange,
    sessionEditedAt,
    lastEditedAt,
    coverBackground,
  }: CanvasBoardProps,
  ref: React.ForwardedRef<CanvasBoardHandle>
) {
  const [journalBlocks, setJournalBlocks] = useState<JournalTextBlock[]>(() =>
    createWritingSlots()
  );
  // Live writing buffer — updated only by TipTap onUpdate / hydrate.
  // Do NOT sync from React state on every render: a re-render with stale
  // journalBlocks (e.g. saving label) would wipe fresher TipTap edits and
  // seal / mirror an empty board while the editor still shows text.
  const journalBlocksRef = useRef(journalBlocks);
  const journalEditorRef = useRef<JournalTiptapEditorHandle>(null);
  const textColumns = useMemo(() => [journalBlocks], [journalBlocks]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [sealedAt, setSealedAt] = useState<number | null>(null);
  const [isSealing, setIsSealing] = useState(false);
  const stampRef = useRef<JournalStampHandle>(null);
  const auroraStartedRef = useRef(false);
  const sealAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sealAuroraStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writingZoneRef = useRef<HTMLDivElement | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number>(() => sessionEditedAt);
  const [showSavingLabel, setShowSavingLabel] = useState(false);
  const [hasEditedThisSession, setHasEditedThisSession] = useState(false);
  const localMirrorTimerRef = useRef<number | null>(null);
  const quoteHighlightClearTimerRef = useRef<number | null>(null);
  const quoteHighlightDismissRef = useRef<(() => void) | null>(null);
  /** Snapshot `updatedAt` — frozen while editing; bumped only on close. */
  const snapshotEditedAtRef = useRef<number>(sessionEditedAt);
  /** Header stamp — frozen for this mount; never follows wall clock. */
  const [headerDisplayedAt] = useState(() => sessionEditedAt);


  const viewport = useViewportLayout();
  const pagePaddingY = viewport.pagePaddingYPx;
  const scrollComfortBottom = viewport.scrollComfortBottomPx;

  const outerRef = useRef<HTMLDivElement | null>(null);
  /** Scrollport for the writing column only — page / left rail stay fixed. */
  const writingScrollRef = useRef<HTMLDivElement | null>(null);
  const hydratedRef = useRef(false);
  const [isContentReady, setIsContentReady] = useState(false);

  /* ------------------------------ Hydration ------------------------------ */

  useLayoutEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    hydratedRef.current = true;

    // Apply snapshot into React state *before* mounting TipTap so the editor
    // is created once with the real content (no empty→content remount).
    const apply = (snap: CanvasSnapshot) => {
      const cols = flattenToSingleColumn(snap.textColumns);
      const blocks = cols[0] ?? createWritingSlots();
      journalBlocksRef.current = blocks;
      setJournalBlocks(blocks);
      if (snap.sealedAt) setSealedAt(snap.sealedAt);
      snapshotEditedAtRef.current = sessionEditedAt;
      setLastSavedAt(sessionEditedAt);
    };

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        const norm = normalizeSnapshot(parsed);
        if (norm) {
          // Sealed board missing body but metadata still has searchText — recover.
          if (!snapshotHasBodyText(norm)) {
            const entryId = entryIdFromBoardStorageKey(storageKey);
            const meta = readEntryById(entryId);
            const searchText = meta?.searchText?.trim() ?? "";
            if (
              typeof meta?.sealedAt === "number" &&
              searchText.length > 0
            ) {
              const recovered: CanvasSnapshot = {
                ...norm,
                textColumns: [blocksFromSearchText(searchText)],
                sealedAt: meta.sealedAt,
              };
              apply(recovered);
              try {
                window.localStorage.setItem(
                  storageKey,
                  JSON.stringify(recovered),
                );
              } catch {
                /* noop */
              }
              return;
            }
          }
          apply(norm);
          return;
        }
      }

      // Board key missing entirely — try recovering a sealed entry from searchText.
      {
        const entryId = entryIdFromBoardStorageKey(storageKey);
        const meta = readEntryById(entryId);
        const searchText = meta?.searchText?.trim() ?? "";
        if (typeof meta?.sealedAt === "number" && searchText.length > 0) {
          const recovered: CanvasSnapshot = {
            ...emptySnapshot(),
            textColumns: [blocksFromSearchText(searchText)],
            sealedAt: meta.sealedAt,
            updatedAt: meta.updatedAt,
          };
          apply(recovered);
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(recovered));
          } catch {
            /* noop */
          }
          return;
        }
      }

      if (initialSnapshot) {
        const norm = normalizeSnapshot(initialSnapshot) ?? emptySnapshot();
        apply(norm);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(norm));
        } catch {
          /* noop */
        }
        return;
      }
    } catch {
      if (initialSnapshot) {
        const norm = normalizeSnapshot(initialSnapshot) ?? emptySnapshot();
        apply(norm);
      }
    } finally {
      setIsContentReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSnapshot, onSnapshotChange, storageKey]);

  /* ----------------------- Snapshot mirroring + save ---------------------- */

  /** Live journal text from TipTap (preferred) or the writing ref — not React state. */
  const buildLiveSnapshot = useCallback((): CanvasSnapshot => {
    const editor = journalEditorRef.current;
    const liveBlocks = editor ? editor.getBlocks() : journalBlocksRef.current;
    journalBlocksRef.current = liveBlocks;
    return {
      version: CANVAS_SNAPSHOT_VERSION,
      textColumns: [liveBlocks],
      background: CANVAS_BACKGROUND,
      sealedAt: sealedAt ?? undefined,
      updatedAt: snapshotEditedAtRef.current,
    };
  }, [sealedAt]);

  const clearSavingLabel = useCallback(() => {
    setShowSavingLabel(false);
  }, []);

  const clearLocalMirrorTimers = useCallback(() => {
    if (localMirrorTimerRef.current !== null) {
      window.clearTimeout(localMirrorTimerRef.current);
      localMirrorTimerRef.current = null;
    }
    clearSavingLabel();
  }, [clearSavingLabel]);

  // Fast local mirror so a tab close never loses keystrokes. This is *not*
  // the "milestone" save (AI title regen) — that fires from a coarser timer
  // below. Only runs after user edits — never on hydrate, entry switch, or
  // sync. Once sealed, persistence is owned by the seal pipeline.
  const scheduleLocalMirror = useCallback(() => {
    if (sealedAt !== null) return;

    if (localMirrorTimerRef.current !== null) {
      window.clearTimeout(localMirrorTimerRef.current);
    }

    localMirrorTimerRef.current = window.setTimeout(() => {
      localMirrorTimerRef.current = null;
      try {
        const meta = readEntryById(entryIdFromBoardStorageKey(storageKey));
        // Entry was deleted — do not rewrite board storage or resurrect metadata.
        if (!meta) {
          clearSavingLabel();
          return;
        }
        // Seal may have committed before this debounce fires / React re-renders.
        if (typeof meta.sealedAt === "number") {
          clearSavingLabel();
          return;
        }
        const snap = buildLiveSnapshot();
        window.localStorage.setItem(storageKey, JSON.stringify(snap));
        setLastSavedAt(snap.updatedAt);
        onSnapshotChange?.(snap);
      } catch {
        /* noop */
      } finally {
        clearSavingLabel();
      }
    }, LOCAL_MIRROR_DEBOUNCE_MS);
  }, [
    buildLiveSnapshot,
    clearSavingLabel,
    onSnapshotChange,
    sealedAt,
    storageKey,
  ]);

  useEffect(
    () => () => {
      clearLocalMirrorTimers();
    },
    [clearLocalMirrorTimers],
  );

  const triggerMilestoneSave = useCallback(() => {
    const entryId = entryIdFromBoardStorageKey(storageKey);
    const meta = readEntryById(entryId);
    if (!meta) return;
    // Seal owns persistence once committed — never overwrite a sealed board.
    if (typeof meta.sealedAt === "number") return;
    const snap = buildLiveSnapshot();
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snap));
    } catch {
      /* noop */
    }
    setLastSavedAt(snap.updatedAt);
    onSave?.(snap);
  }, [buildLiveSnapshot, onSave, storageKey]);

  const isDirtyRef = useRef(false);
  const milestoneTimerRef = useRef<number | null>(null);
  /** Content at editor ready — save status only when live text diverges. */
  const contentBaselineRef = useRef<string | null>(null);

  const liveJournalBlocks = useCallback((): JournalTextBlock[] => {
    const editor = journalEditorRef.current;
    return editor ? editor.getBlocks() : journalBlocksRef.current;
  }, []);

  const hasUserChangedContent = useCallback((): boolean => {
    const baseline = contentBaselineRef.current;
    if (baseline === null) return false;
    return fingerprintBlocks(liveJournalBlocks()) !== baseline;
  }, [liveJournalBlocks]);

  // Capture baseline after TipTap init settles; ignore init onUpdate on refresh.
  useEffect(() => {
    if (!isContentReady) return;
    contentBaselineRef.current = null;
    let innerFrame = 0;
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        contentBaselineRef.current = fingerprintBlocks(liveJournalBlocks());
      });
    });
    return () => {
      window.cancelAnimationFrame(outerFrame);
      if (innerFrame) window.cancelAnimationFrame(innerFrame);
    };
  }, [isContentReady, liveJournalBlocks, storageKey]);

  /** Persist `lastEditedAt` after a typing pause. No AI runs while writing. */
  const scheduleMilestoneSave = useCallback(() => {
    if (milestoneTimerRef.current !== null) {
      window.clearTimeout(milestoneTimerRef.current);
    }
    milestoneTimerRef.current = window.setTimeout(() => {
      milestoneTimerRef.current = null;
      if (isDirtyRef.current) {
        triggerMilestoneSave();
        isDirtyRef.current = false;
      }
    }, MILESTONE_SAVE_INACTIVITY_MS);
  }, [triggerMilestoneSave]);

  // Each editor edit marks the draft dirty and (re)arms local mirror + milestone.
  const handleWritingActivity = useCallback(() => {
    if (sealedAt !== null) return;
    if (!hasUserChangedContent()) return;
    isDirtyRef.current = true;
    setHasEditedThisSession(true);
    setShowSavingLabel(true);
    scheduleLocalMirror();
    scheduleMilestoneSave();
  }, [
    hasUserChangedContent,
    scheduleLocalMirror,
    scheduleMilestoneSave,
    sealedAt,
  ]);

  useEffect(
    () => () => {
      if (milestoneTimerRef.current !== null) {
        window.clearTimeout(milestoneTimerRef.current);
      }
    },
    [],
  );

  // Sign-out / forced sync: write any in-memory editor state before pushSync.
  useEffect(() => {
    const flushLocalWrites = () => {
      if (sealedAt !== null) return;
      const entryId = entryIdFromBoardStorageKey(storageKey);
      const meta = readEntryById(entryId);
      if (!meta || typeof meta.sealedAt === "number") return;

      const snap = buildLiveSnapshot();
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snap));
      } catch {
        /* best effort */
      }
      setLastSavedAt(snap.updatedAt);
      clearLocalMirrorTimers();
      onSnapshotChange?.(snap);

      if (isDirtyRef.current) {
        if (milestoneTimerRef.current !== null) {
          window.clearTimeout(milestoneTimerRef.current);
          milestoneTimerRef.current = null;
        }
        onSave?.(snap);
        isDirtyRef.current = false;
      }
    };

    window.addEventListener(FLUSH_LOCAL_WRITES_EVENT, flushLocalWrites);
    return () => {
      window.removeEventListener(FLUSH_LOCAL_WRITES_EVENT, flushLocalWrites);
    };
  }, [
    buildLiveSnapshot,
    clearLocalMirrorTimers,
    onSave,
    onSnapshotChange,
    sealedAt,
    storageKey,
  ]);

  const saveStatus = useSaveStatus(showSavingLabel, hasEditedThisSession);

  const maybePrefetchSealTitle = useCallback(() => {
    if (sealedAt !== null) return;
    const committedTitle = typeof title === "string" ? title.trim() : "";
    if (hasBookTitle(committedTitle)) return;

    const snap = buildLiveSnapshot();
    if (collectJournalWordTokens(snap).length < MIN_WORDS_FOR_AI_TITLE) return;

    const text = extractJournalPlainText(snap);
    prefetchSealTitle(text);
  }, [buildLiveSnapshot, sealedAt, title]);

  const canSeal = useMemo(() => {
    if (sealedAt !== null || !isContentReady) return false;
    return snapshotHasContent({
      version: CANVAS_SNAPSHOT_VERSION,
      textColumns: [journalBlocks],
      background: CANVAS_BACKGROUND,
      updatedAt: 0,
    });
  }, [isContentReady, journalBlocks, sealedAt]);

  const applySealCommit = useCallback(() => {
    // Cancel pending draft saves so they cannot overwrite the sealed board.
    if (milestoneTimerRef.current !== null) {
      window.clearTimeout(milestoneTimerRef.current);
      milestoneTimerRef.current = null;
    }
    isDirtyRef.current = false;

    const entryId = entryIdFromBoardStorageKey(storageKey);
    const snap = buildLiveSnapshot();
    if (!snapshotHasContent(snap)) return null;

    const committed = commitEntrySeal(entryId, snap);
    if (committed !== null) {
      setSealedAt(committed);
    }
    return committed;
  }, [buildLiveSnapshot, storageKey]);

  const finishAuroraAnimation = useCallback(() => {
    if (sealAnimTimerRef.current) {
      clearTimeout(sealAnimTimerRef.current);
      sealAnimTimerRef.current = null;
    }
    setIsSealing(false);
  }, []);

  const startAuroraSeal = useCallback(() => {
    if (auroraStartedRef.current || isSealing) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    auroraStartedRef.current = true;
    journalEditorRef.current?.lock();
    // Must be synchronous: startTransition can flush setIsSealing(true) *after*
    // finishAuroraAnimation's setIsSealing(false), leaving ink stuck transparent.
    setIsSealing(true);

    const zone = writingZoneRef.current;
    if (!zone) {
      finishAuroraAnimation();
      return;
    }

    const finishSealAnimation = () => {
      zone.removeEventListener("animationend", onAuroraEnd);
      finishAuroraAnimation();
    };

    let auroraEnded = false;
    const onAuroraEnd = (e: AnimationEvent) => {
      if (e.animationName !== "journal-seal-aurora" || auroraEnded) return;
      auroraEnded = true;
      finishSealAnimation();
    };

    zone.addEventListener("animationend", onAuroraEnd);

    if (sealAnimTimerRef.current) {
      clearTimeout(sealAnimTimerRef.current);
    }
    sealAnimTimerRef.current = setTimeout(finishSealAnimation, JOURNAL_SEAL_ANIM_MS);
  }, [finishAuroraAnimation, isSealing]);

  const beginSealSideEffects = useCallback(() => {
    if (!canSeal) return;
    // Persist immediately so "+" / navigation can leave this page while the
    // stamp animation and AI title finish in the background.
    maybePrefetchSealTitle();
    applySealCommit();

    if (sealAuroraStartTimerRef.current) {
      clearTimeout(sealAuroraStartTimerRef.current);
    }
    sealAuroraStartTimerRef.current = setTimeout(() => {
      sealAuroraStartTimerRef.current = null;
      startAuroraSeal();
    }, JOURNAL_SEAL_AURORA_START_MS);
  }, [applySealCommit, canSeal, maybePrefetchSealTitle, startAuroraSeal]);

  useEffect(() => {
    return () => {
      if (sealAnimTimerRef.current) {
        clearTimeout(sealAnimTimerRef.current);
      }
      if (sealAuroraStartTimerRef.current) {
        clearTimeout(sealAuroraStartTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isContentReady || sealedAt !== null) return;
    void warmJournalTitleRoute();
  }, [isContentReady, sealedAt]);

  const beginSealAnimation = useCallback(() => {
    stampRef.current?.playSealAnimation();
  }, []);

  // Imperative seam used by the page-level back button: capture state in
  // memory. The page navigates immediately and persists to localStorage
  // afterward so large snapshots don't block.
  const clearQuoteHighlightChrome = useCallback(() => {
    if (quoteHighlightClearTimerRef.current !== null) {
      window.clearTimeout(quoteHighlightClearTimerRef.current);
      quoteHighlightClearTimerRef.current = null;
    }
    const dismiss = quoteHighlightDismissRef.current;
    if (dismiss) {
      dismiss();
      quoteHighlightDismissRef.current = null;
    }
    journalEditorRef.current?.clearQuoteHighlight();
  }, []);

  useEffect(() => () => clearQuoteHighlightChrome(), [clearQuoteHighlightChrome]);

  useImperativeHandle(
    ref,
    () => ({
      captureForClose: () => {
        snapshotEditedAtRef.current = Date.now();
        return buildLiveSnapshot();
      },
      focus: (position) => {
        journalEditorRef.current?.focus(position);
      },
      highlightQuote: (quote) => {
        const editor = journalEditorRef.current;
        if (!editor || !isContentReady) return "pending";

        clearQuoteHighlightChrome();
        const range = editor.highlightQuote(quote);
        if (!range) return "miss";

        const scrollEl = writingScrollRef.current;
        const coords = editor.getRangeCoords(range.from, range.to);
        if (scrollEl && coords) {
          const parentRect = scrollEl.getBoundingClientRect();
          const targetTop =
            coords.top - parentRect.top + scrollEl.scrollTop;
          const desired =
            targetTop - Math.min(scrollEl.clientHeight * 0.28, 140);
          scrollEl.scrollTo({
            top: Math.max(0, desired),
            behavior: "smooth",
          });

          // Dismiss only on intentional user input — not on the smooth
          // scroll we just started (that was wiping the tint mid-animation).
          const onUserNavigate = () => {
            clearQuoteHighlightChrome();
          };
          scrollEl.addEventListener("wheel", onUserNavigate, { passive: true });
          scrollEl.addEventListener("touchmove", onUserNavigate, {
            passive: true,
          });
          quoteHighlightDismissRef.current = () => {
            scrollEl.removeEventListener("wheel", onUserNavigate);
            scrollEl.removeEventListener("touchmove", onUserNavigate);
          };
        }

        quoteHighlightClearTimerRef.current = window.setTimeout(() => {
          clearQuoteHighlightChrome();
        }, QUOTE_HIGHLIGHT_TOTAL_MS);

        return "done";
      },
    }),
    [buildLiveSnapshot, clearQuoteHighlightChrome, isContentReady]
  );

  /* --------------------------- Focus / selection --------------------------- */

  const handleJournalBlocksChange = useCallback((blocks: JournalTextBlock[]) => {
    journalBlocksRef.current = blocks;
    setJournalBlocks(blocks);
  }, []);

  const setBlockKind = useCallback(
    (id: string, kind: TextBlockKind) => {
      journalEditorRef.current?.setBlockKind(kind, [id]);
      setShowTextCtx(false);
    },
    []
  );

  /* ----------------------------- Global events ---------------------------- */

  /* ------------------------------ Computed UI ----------------------------- */

  const activeBlock = useMemo(() => {
    if (!activeBlockId) return null;
    for (const col of textColumns) {
      const found = col.find((b) => b.id === activeBlockId);
      if (found) return found;
    }
    return null;
  }, [activeBlockId, textColumns]);

  const activeTextKind: TextBlockKind | null = activeBlock?.blockKind ?? null;

  const [showTextCtx, setShowTextCtx] = useState(false);
  const [textCtxPos, setTextCtxPos] = useState<{
    x: number;
    y: number;
    placeBelow: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isSealing) return;
    setShowTextCtx(false);
  }, [isSealing]);

  const refreshTextContext = useCallback(() => {
    const editorRoot = document.querySelector(
      ".journal-tiptap .ProseMirror"
    ) as HTMLElement | null;
    if (!editorRoot) {
      setShowTextCtx(false);
      return;
    }

    const active = document.activeElement;
    if (
      active !== editorRoot &&
      !editorRoot.contains(active) &&
      !editorRoot.contains(document.getSelection()?.anchorNode ?? null)
    ) {
      setShowTextCtx(false);
      return;
    }

    const len = journalEditorRef.current?.getSelectedTextLength() ?? 0;
    if (len >= TEXT_CTX_SELECTION_MIN) {
      const rect = journalEditorRef.current?.getSelectionRect();
      if (rect) {
        const popoverGuessW = 160;
        const popoverGuessH = 40;
        const margin = 8;
        const gap = 8;
        const left = Math.max(
          margin,
          Math.min(rect.left, window.innerWidth - popoverGuessW - margin),
        );
        const placeBelow =
          rect.top - gap < popoverGuessH + margin;
        setTextCtxPos({
          x: left,
          y: placeBelow ? rect.bottom + gap : rect.top - gap,
          placeBelow,
        });
        setShowTextCtx(true);
        return;
      }
    }
    setShowTextCtx(false);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshTextContext);
    return () =>
      document.removeEventListener("selectionchange", refreshTextContext);
  }, [refreshTextContext]);

  useEffect(() => {
    if (!activeBlockId) {
      setShowTextCtx(false);
      setTextCtxPos(null);
    }
  }, [activeBlockId]);

  // Hide contextuals when clicking outside any popover or toolbar.
  useEffect(() => {
    const hide = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-ctx]") && !t.closest("[data-toolbar]")) {
        setShowTextCtx(false);
      }
    };
    window.addEventListener("pointerdown", hide);
    return () => window.removeEventListener("pointerdown", hide);
  }, []);

  /* ---------------------------- Surface gestures -------------------------- */

  const onWritingPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (sealedAt !== null || isSealing) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Let ProseMirror handle every click inside the editor.
      if (target.closest(".journal-tiptap")) return;
      if (!target.closest("[data-writing-zone]")) return;

      e.preventDefault();
      journalEditorRef.current?.focus("start");
    },
    [isSealing, sealedAt]
  );

  /* ------------------------------- Render ------------------------------- */

  return (
    <div
      ref={outerRef}
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      style={{
        background: CANVAS_BACKGROUND,
        color: WRITING_INK,
        caretColor: WRITING_INK,
      }}
    >
      {/* Stamp — physical rubber-stamp interaction; manages its own visibility */}
      <JournalStamp
        ref={stampRef}
        isSealed={!!sealedAt}
        canSeal={canSeal}
        onStampBegin={beginSealSideEffects}
        onStampHover={maybePrefetchSealTitle}
      />

      {/* —————————— Full-width centered writing area —————————— */}
      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
        onPointerDown={onWritingPointerDown}
      >
        <div
          ref={writingScrollRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
          style={{
            paddingTop: `${pagePaddingY / 16}rem`,
            paddingBottom: `${pagePaddingY / 16}rem`,
            scrollPaddingTop: `${pagePaddingY / 16}rem`,
            scrollPaddingBottom: `${(pagePaddingY + scrollComfortBottom) / 16}rem`,
          }}
        >
          <div
            className={`mx-auto flex w-full min-h-0 min-w-0 flex-1 flex-col ${PAGE_PADDING_X_CLASS}`}
            style={{ maxWidth: WRITING_COLUMN_MAX_WIDTH }}
          >
            <CanvasHeader
              title={title}
              editedAt={headerDisplayedAt}
              sealedAt={sealedAt}
              saveStatus={sealedAt !== null ? null : saveStatus}
              onTitleChange={onTitleChange}
              isSealed={sealedAt !== null}
            />

            <div
              ref={writingZoneRef}
              data-writing-zone
              data-sealed={sealedAt !== null ? "" : undefined}
              data-sealing={isSealing ? "" : undefined}
              className="relative flex w-full min-h-0 flex-1 flex-col"
              style={
                {
                  "--seal-aurora-ms": `${JOURNAL_SEAL_AURORA_MS}ms`,
                } as React.CSSProperties
              }
            >
              <div className="journal-seal-content flex w-full min-h-0 flex-1 flex-col">
                {isContentReady ? (
                  <JournalTiptapEditor
                    ref={journalEditorRef}
                    initialBlocks={journalBlocks}
                    isSealed={sealedAt !== null}
                    isSealing={isSealing}
                    onBlocksChange={handleJournalBlocksChange}
                    onActiveBlockChange={setActiveBlockId}
                    onSelectionActivity={refreshTextContext}
                    onWritingActivity={handleWritingActivity}
                  />
                ) : null}

                {!sealedAt ? (
                  <div
                    className="min-h-[min(40vh,18rem)] flex-1 cursor-text sm:min-h-[min(50vh,24rem)]"
                    aria-hidden
                    onPointerDown={(e) => {
                      e.preventDefault();
                      journalEditorRef.current?.focus("end");
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* —————————— Text contextual format bar —————————— */}
      {showTextCtx && textCtxPos && activeBlockId && (
        <div
          data-ctx
          className={clsx(
            "pointer-events-auto fixed z-40",
            !textCtxPos.placeBelow && "-translate-y-full",
          )}
          style={{ left: textCtxPos.x, top: textCtxPos.y }}
        >
          <div
            className="flex items-center gap-0.5 rounded-lg border border-black/[0.06] bg-white/95 px-1 py-0.5 shadow-[0_0.25rem_1.25rem_rgba(15,15,15,0.10)] backdrop-blur-md sm:rounded-xl sm:px-1.5 sm:py-1"
            style={{
              fontFamily:
                "var(--font-body)",
            }}
          >
            {(
              [
                {
                  kind: "paragraph" as const,
                  icon: <Pilcrow size={14} strokeWidth={iconStrokePx(14)} />,
                  label: "Paragraph",
                },
                {
                  kind: "bullet" as const,
                  icon: <List size={14} strokeWidth={iconStrokePx(14)} />,
                  label: "Bullet list",
                },
                {
                  kind: "checklist" as const,
                  icon: (
                    <ListChecks size={14} strokeWidth={iconStrokePx(14)} />
                  ),
                  label: "Checklist",
                },
              ] as const
            ).map(({ kind, icon, label }) => (
              <button
                key={kind}
                type="button"
                aria-label={label}
                onClick={() => setBlockKind(activeBlockId, kind)}
                className={clsx(
                  "inline-flex h-6 w-6 items-center justify-center rounded-md transition sm:h-7 sm:w-7 sm:rounded-lg",
                  activeTextKind === kind
                    ? "bg-black/10 text-(--color-canvas-toolbar-icon)"
                    : "text-(--color-canvas-toolbar-icon)/70 hover:bg-black/[0.05] hover:text-(--color-canvas-toolbar-icon)"
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CanvasBoard = forwardRef<CanvasBoardHandle, CanvasBoardProps>(
  CanvasBoardInner
);
CanvasBoard.displayName = "CanvasBoard";

export default CanvasBoard;

/* -------------------------------------------------------------------------- */
/*  Canvas header — last-edited date + heading                                   */
/* -------------------------------------------------------------------------- */

/** Draft header — e.g. "28 June 2026, 22:58". */
function formatLastEditedStamp(ts: number): { date: string; time: string } {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "long" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return {
    date: `${day} ${month} ${year}`,
    time,
  };
}

/** Sealed header — e.g. "🪷 Sealed · 26 Jun 2026". */
function formatSignedStamp(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "short" });
  const year = d.getFullYear();
  return ` Sealed · ${day} ${month} ${year}`;
}

type CanvasHeaderProps = {
  title?: string;
  /** Session-frozen stamp from the parent (last close, or now on first open). */
  editedAt: number;
  /** Unix ms when the entry was sealed — shown instead of editedAt once stamped. */
  sealedAt?: number | null;
  saveStatus?: "saving" | "saved" | null;
  onTitleChange?: (title: string) => void;
  isSealed?: boolean;
};

function CanvasHeader({
  title,
  editedAt,
  sealedAt = null,
  saveStatus = null,
  onTitleChange,
  isSealed = false,
}: CanvasHeaderProps) {
  const persistedTitle =
    typeof title === "string" ? title.trim() : "";
  const [value, setValue] = useState(persistedTitle);
  const isTitleFocusedRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const hasTitle = value.trim().length > 0;

  useEffect(() => {
    if (isTitleFocusedRef.current) return;
    setValue(persistedTitle);
  }, [persistedTitle]);

  const commitTitle = useCallback(() => {
    const next = commitBookTitle(value);
    setValue(next);
    if (next !== persistedTitle) {
      onTitleChange?.(next);
    }
  }, [onTitleChange, persistedTitle, value]);

  useEffect(() => {
    if (!onTitleChange) return;
    const next = commitBookTitle(value);
    if (next === persistedTitle) return;
    const timer = window.setTimeout(() => onTitleChange(next), 400);
    return () => window.clearTimeout(timer);
  }, [onTitleChange, persistedTitle, value]);

  // Sign-out flush: commit a pending title before cloud push.
  useEffect(() => {
    if (!onTitleChange || isSealed) return;
    const flushTitle = () => {
      const next = commitBookTitle(valueRef.current);
      if (next !== persistedTitle) {
        setValue(next);
        onTitleChange(next);
      }
    };
    window.addEventListener(FLUSH_LOCAL_WRITES_EVENT, flushTitle);
    return () => {
      window.removeEventListener(FLUSH_LOCAL_WRITES_EVENT, flushTitle);
    };
  }, [isSealed, onTitleChange, persistedTitle]);

  const displayAt =
    isSealed && typeof sealedAt === "number" && Number.isFinite(sealedAt)
      ? sealedAt
      : editedAt;
  const editedStamp = useMemo(
    () => formatLastEditedStamp(displayAt),
    [displayAt],
  );
  const signedStamp = useMemo(
    () =>
      typeof sealedAt === "number" && Number.isFinite(sealedAt)
        ? formatSignedStamp(sealedAt)
        : null,
    [sealedAt],
  );
  const isoDateTime = useMemo(
    () => new Date(displayAt).toISOString(),
    [displayAt],
  );

  return (
    <header
      className="mb-8 grid w-full grid-cols-1 items-end gap-y-1.5 sm:mb-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4 sm:gap-y-0 md:gap-x-6 lg:mb-14 lg:gap-x-8 xl:gap-x-12"
      style={{
        fontFamily:
          "var(--font-body)",
      }}
    >
      <input
        type="text"
        value={value}
        readOnly={isSealed}
        tabIndex={isSealed ? -1 : undefined}
        onChange={(event) => setValue(clampBookTitle(event.target.value))}
        onFocus={() => {
          isTitleFocusedRef.current = true;
        }}
        onBlur={() => {
          isTitleFocusedRef.current = false;
          commitTitle();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        placeholder={isSealed ? "" : BOOK_TITLE_PLACEHOLDER}
        spellCheck={false}
        aria-label="Book title"
        className={clsx(
          "header-lg col-start-1 row-start-1 min-w-0 w-full truncate self-end border-0 bg-transparent p-0 text-left font-medium tracking-tight outline-none focus:outline-none placeholder:text-(--canvas-title-placeholder)",
          hasTitle ? "text-(--canvas-title-ink)" : "text-(--canvas-title-placeholder)"
        )}
        style={{ fontFamily: "var(--font-heading)" }}
      />
      <div
        className="col-start-1 row-start-2 block text-left font-light text-xs tracking-[0.04em] sm:col-start-2 sm:row-start-1 sm:text-right sm:text-xs"
        style={{ lineHeight: 1.45 }}
      >
        {saveStatus ? (
          <>
            <span aria-live="polite" className="text-tertiary">
              {saveStatus === "saving" ? "Saving..." : "Saved"}
            </span>
            <span className="text-(--canvas-date-time)"> · </span>
          </>
        ) : null}
        <time dateTime={isoDateTime} className="inline text-(--canvas-date-time)">
          {isSealed && signedStamp ? (
            signedStamp
          ) : (
            <>
              <span className="mb-[-0.0625rem]">{editedStamp.date}, </span>
              <span>{editedStamp.time}</span>
            </>
          )}
        </time>
      </div>
    </header>
  );
}
