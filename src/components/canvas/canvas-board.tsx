"use client";

/**
 * CanvasBoard — full-width journal writing surface.
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  title (left)                edited · saving? (right)        │
 *  │  ─────────────────────────────────────────────────────────── │
 *  │  centered writing column (Rethink Sans)                      │
 *  │  signature (end)                                             │
 *  │  🌻 fixed bottom-left                                        │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * Save model:
 *   - Snapshot is mirrored to localStorage shortly after each change so the
 *     user never loses keystrokes if the tab dies.
 *   - After 15s of typing inactivity, `onSave` fires with the latest snapshot
 *     (aligned with the companion trigger).
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
import Image from "next/image";
import {
  ImagePlus,
  List,
  ListChecks,
  Pilcrow,
  Trash2,
} from "lucide-react";
import { iconStrokePx } from "@/components/ui/button-system";
import { BOOK_TITLE_PLACEHOLDER } from "@/lib/book-title";
import BlobCharacter, {
  type BlobEmotion,
  type BlobPose,
  useBlobState,
} from "@/components/canvas/blob-character";
import { EntranceGreeting } from "@/components/canvas/blob/entrance-greeting";
import { useCompanion } from "@/hooks/use-companion";
import { getTextareaCaretOffsetInTextareaPx } from "@/lib/textarea-caret-offset";

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

const TEXT_COLUMN_GAP = 32;

/** Vertical breathing room at the top and bottom of the page. */
const PAGE_PADDING_Y = 88;
/** Keep active typing line comfortably above the viewport bottom. */
const SCROLL_COMFORT_BOTTOM = 72;

/** Writing typography — Rethink Sans, 16px body size (breathable). */
const WRITING_FONT_SIZE = "var(--text-md)";
const WRITING_LINE_HEIGHT = 1.75;
const WRITING_LETTER_SPACING = "0.005em";
const WRITING_WORD_SPACING = "0.005em";
const WRITING_INK = "var(--canvas-ink)";
const WRITING_PLACEHOLDER = "Start writing…";

/** Fixed journal slots — no ad-hoc blocks beyond this count. */
const MAX_WRITING_BLOCKS = 7;

const columnBlockCount = (col: JournalTextBlock[]) => col.length;

const firstEmptyBlockInColumn = (
  col: JournalTextBlock[]
): JournalTextBlock | null =>
  col.find((b) => b.text.length === 0) ?? null;

/** Filled blocks plus one trailing empty slot — avoids painting padded empty slots. */
const visibleBlocksInColumn = (
  col: JournalTextBlock[],
  activeBlockId: string | null
): JournalTextBlock[] => {
  let lastWithText = -1;
  for (let i = 0; i < col.length; i++) {
    if (col[i].text.length > 0) lastWithText = i;
  }
  const activeIdx =
    activeBlockId != null
      ? col.findIndex((b) => b.id === activeBlockId)
      : -1;
  const end = Math.min(
    col.length - 1,
    Math.max(lastWithText + 1, activeIdx >= 0 ? activeIdx + 1 : 0, 0)
  );
  return col.slice(0, end + 1);
};

/** Polaroid frame visual constants (tuned for the narrow 200px column). */
const POLAROID_PAD_X = 10;
const POLAROID_PAD_TOP = 10;
const POLAROID_PAD_BOTTOM = 22;
const POLAROID_GAP = 18;

/** Save behaviour. Local mirror is fast (no data loss); milestone save fires
 *  after 15s of typing inactivity (aligned with companion trigger). */
const LOCAL_MIRROR_DEBOUNCE_MS = 600;
/** Only surface "saving" when a mirror is still pending past the debounce. */
const SAVING_LABEL_DELAY_MS = 800;

/** Minimum selected-character count before the text format bar appears. */
const TEXT_CTX_SELECTION_MIN = 4;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const newId = () =>
  `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const arrayOrEmpty = <T,>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : [];

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const emptyParagraph = (): JournalTextBlock => ({
  id: newId(),
  blockKind: "paragraph",
  text: "",
});

const createWritingSlots = (count = MAX_WRITING_BLOCKS): JournalTextBlock[] =>
  Array.from({ length: count }, () => emptyParagraph());

/** Pad a column up to the fixed slot count without removing existing blocks. */
const padWritingSlots = (col: JournalTextBlock[]): JournalTextBlock[] => {
  if (col.length >= MAX_WRITING_BLOCKS) return col;
  const padded = col.slice();
  while (padded.length < MAX_WRITING_BLOCKS) {
    padded.push(emptyParagraph());
  }
  return padded;
};

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
  textColumns = textColumns.map((col, idx) =>
    idx === 0 ? padWritingSlots(col) : col
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

  return {
    version: CANVAS_SNAPSHOT_VERSION,
    textColumns,
    imageBlocks,
    background: CANVAS_BACKGROUND,
    columns,
    signature,
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

/**
 * Approximate x-offset (px) from the textarea's left border to `index`,
 * using canvas measureText — **fallback only** when mirror layout fails
 * (e.g. zero-width textarea); wrong for soft-wrap.
 */
const approxCharXInTextarea = (
  el: HTMLTextAreaElement,
  index: number
): number => {
  const cs = window.getComputedStyle(el);
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const padL = parseFloat(cs.paddingLeft) || 0;
  const safe = Math.max(0, Math.min(index, el.value.length));
  const before = el.value.slice(0, safe);
  const lineStart = before.lastIndexOf("\n") + 1;
  const linePrefix = before.slice(lineStart);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return padL;
  ctx.font = font;
  return padL + ctx.measureText(linePrefix).width - el.scrollLeft;
};

/**
 * Approximate Y — **fallback only**; newline × line-height (wrong for soft-wrap).
 */
const approxCaretYInTextarea = (
  el: HTMLTextAreaElement,
  index: number
): number => {
  const cs = window.getComputedStyle(el);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const lineHeight =
    parseFloat(cs.lineHeight) ||
    parseFloat(cs.fontSize) * WRITING_LINE_HEIGHT;
  const safe = Math.max(0, Math.min(index, el.value.length));
  const before = el.value.slice(0, safe);
  const newlineCount = (before.match(/\n/g) ?? []).length;
  return padTop + newlineCount * lineHeight - el.scrollTop;
};

/** Caret (left, top) inside the textarea border box; mirror div handles soft-wrap. */
const caretOffsetInTextarea = (
  el: HTMLTextAreaElement,
  index: number
): { left: number; top: number } => {
  try {
    const m = getTextareaCaretOffsetInTextareaPx(el, index);
    if (m) return m;
  } catch {
    /* mirror must never break typing / selection UI */
  }
  return {
    left: approxCharXInTextarea(el, index),
    top: approxCaretYInTextarea(el, index),
  };
};

/* -------------------------------------------------------------------------- */
/*  Top-level component                                                       */
/* -------------------------------------------------------------------------- */

type CanvasBoardProps = {
  /** Book id — scopes companion once-per-session guard. */
  bookId: string;
  storageKey: string;
  initialSnapshot?: CanvasSnapshot | null;
  /**
   * Fires whenever the local snapshot is mirrored to storage. High-frequency.
   * Parents typically use it to sync the dashboard "recents" timestamp.
   */
  onSnapshotChange?: (snapshot: CanvasSnapshot) => void;
  /**
   * Fires on milestone saves: 15s after typing stops.
   * This is the right place to trigger AI title regeneration.
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
  /** Book cover background (CSS) — used for a subtle 6% page tint. */
  coverBackground?: string;
};

/**
 * Imperative handle exposed via `ref`. Used by the page-level back button
 * to grab an in-memory snapshot and start the blob goodbye animation.
 * Heavy localStorage writes are deferred by the page until after navigation.
 */
export type CanvasBoardHandle = {
  captureForClose: () => CanvasSnapshot;
};

function CanvasBoardInner(
  {
    bookId,
    storageKey,
    initialSnapshot,
    onSnapshotChange,
    onSave,
    title,
    onTitleChange,
    sessionEditedAt,
    coverBackground,
  }: CanvasBoardProps,
  ref: React.ForwardedRef<CanvasBoardHandle>
) {
  const [textColumns, setTextColumns] = useState<JournalTextBlock[][]>(() => [
    createWritingSlots(),
  ]);
  const [imageBlocks, setImageBlocks] = useState<JournalImage[]>([]);
  const [signature, setSignature] = useState("");
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

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [rangeAnchorId, setRangeAnchorId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const outerRef = useRef<HTMLDivElement | null>(null);
  const writingRef = useRef<HTMLDivElement | null>(null);
  /** Scrollport for the writing column only — page / left rail stay fixed. */
  const writingScrollRef = useRef<HTMLDivElement | null>(null);
  const writingColumnRef = useRef<HTMLDivElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const textRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const hydratedRef = useRef(false);
  const [isContentReady, setIsContentReady] = useState(false);
  const focusAfterRender = useRef<{
    id: string;
    position: "start" | "end" | number;
  } | null>(null);

  /* ---------------------------- Blob companion ---------------------------- */

  const blob = useBlobState();

  /* ------------------------------ Hydration ------------------------------ */

  useLayoutEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    hydratedRef.current = true;

    const apply = (snap: CanvasSnapshot) => {
      // Collapse any legacy multi-column snapshots down to a single track so
      // the UI matches the simplified spec without losing existing content.
      setTextColumns(
        adjustColumns(snap.textColumns, 1).map((col, idx) =>
          idx === 0 ? padWritingSlots(col) : col
        )
      );
      setImageBlocks(snap.imageBlocks);
      setSignature(snap.signature ?? "");
      snapshotEditedAtRef.current = sessionEditedAt;
      setLastSavedAt(sessionEditedAt);
      const first = snap.textColumns[0]?.[0];
      if (first) {
        focusAfterRender.current = { id: first.id, position: "start" };
        setActiveBlockId(first.id);
      }
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

      const first = textColumns[0]?.[0];
      if (first) {
        focusAfterRender.current = { id: first.id, position: "start" };
        setActiveBlockId(first.id);
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
    // Merge live textarea values so the companion always sees the latest
    // keystroke (React state can lag one frame behind the DOM).
    const liveTextColumns = textColumns.map((col) =>
      col.map((block) => {
        const el = textRefs.current[block.id];
        if (!el || el.value === block.text) return block;
        return { ...block, text: el.value };
      })
    );

    return {
      version: CANVAS_SNAPSHOT_VERSION,
      textColumns: liveTextColumns,
      imageBlocks,
      background: CANVAS_BACKGROUND,
      columns,
      signature,
      updatedAt: snapshotEditedAtRef.current,
    };
  }, [columns, imageBlocks, signature, textColumns]);

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
      const snap = buildSnapshot();
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

  const companion = useCompanion({
    buildSnapshot,
    onMilestoneSave: triggerMilestoneSave,
    isContentReady,
    blob: {
      onActivity: blob.onActivity,
      onSessionEmotionDetected: blob.onSessionEmotionDetected,
      onEmotionFromWriting: blob.onEmotionFromWriting,
      onWakeFromSleep: blob.onWakeFromSleep,
    },
  });

  // Imperative seam used by the page-level back button: capture state in
  // memory and start the goodbye animation. The page navigates immediately
  // and persists to localStorage afterward so large snapshots don't block.
  useImperativeHandle(
    ref,
    () => ({
      captureForClose: () => {
        void blob.onClosing();
        snapshotEditedAtRef.current = Date.now();
        return buildSnapshot();
      },
    }),
    [buildSnapshot, blob]
  );

  /* --------------------------- Focus management --------------------------- */

  const focusBlock = useCallback(
    (id: string, position: "start" | "end" | number = "end") => {
      focusAfterRender.current = { id, position };
    },
    []
  );

  useEffect(() => {
    const target = focusAfterRender.current;
    if (!target) return;
    const ta = textRefs.current[target.id];
    if (!ta) return;
    focusAfterRender.current = null;
    ta.focus({ preventScroll: false });
    const len = ta.value.length;
    const point =
      typeof target.position === "number"
        ? clamp(target.position, 0, len)
        : target.position === "start"
          ? 0
          : len;
    ta.setSelectionRange(point, point);
  });

  /* --------------------------- Block mutations --------------------------- */

  const updateTextBlock = useCallback(
    (id: string, patch: Partial<JournalTextBlock>) => {
      setTextColumns((cols) =>
        cols.map((col) =>
          col.map((b) => (b.id === id ? { ...b, ...patch } : b))
        )
      );
    },
    []
  );

  const setBlockKind = useCallback(
    (id: string, kind: TextBlockKind, batchIds?: string[]) => {
      const targets = batchIds && batchIds.length > 1 ? batchIds : null;
      if (targets) {
        setTextColumns((cols) =>
          cols.map((col) =>
            col.map((b) => {
              if (!targets.includes(b.id)) return b;
              if (kind === "checklist")
                return {
                  ...b,
                  blockKind: "checklist",
                  checked: b.checked ?? false,
                };
              return { ...b, blockKind: kind, checked: undefined };
            })
          )
        );
        setSelectedBlockIds([id]);
        return;
      }

      let focusNextId: string | null = null;

      setTextColumns((cols) =>
        cols.map((col) => {
          const i = col.findIndex((b) => b.id === id);
          if (i === -1) return col;

          const block = col[i];
          const el = textRefs.current[id];
          const v = el?.value ?? block.text;
          const s0 = el?.selectionStart ?? 0;
          const s1 = el?.selectionEnd ?? 0;
          const lo = Math.min(s0, s1);
          const hi = Math.max(s0, s1);
          const selected = v.slice(lo, hi);
          const hasRange = lo !== hi;

          if (
            el &&
            hasRange &&
            (kind === "bullet" || kind === "checklist") &&
            selected.includes("\n")
          ) {
            const before = v.slice(0, lo);
            const after = v.slice(hi);
            let lines = selected.split("\n");
            if (lines.length > 1 && lines[lines.length - 1] === "")
              lines = lines.slice(0, -1);

            const inserts: JournalTextBlock[] = [];
            if (before.length > 0) {
              inserts.push({
                ...block,
                id,
                blockKind: "paragraph",
                text: before,
                checked: undefined,
              });
            }
            lines.forEach((lineText, idx) => {
              inserts.push({
                id: before.length === 0 && idx === 0 ? id : newId(),
                blockKind: kind,
                text: lineText,
                checked: kind === "checklist" ? false : undefined,
              });
            });
            if (after.length > 0) {
              inserts.push({ ...emptyParagraph(), text: after });
            }
            if (inserts.length === 0) {
              inserts.push({
                ...block,
                id,
                blockKind: kind,
                text: "",
                checked: kind === "checklist" ? false : undefined,
              });
            }
            const firstList = inserts.find((b) => b.blockKind === kind);
            if (firstList) focusNextId = firstList.id;

            return [...col.slice(0, i), ...inserts, ...col.slice(i + 1)];
          }

          return col.map((b) => {
            if (b.id !== id) return b;
            if (kind === "checklist") {
              return {
                ...b,
                blockKind: "checklist",
                checked: b.checked ?? false,
              };
            }
            return { ...b, blockKind: kind, checked: undefined };
          });
        })
      );

      if (focusNextId) {
        focusBlock(focusNextId, "end");
        setShowTextCtx(false);
      }
    },
    [focusBlock]
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

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void insertImageFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [insertImageFile]);

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

  /* --------------------- Click on column whitespace ---------------------- */

  const focusSlotInColumn = useCallback((columnIndex: number) => {
    setTextColumns((cols) => {
      const col = cols[columnIndex];
      if (!col || col.length === 0) return cols;
      const target =
        firstEmptyBlockInColumn(col) ?? col[col.length - 1];
      focusAfterRender.current = {
        id: target.id,
        position: target.text.length === 0 ? "start" : "end",
      };
      return cols;
    });
  }, []);

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

  const activeColumnBlocks = useMemo<JournalTextBlock[]>(() => {
    if (!activeBlockId) return [];
    for (const col of textColumns) {
      if (col.some((b) => b.id === activeBlockId)) return col;
    }
    return [];
  }, [activeBlockId, textColumns]);

  // Whether the text contextual bar is currently visible.
  const [showTextCtx, setShowTextCtx] = useState(false);
  const [textCtxPos, setTextCtxPos] = useState<{ x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    const onSelectionChange = () => {
      const el = activeBlockId ? textRefs.current[activeBlockId] : null;
      if (!el || el !== document.activeElement) {
        setShowTextCtx(false);
        return;
      }
      const len = (el.selectionEnd ?? 0) - (el.selectionStart ?? 0);
      if (len >= TEXT_CTX_SELECTION_MIN) {
        const r = el.getBoundingClientRect();
        const anchorIdx = Math.min(
          el.selectionStart ?? 0,
          el.selectionEnd ?? 0
        );
        const { left: relX } = caretOffsetInTextarea(el, anchorIdx);
        const inField =
          r.left + Math.min(Math.max(relX, 4), Math.max(4, r.width - 4));
        const popoverGuessW = 160;
        const left = Math.max(
          8,
          Math.min(inField, window.innerWidth - popoverGuessW - 8)
        );
        setTextCtxPos({ x: left, y: r.top });
        setShowTextCtx(true);
      } else {
        setShowTextCtx(false);
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [activeBlockId]);

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
        setSelectedBlockIds((ids) => (ids.length <= 1 ? ids : ids.slice(-1)));
        setSelectedImageId(null);
      }
    };
    window.addEventListener("pointerdown", hide);
    return () => window.removeEventListener("pointerdown", hide);
  }, []);

  /* ---------------------------- Surface gestures -------------------------- */

  const onWritingPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-block-element]")) return;
      if (target.closest("[data-signature]")) return;
      if (!target.closest("[data-writing-zone]")) return;

      const col = target.closest("[data-text-column]");
      let columnIndex = 0;
      if (col instanceof HTMLElement) {
        const idx = Number(col.dataset.textColumn);
        if (Number.isFinite(idx)) columnIndex = idx;
      }

      e.preventDefault();
      focusSlotInColumn(columnIndex);
      setSelectedImageId(null);
    },
    [focusSlotInColumn]
  );

  /* ------------------------------- Render ------------------------------- */

  return (
    <div
      ref={outerRef}
      className="relative flex h-svh min-h-0 w-full flex-col overflow-hidden"
      style={{
        background: CANVAS_BACKGROUND,
        color: WRITING_INK,
        caretColor: WRITING_INK,
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Sunflower — fixed bottom-left, always on screen */}
      <div className="pointer-events-auto fixed bottom-5 left-5 z-20 flex flex-col items-start gap-2 overflow-visible">
        {/* Entrance greeting — sits to the right of the peeking flower. */}
        {blob.greeting ? (
          <EntranceGreeting
            visible={blob.greetingVisible}
            peeking={blob.pose === "peek"}
          >
            {blob.greeting}
          </EntranceGreeting>
        ) : null}
        <BlobCharacter
          pose={blob.pose}
          emotion={blob.emotion}
          hidden={blob.hidden}
        />
      </div>

      {/* —————————— Full-width centered writing area —————————— */}
      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
        ref={writingRef}
        onPointerDown={(e) => {
          companion.onCanvasActivity();
          onWritingPointerDown(e);
        }}
      >
        <div
          ref={writingScrollRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
          onScroll={() => companion.onCanvasActivity()}
          style={{
            paddingTop: PAGE_PADDING_Y,
            paddingBottom: PAGE_PADDING_Y,
            scrollPaddingTop: PAGE_PADDING_Y,
            scrollPaddingBottom: PAGE_PADDING_Y + SCROLL_COMFORT_BOTTOM,
          }}
        >
          <div
            className="mx-auto flex w-full shrink-0 flex-col px-6"
            style={{ maxWidth: WRITING_COLUMN_MAX_WIDTH }}
          >
            <CanvasHeader
              title={title}
              editedAt={headerDisplayedAt}
              showSaving={showSavingLabel}
              onTitleChange={onTitleChange}
            />

            <div
              ref={writingColumnRef}
              data-writing-zone
              className="relative flex w-full shrink-0 flex-col"
              style={{
                gap: TEXT_COLUMN_GAP,
                ["--writing-rule-step" as string]: `calc(${WRITING_FONT_SIZE} * ${WRITING_LINE_HEIGHT})`,
              }}
            >
          {textColumns.map((col, colIdx) => (
            <div
              key={colIdx}
              data-text-column={colIdx}
              className="flex min-w-0 shrink-0 flex-col"
            >
              {visibleBlocksInColumn(col, activeBlockId).map((block) => (
                <TextBlockView
                  key={block.id}
                  block={block}
                  isActive={activeBlockId === block.id}
                  isInRange={selectedBlockIds.includes(block.id)}
                  registerRef={(el) => {
                    textRefs.current[block.id] = el;
                  }}
                  onFocus={() => {
                    setActiveBlockId(block.id);
                    setRangeAnchorId(block.id);
                    setSelectedBlockIds([block.id]);
                    setSelectedImageId(null);
                  }}
                  onShiftFocus={() => {
                    if (!rangeAnchorId) return;
                    const ids = activeColumnBlocks.map((b) => b.id);
                    const ai = ids.indexOf(rangeAnchorId);
                    const bi = ids.indexOf(block.id);
                    if (ai === -1 || bi === -1) return;
                    const lo = Math.min(ai, bi);
                    const hi = Math.max(ai, bi);
                    setSelectedBlockIds(ids.slice(lo, hi + 1));
                    setActiveBlockId(block.id);
                  }}
                  onChange={(text) => {
                    updateTextBlock(block.id, { text });
                    companion.onWritingActivity();
                  }}
                  onToggleCheck={() =>
                    updateTextBlock(block.id, { checked: !block.checked })
                  }
                  onEnter={(splitAt) => {
                    companion.onWritingActivity();
                    const left = block.text.slice(0, splitAt);
                    const right = block.text.slice(splitAt);
                    if (
                      block.text.length === 0 &&
                      block.blockKind !== "paragraph"
                    ) {
                      updateTextBlock(block.id, {
                        blockKind: "paragraph",
                        checked: undefined,
                      });
                      return;
                    }

                    const loc = (() => {
                      for (let c = 0; c < textColumns.length; c++) {
                        const i = textColumns[c].findIndex(
                          (b) => b.id === block.id
                        );
                        if (i !== -1) return { c, i };
                      }
                      return null;
                    })();
                    if (!loc) return;

                    const col = textColumns[loc.c];
                    const nextIdx = loc.i + 1;

                    // Fixed slots: Enter moves to the next line (block below).
                    if (nextIdx < col.length) {
                      const below = col[nextIdx];
                      setTextColumns((cols) => {
                        const updated = cols.map((c) => c.slice());
                        updated[loc.c][loc.i] = { ...block, text: left };
                        updated[loc.c][nextIdx] = {
                          ...below,
                          text: right + below.text,
                        };
                        return updated;
                      });
                      focusBlock(below.id, right.length);
                      return;
                    }

                    // Room for another slot — split into a new block.
                    if (columnBlockCount(col) < MAX_WRITING_BLOCKS) {
                      const next: JournalTextBlock = {
                        id: newId(),
                        blockKind: block.blockKind,
                        text: right,
                        checked:
                          block.blockKind === "checklist" ? false : undefined,
                      };
                      setTextColumns((cols) => {
                        const updated = cols.map((c) => c.slice());
                        updated[loc.c][loc.i] = { ...block, text: left };
                        updated[loc.c].splice(loc.i + 1, 0, next);
                        return updated;
                      });
                      focusBlock(next.id, "start");
                      return;
                    }

                    // Last slot — soft line break within the same field.
                    updateTextBlock(block.id, { text: `${left}\n${right}` });
                    focusBlock(block.id, splitAt + 1);
                  }}
                  onBackspaceAtStart={() => {
                    companion.onWritingActivity();
                    if (
                      block.blockKind !== "paragraph" &&
                      block.text.length === 0
                    ) {
                      updateTextBlock(block.id, {
                        blockKind: "paragraph",
                        checked: undefined,
                      });
                      return;
                    }
                    setTextColumns((cols) => {
                      const loc = (() => {
                        for (let c = 0; c < cols.length; c++) {
                          const i = cols[c].findIndex(
                            (b) => b.id === block.id
                          );
                          if (i !== -1) return { c, i };
                        }
                        return null;
                      })();
                      if (!loc || loc.i === 0) return cols;
                      const prev = cols[loc.c][loc.i - 1];
                      const merged: JournalTextBlock = {
                        ...prev,
                        text: prev.text + block.text,
                      };
                      const updated = cols.map((c) => c.slice());
                      updated[loc.c][loc.i - 1] = merged;
                      updated[loc.c].splice(loc.i, 1);
                      focusAfterRender.current = {
                        id: merged.id,
                        position: "end",
                      };
                      return updated;
                    });
                  }}
                />
              ))}
            </div>
          ))}
            </div>

            <CanvasSignature
              value={signature}
              onChange={(next) => {
                setSignature(next);
                companion.onWritingActivity();
              }}
            />
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
      {(showTextCtx || selectedBlockIds.length > 1) &&
        textCtxPos &&
        activeBlockId && (
          <div
            data-ctx
            className="pointer-events-auto fixed z-40 -translate-y-full"
            style={{ left: textCtxPos.x, top: textCtxPos.y - 8 }}
          >
            <div
              className="flex items-center gap-0.5 rounded-xl border border-black/[0.06] bg-white/95 px-1.5 py-1 shadow-[0_4px_20px_rgba(15,15,15,0.10)] backdrop-blur-md"
              style={{
                fontFamily:
                  "var(--font-body)",
              }}
            >
              {selectedBlockIds.length > 1 && (
                <span className="mr-0.5 rounded-md bg-black/[0.06] px-1.5 py-0.5 text-xs font-medium text-black/50">
                  {selectedBlockIds.length} rows
                </span>
              )}
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
                  title={label}
                  onClick={() =>
                    setBlockKind(
                      activeBlockId,
                      kind,
                      selectedBlockIds.length > 1
                        ? selectedBlockIds
                        : undefined
                    )
                  }
                  className={clsx(
                    "inline-flex h-7 w-7 items-center justify-center rounded-lg transition",
                    activeTextKind === kind
                      ? "bg-black/10 text-[var(--color-canvas-toolbar-icon)]"
                      : "text-[var(--color-canvas-toolbar-icon)]/70 hover:bg-black/[0.05] hover:text-[var(--color-canvas-toolbar-icon)]"
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
/*  ImageStack — left panel of polaroids                                        */
/* -------------------------------------------------------------------------- */

type ImageStackProps = {
  images: JournalImage[];
  selectedImageId: string | null;
  blobPose: BlobPose;
  blobEmotion: BlobEmotion;
  blobHidden: boolean;
  recessBackground: string;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<JournalImage>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
};

/** Fixed height of the two-polaroid stack — container never grows. */
const STACK_HEIGHT_PX = 300;
/** Front polaroid — reference top card: rotate(+10.17deg). */
const FRONT_TILT_DEG = 6;
/** Back polaroid — reference card below: rotate(-4.49deg). */
const BACK_TILT_DEG = -8;
/** Back card offset (++ x, ++ y) so it peeks behind the front. */
const BACK_NUDGE_X_PX = 6;
const BACK_NUDGE_Y_PX = 8;
const STACK_SWAP_MS = 700;
const STACK_SWAP_TRANSITION = `transform ${STACK_SWAP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
const POLAROID_SLOTS = [0, 1] as const;

function ImageStack({
  images,
  selectedImageId,
  blobPose,
  blobEmotion,
  blobHidden,
  recessBackground,
  onSelect,
  onUpdate,
  onRemove,
  onAdd,
}: ImageStackProps) {
  // Which of the two slots is displayed in front (0 = first slot, 1 = second).
  const [frontSlot, setFrontSlot] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bringForward = useCallback(
    (slotIdx: number) => {
      if (slotIdx === frontSlot || isSwapping) return;
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
      setIsSwapping(true);
      // Let the browser paint the current transform before applying the new
      // targets — avoids the instant "snap" on click.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFrontSlot(slotIdx);
        });
      });
      swapTimerRef.current = setTimeout(() => {
        setIsSwapping(false);
        swapTimerRef.current = null;
      }, STACK_SWAP_MS + 50);
    },
    [frontSlot, isSwapping]
  );

  useEffect(
    () => () => {
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    },
    []
  );

  const ordered = useMemo(() => {
    return [...images]
      .sort(
        (a, b) => (a.order ?? images.indexOf(a)) - (b.order ?? images.indexOf(b))
      )
      .slice(0, 2);
  }, [images]);

  return (
    <div
      className="relative z-10 flex shrink-0 flex-col items-center self-end"
      style={{
        width: "20%",
        margin: 12,
        position: "sticky",
        bottom: 20,
      }}
    >
      <div className="pointer-events-auto flex w-full justify-left">
        <BlobCharacter
          pose={blobPose}
          emotion={blobEmotion}
          hidden={blobHidden}
        />
      </div>

      {/* <aside
        aria-label="Image column"
        className="w-full rounded-[22px]"
        style={{
          padding: 32,
          background: recessBackground,
        }}
      >
        <div
          className="flex flex-col items-center justify-end"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-polaroid]")) return;
            onSelect(null);
          }}
        >
        
          <div
            className="relative w-full shrink-0 overflow-visible"
            style={{ height: STACK_HEIGHT_PX, perspective: 1200 }}
          >
          {POLAROID_SLOTS.map((slotIdx) => {
            const isFront = slotIdx === frontSlot;
            const tilt = isFront ? FRONT_TILT_DEG : BACK_TILT_DEG;
            const nudgeX = isFront ? 0 : BACK_NUDGE_X_PX;
            const nudgeY = isFront ? 0 : BACK_NUDGE_Y_PX;
            const depthZ = isFront ? 32 : 0;
            const img = ordered[slotIdx] ?? null;

            return (
              <div
                key={slotIdx}
                data-polaroid
                className="absolute"
                style={{
                  width: "80%",
                  left: "50%",
                  top: "50%",
                  transform: `translate3d(calc(-50% + ${nudgeX}px), calc(-50% + ${nudgeY}px), ${depthZ}px) rotate(${tilt}deg)`,
                  transformOrigin: "50% 50%",
                  zIndex: 1,
                  cursor: isSwapping ? "default" : "pointer",
                  transition: STACK_SWAP_TRANSITION,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isFront) {
                    bringForward(slotIdx);
                  } else if (img) {
                    onSelect(img.id);
                  } else {
                    onAdd();
                  }
                }}
              >
                {img ? (
                  <PolaroidImage
                    block={img}
                    selected={selectedImageId === img.id}
                    onSelect={() => onSelect(img.id)}
                    onUpdate={(patch) => onUpdate(img.id, patch)}
                    onRemove={() => onRemove(img.id)}
                  />
                ) : (
                  <PolaroidPlaceholder />
                )}
              </div>
            );
          })}
          </div>
        </div>
      </aside> */}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  PolaroidPlaceholder — empty slot; click-to-upload handled by parent        */
/* -------------------------------------------------------------------------- */

function PolaroidPlaceholder() {
  return (
    <div
      className="group relative flex w-full cursor-pointer flex-col rounded-[6px] bg-white shadow-[0_8px_28px_rgba(15,15,15,0.14),0_2px_8px_rgba(15,15,15,0.08)] transition hover:shadow-[0_12px_32px_rgba(15,15,15,0.16)]"
      style={{
        aspectRatio: "4 / 4.6",
        paddingLeft: POLAROID_PAD_X,
        paddingRight: POLAROID_PAD_X,
        paddingTop: POLAROID_PAD_TOP,
        paddingBottom: POLAROID_PAD_BOTTOM,
      }}
    >
      {/* Photo area */}
      <div className="relative w-full flex-1 overflow-hidden rounded-[3px] bg-black/[0.05] transition-colors group-hover:bg-black/[0.08]">
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/60 text-black/20 shadow-sm transition-all duration-200 group-hover:bg-white/90 group-hover:text-black/45 group-hover:shadow-md">
            <ImagePlus size={16} strokeWidth={iconStrokePx(16)} />
          </span>
        </span>
      </div>

      {/* Bottom caption strip — journal-appropriate placeholder text */}
      <span
        aria-hidden
        className="mt-2 block w-full shrink-0 text-center text-xs italic text-black/20 transition-colors duration-200 group-hover:text-black/35"
        style={{
          fontFamily: "var(--font-body)",
        }}
      >
        add a memory
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Polaroid — single stacked image with caption                              */
/* -------------------------------------------------------------------------- */

type PolaroidImageProps = {
  block: JournalImage;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<JournalImage>) => void;
  onRemove: () => void;
};

function PolaroidImage({
  block,
  selected,
  onSelect,
  onUpdate,
  onRemove,
}: PolaroidImageProps) {
  return (
    <figure
      className={clsx(
        "relative flex w-full cursor-pointer flex-col rounded-[6px] bg-white shadow-[0_8px_28px_rgba(15,15,15,0.14),0_2px_8px_rgba(15,15,15,0.08)] transition",
        selected && "ring-2 ring-black/15"
      )}
      style={{
        aspectRatio: "4 / 5",
        paddingLeft: POLAROID_PAD_X,
        paddingRight: POLAROID_PAD_X,
        paddingTop: POLAROID_PAD_TOP,
        paddingBottom: POLAROID_PAD_BOTTOM,
      }}
    >
      <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-[3px] bg-black/[0.04]">
        <Image
          src={block.src}
          alt={block.caption ?? ""}
          fill
          unoptimized
          draggable={false}
          className="select-none object-cover"
        />
      </div>

      <figcaption className="mt-2 w-full shrink-0">
        <input
          type="text"
          value={block.caption ?? ""}
          placeholder="add a caption"
          onChange={(e) => onUpdate({ caption: e.target.value || undefined })}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onFocus={onSelect}
          className="w-full border-0 bg-transparent p-0 text-center text-xs italic tracking-tight text-[var(--canvas-ink-secondary)] outline-none placeholder:text-[var(--canvas-writing-placeholder)]"
          style={{
            fontFamily: "var(--font-body)",
          }}
        />
      </figcaption>

      {selected && (
        <button
          type="button"
          aria-label="Remove image"
          title="Remove image"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white text-black/55 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition hover:text-red-500"
        >
          <Trash2 size={12} strokeWidth={iconStrokePx(12)} />
        </button>
      )}
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/*  Canvas header — last-edited date + heading                                   */
/* -------------------------------------------------------------------------- */

const isSameCalendarMonth = (ts: number, now: number) => {
  const d = new Date(ts);
  const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
};

/** Header stamp — e.g. "Edited 12 min" (this month) or "Edited 26 Mar". */
function formatEditedLabel(ts: number, now = Date.now()): string {
  if (isSameCalendarMonth(ts, now)) {
    const diff = Math.max(0, now - ts);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return "Edited just now";
    if (diff < hour) {
      const mins = Math.round(diff / minute);
      return `Edited ${mins} min`;
    }
    if (diff < day) {
      const hours = Math.round(diff / hour);
      return `Edited ${hours} hr`;
    }
    const days = Math.round(diff / day);
    return `Edited ${days} day${days === 1 ? "" : "s"}`;
  }

  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "short" });
  const year = d.getFullYear();
  if (year !== new Date(now).getFullYear()) {
    return `Edited ${day} ${month} ${year}`;
  }
  return `Edited ${day} ${month}`;
}

type CanvasHeaderProps = {
  title?: string;
  /** Session-frozen stamp from the parent (last close, or now on first open). */
  editedAt: number;
  showSaving?: boolean;
  onTitleChange?: (title: string) => void;
};

function CanvasHeader({
  title,
  editedAt,
  showSaving = false,
  onTitleChange,
}: CanvasHeaderProps) {
  const committedTitle =
    typeof title === "string" ? title.trim() : "";
  const [value, setValue] = useState(committedTitle);
  const hasTitle = value.trim().length > 0;

  useEffect(() => {
    setValue(committedTitle);
  }, [committedTitle]);

  const commitTitle = useCallback(() => {
    const next = value.trim();
    if (next !== committedTitle) {
      onTitleChange?.(next);
    }
  }, [committedTitle, onTitleChange, value]);

  useEffect(() => {
    if (!onTitleChange) return;
    const next = value.trim();
    if (next === committedTitle) return;
    const timer = window.setTimeout(() => onTitleChange(next), 400);
    return () => window.clearTimeout(timer);
  }, [committedTitle, onTitleChange, value]);

  const relativeTickActive = useMemo(
    () => isSameCalendarMonth(editedAt, Date.now()),
    [editedAt]
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!relativeTickActive) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [relativeTickActive]);

  const editedLabel = useMemo(
    () => formatEditedLabel(editedAt, now),
    [editedAt, now]
  );
  const isoDate = useMemo(
    () => new Date(editedAt).toISOString().slice(0, 10),
    [editedAt]
  );

  return (
    <header
      className="mb-14 grid w-full grid-cols-[1fr_auto] items-end gap-x-10 gap-y-1"
      style={{
        fontFamily:
          "var(--font-body)",
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commitTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        placeholder={BOOK_TITLE_PLACEHOLDER}
        spellCheck={false}
        aria-label="Book title"
        className={clsx(
          "header-lg col-start-1 row-start-1 w-full max-w-[55%] self-end border-0 bg-transparent p-0 text-left font-semibold tracking-tight outline-none focus:outline-none placeholder:text-[var(--canvas-title-placeholder)]",
          hasTitle ? "text-[var(--canvas-title-ink)]" : "text-[var(--canvas-title-placeholder)]"
        )}
        style={{ fontFamily: "var(--font-heading)" }}
      />
      <time
        dateTime={isoDate}
        className="col-start-2 row-start-1 block text-right text-sm tracking-[0.01em] text-[var(--canvas-date)]"
        style={{ lineHeight: 1.45 }}
      >
        {editedLabel}
      </time>
      {showSaving ? (
        <p
          aria-live="polite"
          className="col-start-2 row-start-2 block text-right text-sm tracking-[0.01em] text-[var(--canvas-time)]"
          style={{ lineHeight: 1.45 }}
        >
          saving
        </p>
      ) : null}
    </header>
  );
}

type CanvasSignatureProps = {
  value: string;
  onChange: (value: string) => void;
};

function CanvasSignature({ value, onChange }: CanvasSignatureProps) {
  return (
    <textarea
      data-signature
      rows={1}
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Signature"
      className="mt-16 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-left outline-none focus:outline-none"
      style={{
        fontFamily: "var(--font-body)",
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
}

/* -------------------------------------------------------------------------- */
/*  Text block                                                                */
/* -------------------------------------------------------------------------- */

type TextBlockViewProps = {
  block: JournalTextBlock;
  isActive: boolean;
  isInRange: boolean;
  registerRef: (el: HTMLTextAreaElement | null) => void;
  onFocus: () => void;
  onShiftFocus: () => void;
  onChange: (text: string) => void;
  onToggleCheck: () => void;
  onEnter: (splitAt: number) => void;
  onBackspaceAtStart: () => void;
};

function TextBlockView({
  block,
  isActive,
  isInRange,
  registerRef,
  onFocus,
  onShiftFocus,
  onChange,
  onToggleCheck,
  onEnter,
  onBackspaceAtStart,
}: TextBlockViewProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      taRef.current = el;
      registerRef(el);
    },
    [registerRef]
  );

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [block.text, block.blockKind]);

  const showMarker = block.blockKind !== "paragraph";

  const placeholder =
    !isActive || block.text.length > 0
      ? ""
      : block.blockKind === "bullet"
        ? "List item"
        : block.blockKind === "checklist"
          ? "To-do"
          : WRITING_PLACEHOLDER;

  return (
    <div
      data-block-element="text"
      dir="ltr"
      className={clsx(
        "relative flex w-full items-start gap-3 rounded-md leading-relaxed transition-colors",
        isInRange && !isActive ? "bg-black/[0.04]" : ""
      )}
      onMouseDown={(e) => {
        if (e.shiftKey) {
          e.preventDefault();
          onShiftFocus();
        }
      }}
    >
      {showMarker && (
        <div
          className="flex shrink-0 select-none items-start"
          style={{ paddingTop: 10 }}
          aria-hidden={block.blockKind === "bullet"}
        >
          {block.blockKind === "bullet" ? (
            <span className="text-lg leading-none opacity-60">
              •
            </span>
          ) : (
            <button
              type="button"
              onClick={onToggleCheck}
              aria-label={block.checked ? "Mark incomplete" : "Mark complete"}
              className={clsx(
                "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all duration-150",
                block.checked
                  ? "border-black/70 bg-black/80"
                  : "border-black/25 hover:border-black/50"
              )}
            >
              {block.checked && (
                <svg
                  viewBox="0 0 14 14"
                  className="h-3 w-3"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2.5 7l3 3 6-6" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}

      <textarea
        ref={setRefs}
        dir="ltr"
        value={block.text}
        rows={1}
        spellCheck
        placeholder={placeholder}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            const ta = e.currentTarget;
            onEnter(ta.selectionStart ?? ta.value.length);
            return;
          }
          if (
            e.key === "Backspace" &&
            !e.shiftKey &&
            !e.metaKey &&
            !e.ctrlKey
          ) {
            const ta = e.currentTarget;
            const start = ta.selectionStart ?? 0;
            const end = ta.selectionEnd ?? 0;
            if (start === 0 && end === 0) {
              e.preventDefault();
              onBackspaceAtStart();
              return;
            }
          }
        }}
        className={clsx(
          "block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:outline-none placeholder:text-[var(--canvas-writing-placeholder)]",
          block.blockKind === "checklist" && block.checked
            ? "text-[var(--canvas-muted)] line-through decoration-[color-mix(in_srgb,var(--canvas-ink)_30%,transparent)] decoration-[1.5px]"
            : ""
        )}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: WRITING_FONT_SIZE,
          lineHeight: WRITING_LINE_HEIGHT,
          letterSpacing: WRITING_LETTER_SPACING,
          wordSpacing: WRITING_WORD_SPACING,
          color: WRITING_INK,
          textAlign: "left",
        }}
      />
    </div>
  );
}
