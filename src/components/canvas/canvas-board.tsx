"use client";

/**
 * CanvasBoard — full-width journal writing surface.
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  title (left)                last edited · saving? (right)    │
 *  │  ─────────────────────────────────────────────────────────── │
 *  │  centered writing column (Rethink Sans)                      │
 *  │  signature (end)                                             │
 *  │  🌻 fixed bottom-left                                        │
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

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export const CANVAS_SNAPSHOT_VERSION = 4 as const;

export type TextBlockKind = "paragraph" | "bullet" | "checklist";
export type ColumnLayout = 1 | 2 | 3;

export type JournalTextBlock = {
  id: string;
  blockKind: TextBlockKind;
  text: string;
  /** Only meaningful when blockKind === "checklist". */
  checked?: boolean;
};

/**
 * Image data. The legacy free-positioning fields (`x`, `y`, `rotate`, `figure`)
 * are preserved for backward-compatible snapshots but ignored by the new
 * left-column stack renderer.
 */
export type JournalImage = {
  id: string;
  src: string;
  /** Original aspect ratio (height / width). Used to render at correct shape. */
  ratio: number;
  caption?: string;
  /** Order index in the polaroid stack (lower = higher on the page). */
  order?: number;

  // —— Legacy free-positioning fields (kept for compat, ignored by render) ——
  x?: number;
  y?: number;
  w?: number;
  rotate?: number;
  polaroid?: boolean;
  figure?: boolean;
};

export type CanvasSnapshot = {
  version: typeof CANVAS_SNAPSHOT_VERSION;
  /** 2D — outer index is the column track, inner index is the block order. */
  textColumns: JournalTextBlock[][];
  imageBlocks: JournalImage[];
  background: string;
  columns: ColumnLayout;
  /** Author name / signature shown at the end of the page. */
  signature?: string;
  /** Unix ms when the entry was sealed (irreversible). Absent = draft. */
  sealedAt?: number;
  updatedAt: number;
};

/* -------------------------------------------------------------------------- */
/*  Visual constants                                                          */
/* -------------------------------------------------------------------------- */

/** Page + canvas — tokens in `global.css`. */
export const CANVAS_BACKGROUND = "var(--canvas-bg-gradient)";
/** Polaroid column — slightly toned up from the page. */
export const CANVAS_RECESS = "var(--canvas-recess)";

/** Centered writing column width. */
const WRITING_COLUMN_MAX_WIDTH = "min(92vw, 700px)";

/** Writing typography — Rethink Sans, 16px body size (breathable). */
const WRITING_FONT_SIZE = "var(--text-md)";
const WRITING_LINE_HEIGHT = 1.75;
const WRITING_LETTER_SPACING = "0.005em";
const WRITING_WORD_SPACING = "0.005em";
const WRITING_INK = "var(--canvas-ink)";

/** Save behaviour. Local mirror is fast (no data loss); milestone save fires
 *  after 7s of typing inactivity. */
const LOCAL_MIRROR_DEBOUNCE_MS = 600;
/** Only surface "saving" when a mirror is still pending past the debounce. */
const SAVING_LABEL_DELAY_MS = 800;
/** Milestone save (persists `lastEditedAt`) fires after this typing pause. */
const MILESTONE_SAVE_INACTIVITY_MS = 7_000;

/** Minimum selected-character count before the text format bar appears. */
const TEXT_CTX_SELECTION_MIN = 4;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const arrayOrEmpty = <T,>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : [];

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/**
 * Adjust the column tracks to a new column count without redistributing
 * existing content.
 *
 *   - Going up (e.g. 2 → 3): keep the existing tracks, append empty columns.
 *   - Going down to 1: stack everything vertically into a single column.
 *   - Going down from 3 → 2: keep tracks 1, append track 3 onto track 2 so
 *     no content is lost.
 */
const adjustColumns = (
  cols: JournalTextBlock[][],
  target: ColumnLayout
): JournalTextBlock[][] => {
  const current = cols.length;
  if (current === target) {
    return cols.map((c) =>
      c.length > 0 ? c : target === 1 ? createWritingSlots() : [emptyParagraph()]
    );
  }

  if (target > current) {
    const next = cols.map((c) =>
      c.length > 0 ? c : target === 1 ? createWritingSlots() : [emptyParagraph()]
    );
    while (next.length < target) next.push([emptyParagraph()]);
    return next;
  }

  // target < current
  const kept = cols.slice(0, target - 1).map((c) => c.slice());
  const tailMerged = cols.slice(target - 1).flat();
  kept.push(
    tailMerged.length > 0
      ? tailMerged
      : target === 1
        ? createWritingSlots()
        : [emptyParagraph()]
  );
  return kept;
};

/* -------------------------------------------------------------------------- */
/*  Snapshot helpers                                                          */
/* -------------------------------------------------------------------------- */

export const emptySnapshot = (): CanvasSnapshot => ({
  version: CANVAS_SNAPSHOT_VERSION,
  textColumns: [createWritingSlots()],
  imageBlocks: [],
  background: CANVAS_BACKGROUND,
  columns: 1,
  signature: "",
  updatedAt: Date.now(),
});

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

const sanitizeImage = (raw: unknown): JournalImage | null => {
  if (!isRecord(raw)) return null;
  const src = typeof raw.src === "string" ? raw.src : "";
  if (!src) return null;
  const id = typeof raw.id === "string" ? raw.id : newId();
  const ratio =
    typeof raw.ratio === "number" && Number.isFinite(raw.ratio)
      ? clamp(raw.ratio, 0.1, 4)
      : 0.66;
  const caption =
    typeof raw.caption === "string" && raw.caption.length > 0
      ? raw.caption
      : undefined;
  const order =
    typeof raw.order === "number" && Number.isFinite(raw.order)
      ? raw.order
      : undefined;
  return {
    id,
    src,
    ratio,
    caption,
    order,
    // Pass through legacy fields so re-saving doesn't lose data.
    x: typeof raw.x === "number" ? raw.x : undefined,
    y: typeof raw.y === "number" ? raw.y : undefined,
    w: typeof raw.w === "number" ? raw.w : undefined,
    rotate: typeof raw.rotate === "number" ? raw.rotate : undefined,
    polaroid: typeof raw.polaroid === "boolean" ? raw.polaroid : undefined,
    figure: typeof raw.figure === "boolean" ? raw.figure : undefined,
  };
};

/**
 * Best-effort migration from any prior snapshot version (v1 positional,
 * v2 positional + multi-line lists, v3 sequential mixed blocks) into v4.
 */
function migrateLegacy(raw: Record<string, unknown>): CanvasSnapshot {
  const flatText: JournalTextBlock[] = [];
  const images: JournalImage[] = [];

  const v3Blocks = arrayOrEmpty<Record<string, unknown>>(raw.blocks);
  if (v3Blocks.length > 0) {
    for (const b of v3Blocks) {
      if (b.kind === "image" && typeof b.src === "string") {
        const ratio =
          typeof b.ratio === "number" && Number.isFinite(b.ratio)
            ? b.ratio
            : 0.66;
        images.push({
          id: typeof b.id === "string" ? b.id : newId(),
          src: b.src,
          ratio,
          caption: typeof b.caption === "string" ? b.caption : undefined,
        });
        continue;
      }
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

    for (const im of arrayOrEmpty<Record<string, unknown>>(raw.imageElements)) {
      const src = typeof im.src === "string" ? im.src : "";
      if (!src) continue;
      const w =
        typeof im.w === "number" && Number.isFinite(im.w)
          ? (im.w as number)
          : 360;
      const h =
        typeof im.h === "number" && Number.isFinite(im.h)
          ? (im.h as number)
          : Math.round(w * 0.66);
      const ratio = w > 0 ? h / w : 0.66;
      images.push({
        id: typeof im.id === "string" ? im.id : newId(),
        src,
        ratio,
        caption: typeof im.caption === "string" ? im.caption : undefined,
      });
    }
  }

  return {
    version: CANVAS_SNAPSHOT_VERSION,
    textColumns: [flatText.length > 0 ? flatText : [emptyParagraph()]],
    imageBlocks: images,
    background: CANVAS_BACKGROUND,
    columns: 1,
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

  const columnsRaw = value.columns;
  const columns: ColumnLayout =
    columnsRaw === 1 || columnsRaw === 2 || columnsRaw === 3
      ? (columnsRaw as ColumnLayout)
      : 1;

  let textColumns = arrayOrEmpty<unknown>(value.textColumns).map((col) =>
    arrayOrEmpty<unknown>(col)
      .map(sanitizeTextBlock)
      .filter((b): b is JournalTextBlock => Boolean(b))
  );

  textColumns = adjustColumns(
    textColumns.length === 0 ? [createWritingSlots()] : textColumns,
    columns
  );

  const imageBlocks = arrayOrEmpty<unknown>(value.imageBlocks)
    .map(sanitizeImage)
    .filter((b): b is JournalImage => Boolean(b));

  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : Date.now();

  const signature =
    typeof value.signature === "string" ? value.signature : undefined;

  const sealedAt =
    typeof value.sealedAt === "number" && Number.isFinite(value.sealedAt)
      ? value.sealedAt
      : undefined;

  return {
    version: CANVAS_SNAPSHOT_VERSION,
    textColumns,
    imageBlocks,
    background: CANVAS_BACKGROUND,
    columns,
    signature,
    sealedAt,
    updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/*  Image helpers                                                              */
/* -------------------------------------------------------------------------- */

type ImageDims = { width: number; height: number };

const loadImageDims = (src: string): Promise<ImageDims> =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1200, height: 800 });
    img.src = src;
  });

/** Convert a File to a persistent base64 data-URL so it survives reloads. */
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

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
  const journalBlocksRef = useRef(journalBlocks);
  journalBlocksRef.current = journalBlocks;
  const [editorContentKey, setEditorContentKey] = useState(0);
  const journalEditorRef = useRef<JournalTiptapEditorHandle>(null);
  const textColumns = useMemo(() => [journalBlocks], [journalBlocks]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [imageBlocks, setImageBlocks] = useState<JournalImage[]>([]);
  // Signature — disabled for now
  // const [signature, setSignature] = useState("");
  // const [signatureFieldOpen, setSignatureFieldOpen] = useState(false);
  const [sealedAt, setSealedAt] = useState<number | null>(null);
  const [isSealing, setIsSealing] = useState(false);
  const stampRef = useRef<JournalStampHandle>(null);
  const auroraStartedRef = useRef(false);
  const sealAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sealAuroraStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writingZoneRef = useRef<HTMLDivElement | null>(null);
  // Column layout has been retired from the UI; we keep the snapshot field
  // for backward-compat (legacy notebooks still deserialize) but always
  // render as a single column going forward.
  const [columns] = useState<ColumnLayout>(1);
  const [lastSavedAt, setLastSavedAt] = useState<number>(() => sessionEditedAt);
  const [showSavingLabel, setShowSavingLabel] = useState(false);
  const savingLabelTimerRef = useRef<number | null>(null);
  /** Snapshot `updatedAt` — frozen while editing; bumped only on close. */
  const snapshotEditedAtRef = useRef<number>(sessionEditedAt);
  /** Header stamp — frozen for this mount; never follows wall clock. */
  const [headerDisplayedAt] = useState(() => sessionEditedAt);


  const viewport = useViewportLayout();
  const pagePaddingY = viewport.pagePaddingYPx;
  const scrollComfortBottom = viewport.scrollComfortBottomPx;

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const outerRef = useRef<HTMLDivElement | null>(null);
  /** Scrollport for the writing column only — page / left rail stay fixed. */
  const writingScrollRef = useRef<HTMLDivElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  // const signatureRef = useRef<HTMLTextAreaElement | null>(null);
  const hydratedRef = useRef(false);
  const [isContentReady, setIsContentReady] = useState(false);

  /* ------------------------------ Hydration ------------------------------ */

  useLayoutEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    hydratedRef.current = true;

    const apply = (snap: CanvasSnapshot) => {
      const cols = adjustColumns(snap.textColumns, 1);
      const blocks = cols[0] ?? createWritingSlots();
      journalBlocksRef.current = blocks;
      setJournalBlocks(blocks);
      setEditorContentKey((k) => k + 1);
      setImageBlocks(snap.imageBlocks);
      // setSignature(snap.signature ?? "");
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
          apply(norm);
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

  const buildSnapshot = useCallback((): CanvasSnapshot => {
    return {
      version: CANVAS_SNAPSHOT_VERSION,
      textColumns: [journalBlocks],
      imageBlocks,
      background: CANVAS_BACKGROUND,
      columns,
      signature: "",
      sealedAt: sealedAt ?? undefined,
      updatedAt: snapshotEditedAtRef.current,
    };
  }, [columns, imageBlocks, journalBlocks, sealedAt]);

  /** Live journal text from the editor ref — not React state (onUpdate fires before re-render). */
  const buildLiveSnapshot = useCallback((): CanvasSnapshot => {
    return {
      version: CANVAS_SNAPSHOT_VERSION,
      textColumns: [journalBlocksRef.current],
      imageBlocks,
      background: CANVAS_BACKGROUND,
      columns,
      signature: "",
      sealedAt: sealedAt ?? undefined,
      updatedAt: snapshotEditedAtRef.current,
    };
  }, [columns, imageBlocks, sealedAt]);

  const clearSavingLabelTimer = useCallback(() => {
    if (savingLabelTimerRef.current !== null) {
      window.clearTimeout(savingLabelTimerRef.current);
      savingLabelTimerRef.current = null;
    }
    setShowSavingLabel(false);
  }, []);

  // Fast local mirror so a tab close never loses keystrokes. This is *not*
  // the "milestone" save (AI title regen) — that fires from a coarser timer
  // and the manual button, below.
  useEffect(() => {
    savingLabelTimerRef.current = window.setTimeout(() => {
      setShowSavingLabel(true);
    }, SAVING_LABEL_DELAY_MS);

    const timer = window.setTimeout(() => {
      let snap = buildSnapshot();
      const meta = readEntryById(entryIdFromBoardStorageKey(storageKey));
      if (typeof meta?.sealedAt === "number") {
        snap = { ...snap, sealedAt: meta.sealedAt };
      }
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snap));
        setLastSavedAt(snap.updatedAt);
        onSnapshotChange?.(snap);
      } catch {
        /* noop */
      } finally {
        clearSavingLabelTimer();
      }
    }, LOCAL_MIRROR_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (savingLabelTimerRef.current !== null) {
        window.clearTimeout(savingLabelTimerRef.current);
        savingLabelTimerRef.current = null;
      }
    };
  }, [buildSnapshot, clearSavingLabelTimer, onSnapshotChange, storageKey]);

  const triggerMilestoneSave = useCallback(() => {
    const snap = buildSnapshot();
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snap));
    } catch {
      /* noop */
    }
    setLastSavedAt(snap.updatedAt);
    onSave?.(snap);
  }, [buildSnapshot, onSave, storageKey]);

  const isDirtyRef = useRef(false);
  const milestoneTimerRef = useRef<number | null>(null);

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

  // Each editor edit simply marks the draft dirty and (re)arms the save timer.
  const handleWritingActivity = useCallback(() => {
    if (sealedAt !== null) return;
    isDirtyRef.current = true;
    scheduleMilestoneSave();
  }, [scheduleMilestoneSave, sealedAt]);

  useEffect(
    () => () => {
      if (milestoneTimerRef.current !== null) {
        window.clearTimeout(milestoneTimerRef.current);
      }
    },
    [],
  );

  const maybePrefetchSealTitle = useCallback(() => {
    if (sealedAt !== null) return;
    const committedTitle = typeof title === "string" ? title.trim() : "";
    if (hasBookTitle(committedTitle)) return;

    const snap = buildLiveSnapshot();
    if (collectJournalWordTokens(snap).length < MIN_WORDS_FOR_AI_TITLE) return;

    const text = extractJournalPlainText(snap);
    prefetchSealTitle(text);
  }, [buildLiveSnapshot, sealedAt, title]);

  const applySealCommit = useCallback(() => {
    const entryId = entryIdFromBoardStorageKey(storageKey);
    const committed = commitEntrySeal(entryId, buildLiveSnapshot());
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
    maybePrefetchSealTitle();
    applySealCommit();

    if (sealAuroraStartTimerRef.current) {
      clearTimeout(sealAuroraStartTimerRef.current);
    }
    sealAuroraStartTimerRef.current = setTimeout(() => {
      sealAuroraStartTimerRef.current = null;
      startAuroraSeal();
    }, JOURNAL_SEAL_AURORA_START_MS);
  }, [applySealCommit, maybePrefetchSealTitle, startAuroraSeal]);

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
  useImperativeHandle(
    ref,
    () => ({
      captureForClose: () => {
        snapshotEditedAtRef.current = Date.now();
        return buildSnapshot();
      },
      focus: (position) => {
        journalEditorRef.current?.focus(position);
      },
    }),
    [buildSnapshot]
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

  /* ------------------------------ Images --------------------------------- */

  const insertImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const src = await fileToDataUrl(file);
    const dims = await loadImageDims(src);
    const ratio = dims.width > 0 ? dims.height / dims.width : 0.66;
    const id = newId();
    setImageBlocks((bs) => [
      ...bs,
      {
        id,
        src,
        ratio,
        order: bs.length,
      },
    ]);
    setSelectedImageId(id);
  }, []);

  const updateImage = useCallback(
    (id: string, patch: Partial<JournalImage>) => {
      setImageBlocks((bs) =>
        bs.map((b) => (b.id === id ? { ...b, ...patch } : b))
      );
    },
    []
  );

  const removeImage = useCallback((id: string) => {
    setImageBlocks((bs) => bs.filter((b) => b.id !== id));
    setSelectedImageId((s) => (s === id ? null : s));
  }, []);

  /* ----------------------------- Global events ---------------------------- */

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      for (const f of files) {
        if (f.type.startsWith("image/")) void insertImageFile(f);
      }
    },
    [insertImageFile]
  );

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
    setSelectedImageId(null);
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
        setSelectedImageId(null);
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
      setSelectedImageId(null);
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
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Stamp — physical rubber-stamp interaction; manages its own visibility */}
      <JournalStamp
        ref={stampRef}
        isSealed={!!sealedAt}
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
            paddingTop: pagePaddingY,
            paddingBottom: pagePaddingY,
            scrollPaddingTop: pagePaddingY,
            scrollPaddingBottom: pagePaddingY + scrollComfortBottom,
          }}
        >
          <div
            className="mx-auto flex w-full min-h-0 flex-1 flex-col px-4 sm:px-5 lg:px-6"
            style={{ maxWidth: WRITING_COLUMN_MAX_WIDTH }}
          >
            <CanvasHeader
              title={title}
              editedAt={headerDisplayedAt}
              sealedAt={sealedAt}
              showSaving={showSavingLabel}
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
                <JournalTiptapEditor
                  key={editorContentKey}
                  ref={journalEditorRef}
                  initialBlocks={journalBlocks}
                  isSealed={sealedAt !== null}
                  isSealing={isSealing}
                  onBlocksChange={handleJournalBlocksChange}
                  onActiveBlockChange={setActiveBlockId}
                  onSelectionActivity={refreshTextContext}
                  onFocus={() => setSelectedImageId(null)}
                  onWritingActivity={handleWritingActivity}
                />

                {!sealedAt ? (
                  <div
                    className="min-h-[min(40vh,18rem)] flex-1 cursor-text sm:min-h-[min(50vh,24rem)]"
                    aria-hidden
                    onPointerDown={(e) => {
                      e.preventDefault();
                      journalEditorRef.current?.focus("end");
                      setSelectedImageId(null);
                    }}
                  />
                ) : null}

                {/* Signature — disabled for now
                {!sealedAt && !signatureFieldOpen ? (
                  <div
                    className="min-h-[min(40vh,18rem)] flex-1 cursor-text sm:min-h-[min(50vh,24rem)]"
                    aria-hidden
                    onPointerDown={(e) => {
                      e.preventDefault();
                      journalEditorRef.current?.focus("end");
                      setSelectedImageId(null);
                    }}
                  />
                ) : null}

                {sealedAt !== null ? (
                  signature.trim() ? (
                    <CanvasSignature
                      ref={signatureRef}
                      value={signature}
                      isSealed
                      onChange={setSignature}
                    />
                  ) : null
                ) : signatureFieldOpen ? (
                  <CanvasSignature
                    ref={signatureRef}
                    value={signature}
                    isSealed={false}
                    onChange={(next) => {
                      setSignature(next);
                      notifyCompanionWriting();
                    }}
                    onBlur={() => {
                      if (!signatureRef.current?.value.trim()) {
                        setSignatureFieldOpen(false);
                      }
                    }}
                    onDismiss={() => {
                      setSignatureFieldOpen(false);
                      journalEditorRef.current?.focus("start");
                    }}
                    onSelectAllJournal={() =>
                      journalEditorRef.current?.selectAll()
                    }
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSignatureFieldOpen(true);
                      requestAnimationFrame(() => signatureRef.current?.focus());
                    }}
                    className="mt-16 w-fit border-0 bg-transparent p-0 text-left text-(--canvas-ink-secondary) outline-none transition-colors hover:text-(--canvas-ink)"
                    style={{
                      fontFamily: "var(--font-body), system-ui, sans-serif",
                      fontSize: WRITING_FONT_SIZE,
                      lineHeight: WRITING_LINE_HEIGHT,
                    }}
                  >
                    Add signature
                  </button>
                )}
                */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* —————————— Hidden file input — driven by polaroid placeholder clicks —————————— */}
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(ev) => {
          const files = Array.from(ev.target.files ?? []);
          for (const f of files) void insertImageFile(f);
          ev.target.value = "";
        }}
      />

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
              className="flex items-center gap-0.5 rounded-lg border border-black/[0.06] bg-white/95 px-1 py-0.5 shadow-[0_4px_20px_rgba(15,15,15,0.10)] backdrop-blur-md sm:rounded-xl sm:px-1.5 sm:py-1"
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

/** Sealed header — e.g. "🌻 Sealed · 26 Jun 2026". */
function formatSignedStamp(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "short" });
  const year = d.getFullYear();
  return `🌻 Sealed · ${day} ${month} ${year}`;
}

type CanvasHeaderProps = {
  title?: string;
  /** Session-frozen stamp from the parent (last close, or now on first open). */
  editedAt: number;
  /** Unix ms when the entry was sealed — shown instead of editedAt once stamped. */
  sealedAt?: number | null;
  showSaving?: boolean;
  onTitleChange?: (title: string) => void;
  isSealed?: boolean;
};

function CanvasHeader({
  title,
  editedAt,
  sealedAt = null,
  showSaving = false,
  onTitleChange,
  isSealed = false,
}: CanvasHeaderProps) {
  const persistedTitle =
    typeof title === "string" ? title.trim() : "";
  const [value, setValue] = useState(persistedTitle);
  const isTitleFocusedRef = useRef(false);
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
      <time
        dateTime={isoDateTime}
        className="col-start-1 row-start-2 block text-left font-light text-xs tracking-[0.04em] sm:col-start-2 sm:row-start-1 sm:text-right sm:text-xs"
        style={{ lineHeight: 1.45 }}
      >
        {isSealed && signedStamp ? (
          <span className="text-(--canvas-date-time)">{signedStamp}</span>
        ) : (
          <>
            <span className="text-(--canvas-date-time) mb-[-1px]">
              {editedStamp.date},{" "}
            </span>
            <span className="text-(--canvas-date-time)">
              {editedStamp.time}
            </span>
          </>
        )}
      </time>
      {showSaving ? (
        <p
          aria-live="polite"
          className="col-start-1 row-start-3 block text-left text-xs tracking-[0.01em] text-(--canvas-time) sm:col-start-2 sm:row-start-2 sm:text-right sm:text-sm"
          style={{ lineHeight: 1.45 }}
        >
          saving
        </p>
      ) : null}
    </header>
  );
}

/* Signature — disabled for now
type CanvasSignatureProps = {
  value: string;
  isSealed?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onDismiss?: () => void;
  onSelectAllJournal?: () => void;
};

const CanvasSignature = forwardRef<HTMLTextAreaElement, CanvasSignatureProps>(
  function CanvasSignature(
    { value, isSealed = false, onChange, onBlur, onDismiss, onSelectAllJournal },
    ref
  ) {
  return (
    <textarea
      ref={ref}
      data-signature
      rows={1}
      spellCheck={false}
      readOnly={isSealed}
      tabIndex={isSealed ? -1 : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !isSealed) {
          e.preventDefault();
          onDismiss?.();
          return;
        }
        if (
          e.key.toLowerCase() === "a" &&
          (e.metaKey || e.ctrlKey) &&
          !e.altKey
        ) {
          e.preventDefault();
          onSelectAllJournal?.();
          const ta = e.currentTarget;
          ta.setSelectionRange(0, ta.value.length);
        }
      }}
      aria-label="Signature"
      placeholder="Your signature…"
      className="mt-16 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-left outline-none focus:outline-none"
      style={{
        fontFamily: "var(--font-signature), cursive",
        fontSize: WRITING_FONT_SIZE,
        lineHeight: WRITING_LINE_HEIGHT,
        letterSpacing: WRITING_LETTER_SPACING,
        wordSpacing: WRITING_WORD_SPACING,
        color: WRITING_INK,
      }}
      onInput={(e) => {
        const ta = e.currentTarget;
        ta.style.height = "auto";
        ta.style.height = `${ta.scrollHeight}px`;
      }}
    />
  );
});
*/
