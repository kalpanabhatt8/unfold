"use client";

/**
 * CanvasBoard — calm two-zone writing surface.
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  ┌─ image panel ─┐    │  Heading + meta strip               │
 *  │  │ ▢ polaroid    │    │  ───────────────────────────────    │
 *  │  │   ▢ polaroid  │    │  writing zone (≤ 600px)             │
 *  │  │ ▢ polaroid    │    │  Lora 20px · single column          │
 *  │  └───────────────┘    │  blob follows cursor                │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * Image input model:
 *   - The left panel always shows at least three slots.
 *   - Empty slots are clickable placeholders that reveal an upload icon
 *     on hover and trigger the hidden multi-file picker.
 *   - Paste + drag/drop on the canvas still work as a fallback.
 *
 * Header strip (top of writing zone) is intentional anti-empty-state:
 *   - book title acts as a calm "Heading"
 *   - a thin meta line shows "Saved Xm ago · Last opened Yd ago"
 *   - both update on a 30s tick so the relative times stay fresh
 *
 * Save model:
 *   - Snapshot is mirrored to localStorage shortly after each change so the
 *     user never loses keystrokes if the tab dies.
 *   - Every 30s — and on any explicit save — `onSave` fires with the latest
 *     snapshot, which is the moment a parent can run AI title generation.
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
  Save,
  Trash2,
} from "lucide-react";
import { iconStrokePx } from "@/components/ui/button-system";
import BlobCharacter, { useBlobState } from "@/components/canvas/blob-character";
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
  updatedAt: number;
};

/* -------------------------------------------------------------------------- */
/*  Visual constants                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Writing surface — swap any pair below (all subtle, no green cast).
 *
 *  Blush paper (active)  #F8F5F2 / #F1EDE9  — soft peach-grey, matches cheek blush
 *  Sun ivory             #FAF8F5 / #F2EFE9  — golden-white, hugs yellow petals
 *  Cool stone            #F6F6F4 / #EEEDEA  — neutral grey, yellow pops more
 *  Warm linen            #F7F5F1 / #EFEBE6  — honey undertone (previous)
 */
export const CANVAS_BACKGROUND = "#fafafa";
export const CANVAS_RECESS = "#F6F6F6";

/** Width allotted to the writing zone per column count (CSS values). */
const WRITING_WIDTH_CSS: Record<ColumnLayout, string> = {
  1: "min(92vw, 600px)",
  2: "min(92vw, 720px)",
  3: "min(94vw, 900px)",
};

const TEXT_COLUMN_GAP = 32;

/** Vertical breathing room at the top and bottom of the page. */
const PAGE_PADDING_Y = 88;

/** Writing typography (matches product spec). */
const WRITING_FONT_SIZE = 20;
const WRITING_LINE_HEIGHT = 1.7;
const WRITING_INK = "#2C2C2A";
const PLACEHOLDER_INK = "#B0ABA6";

/** Polaroid frame visual constants (tuned for the narrow 200px column). */
const POLAROID_PAD_X = 10;
const POLAROID_PAD_TOP = 10;
const POLAROID_PAD_BOTTOM = 22;
const POLAROID_GAP = 18;

/** Save behaviour. Local mirror is fast (no data loss); milestone save fires
 *  the AI title hook at a calm 30s cadence (or on manual save). */
const LOCAL_MIRROR_DEBOUNCE_MS = 600;
const MILESTONE_SAVE_INTERVAL_MS = 30_000;

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
    return cols.map((c) => (c.length > 0 ? c : [emptyParagraph()]));
  }

  if (target > current) {
    const next = cols.map((c) => (c.length > 0 ? c : [emptyParagraph()]));
    while (next.length < target) next.push([emptyParagraph()]);
    return next;
  }

  // target < current
  const kept = cols.slice(0, target - 1).map((c) => c.slice());
  const tailMerged = cols.slice(target - 1).flat();
  kept.push(tailMerged.length > 0 ? tailMerged : [emptyParagraph()]);
  return kept;
};

/* -------------------------------------------------------------------------- */
/*  Snapshot helpers                                                          */
/* -------------------------------------------------------------------------- */

export const emptySnapshot = (): CanvasSnapshot => ({
  version: CANVAS_SNAPSHOT_VERSION,
  textColumns: [[emptyParagraph()]],
  imageBlocks: [],
  background: CANVAS_BACKGROUND,
  columns: 1,
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
    textColumns.length === 0 ? [[emptyParagraph()]] : textColumns,
    columns
  );

  const imageBlocks = arrayOrEmpty<unknown>(value.imageBlocks)
    .map(sanitizeImage)
    .filter((b): b is JournalImage => Boolean(b));

  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : Date.now();

  return {
    version: CANVAS_SNAPSHOT_VERSION,
    textColumns,
    imageBlocks,
    background: CANVAS_BACKGROUND,
    columns,
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
  storageKey: string;
  initialSnapshot?: CanvasSnapshot | null;
  /**
   * Fires whenever the local snapshot is mirrored to storage. High-frequency.
   * Parents typically use it to sync the dashboard "recents" timestamp.
   */
  onSnapshotChange?: (snapshot: CanvasSnapshot) => void;
  /**
   * Fires on milestone saves: every 30s and on manual / before-close.
   * This is the right place to trigger AI title regeneration.
   */
  onSave?: (snapshot: CanvasSnapshot) => void;
  /**
   * Book title shown as the "Heading" at the top of the writing zone.
   * Falls back to a placeholder when empty so the strip is never blank.
   */
  title?: string;
  /**
   * Timestamp from the *previous* canvas open (null = first time). Drives
   * the "Last opened Xd ago" line in the meta strip. The current open is
   * intentionally not used — "Last opened just now" reads wrong on entry.
   */
  previousOpenedAt?: number | null;
};

/**
 * Imperative handle exposed via `ref`. Used by the page-level back button
 * to play the blob's goodbye wave and run a final milestone save before
 * navigation. The returned promise resolves once the animation has visually
 * settled, so the parent can `await` it before changing routes.
 */
export type CanvasBoardHandle = {
  prepareForClose: () => Promise<void>;
};

function CanvasBoardInner(
  {
    storageKey,
    initialSnapshot,
    onSnapshotChange,
    onSave,
    title,
    previousOpenedAt,
  }: CanvasBoardProps,
  ref: React.ForwardedRef<CanvasBoardHandle>
) {
  const [textColumns, setTextColumns] = useState<JournalTextBlock[][]>(() => [
    [emptyParagraph()],
  ]);
  const [imageBlocks, setImageBlocks] = useState<JournalImage[]>([]);
  // Column layout has been retired from the UI; we keep the snapshot field
  // for backward-compat (legacy notebooks still deserialize) but always
  // render as a single column going forward.
  const [columns] = useState<ColumnLayout>(1);
  const [lastSavedAt, setLastSavedAt] = useState<number>(() => Date.now());

  // Forces a re-render every 30s so relative time labels stay fresh even
  // when nothing else in the canvas has changed.
  const [, setMetaTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMetaTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [rangeAnchorId, setRangeAnchorId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const outerRef = useRef<HTMLDivElement | null>(null);
  const writingRef = useRef<HTMLDivElement | null>(null);
  /** Scrollport for the writing column only — page / left rail stay fixed. */
  const writingScrollRef = useRef<HTMLDivElement | null>(null);
  /** The actual centered text column; used to anchor the blob to its right edge. */
  const writingColumnRef = useRef<HTMLDivElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const textRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const hydratedRef = useRef(false);
  const focusAfterRender = useRef<{
    id: string;
    position: "start" | "end";
  } | null>(null);

  /* ---------------------------- Blob companion ---------------------------- */

  // The companion lives just to the right of the writing column, vertically
  // centred. We measure the column's right edge so the position is correct
  // at every viewport width without any CSS-vs-actual-width drift.
  const blob = useBlobState({ sleepAfterMs: 10_000 });
  const [blobLeft, setBlobLeft] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const col = writingColumnRef.current;
      const writing = writingRef.current;
      if (!col || !writing) return;
      const colRect = col.getBoundingClientRect();
      const writingRect = writing.getBoundingClientRect();
      // 24px breathing room between the text column and the character.
      setBlobLeft(colRect.right - writingRect.left + 24);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (writingRef.current) ro.observe(writingRef.current);
    if (writingColumnRef.current) ro.observe(writingColumnRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /* ------------------------------ Hydration ------------------------------ */

  useLayoutEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    hydratedRef.current = true;

    const apply = (snap: CanvasSnapshot) => {
      // Collapse any legacy multi-column snapshots down to a single track so
      // the UI matches the simplified spec without losing existing content.
      setTextColumns(adjustColumns(snap.textColumns, 1));
      setImageBlocks(snap.imageBlocks);
      setLastSavedAt(snap.updatedAt);
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
          onSnapshotChange?.({ ...norm, updatedAt: Date.now() });
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
        onSnapshotChange?.({ ...norm, updatedAt: Date.now() });
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSnapshot, onSnapshotChange, storageKey]);

  /* ----------------------- Snapshot mirroring + save ---------------------- */

  const buildSnapshot = useCallback(
    (): CanvasSnapshot => ({
      version: CANVAS_SNAPSHOT_VERSION,
      textColumns,
      imageBlocks,
      background: CANVAS_BACKGROUND,
      columns,
      updatedAt: Date.now(),
    }),
    [columns, imageBlocks, textColumns]
  );

  // Fast local mirror so a tab close never loses keystrokes. This is *not*
  // the "milestone" save (AI title regen) — that fires from a coarser timer
  // and the manual button, below.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const snap = buildSnapshot();
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snap));
        setLastSavedAt(snap.updatedAt);
        onSnapshotChange?.(snap);
      } catch {
        /* noop */
      }
    }, LOCAL_MIRROR_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [buildSnapshot, onSnapshotChange, storageKey]);

  const triggerMilestoneSave = useCallback(() => {
    const snap = buildSnapshot();
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snap));
    } catch {
      /* noop */
    }
    setLastSavedAt(snap.updatedAt);
    onSnapshotChange?.(snap);
    onSave?.(snap);
  }, [buildSnapshot, onSave, onSnapshotChange, storageKey]);

  // 30-second milestone tick. Reset whenever anything materially changes so a
  // burst of typing doesn't fire a save the moment the user pauses.
  useEffect(() => {
    const id = window.setInterval(
      () => triggerMilestoneSave(),
      MILESTONE_SAVE_INTERVAL_MS
    );
    return () => window.clearInterval(id);
  }, [triggerMilestoneSave]);

  // Imperative seam used by the page-level back button: play the goodbye
  // wave + run one last save, then resolve so the parent can navigate.
  useImperativeHandle(
    ref,
    () => ({
      prepareForClose: async () => {
        triggerMilestoneSave();
        await blob.onClosing();
      },
    }),
    [triggerMilestoneSave, blob]
  );

  /* --------------------------- Focus management --------------------------- */

  const focusBlock = useCallback(
    (id: string, position: "start" | "end" = "end") => {
      focusAfterRender.current = { id, position };
    },
    []
  );

  useEffect(() => {
    const target = focusAfterRender.current;
    if (!target) return;
    focusAfterRender.current = null;
    const ta = textRefs.current[target.id];
    if (!ta) return;
    ta.focus({ preventScroll: false });
    const len = ta.value.length;
    const point = target.position === "start" ? 0 : len;
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

  const focusLastBlockOf = useCallback((columnIndex: number) => {
    setTextColumns((cols) => {
      const col = cols[columnIndex];
      if (!col || col.length === 0) return cols;
      const last = col[col.length - 1];
      if (last.text.length === 0) {
        focusAfterRender.current = { id: last.id, position: "end" };
        return cols;
      }
      const tail = emptyParagraph();
      focusAfterRender.current = { id: tail.id, position: "start" };
      return cols.map((c, idx) => (idx === columnIndex ? [...c, tail] : c));
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
      const col = target.closest("[data-text-column]");
      if (col instanceof HTMLElement) {
        const idx = Number(col.dataset.textColumn);
        if (Number.isFinite(idx)) {
          e.preventDefault();
          focusLastBlockOf(idx);
          setSelectedImageId(null);
        }
      }
    },
    [focusLastBlockOf]
  );

  /* ------------------------------- Render ------------------------------- */

  return (
    <div
      ref={outerRef}
      className="relative flex h-svh min-h-0 w-full flex-row overflow-x-hidden overflow-y-hidden transition-colors duration-500"
      style={{
        background: CANVAS_BACKGROUND,
        color: WRITING_INK,
        caretColor: WRITING_INK,
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* —————————— Left image column —————————— */}
      <ImageStack
        images={imageBlocks}
        selectedImageId={selectedImageId}
        onSelect={(id) => {
          setSelectedImageId(id);
          setShowTextCtx(false);
        }}
        onUpdate={updateImage}
        onRemove={removeImage}
        onAdd={() => imageFileInputRef.current?.click()}
      />

      {/* —————————— Centered writing area ——————————
          `flex-1` claims the remaining horizontal space so the writing
          column never slides underneath the photo zone. The inner div
          centers the text columns (with `mx-auto`) and caps them at the
          spec width per column count. The space to the right of that
          inner div is the "breathing room" — intentionally empty. */}
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        ref={writingRef}
        onPointerDown={(e) => {
          blob.onCanvasInteraction();
          onWritingPointerDown(e);
        }}
      >
        <div
          ref={writingScrollRef}
          className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]"
          style={{
            paddingTop: PAGE_PADDING_Y,
            paddingBottom: PAGE_PADDING_Y,
          }}
        >
          <CanvasHeader
            title={title}
            savedAt={lastSavedAt}
            previousOpenedAt={previousOpenedAt ?? null}
            maxWidthCss={WRITING_WIDTH_CSS[columns]}
          />

          <div
            ref={writingColumnRef}
            className="relative mx-auto flex w-full"
            style={{ gap: TEXT_COLUMN_GAP, maxWidth: WRITING_WIDTH_CSS[columns] }}
          >
          {textColumns.map((col, colIdx) => (
            <div
              key={colIdx}
              data-text-column={colIdx}
              className="flex min-w-0 flex-1 flex-col gap-3"
              style={{ minHeight: 240 }}
            >
              {col.map((block) => (
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
                    blob.onActivity();
                  }}
                  onToggleCheck={() =>
                    updateTextBlock(block.id, { checked: !block.checked })
                  }
                  onEnter={(splitAt) => {
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
                    const next: JournalTextBlock = {
                      id: newId(),
                      blockKind: block.blockKind,
                      text: right,
                      checked:
                        block.blockKind === "checklist" ? false : undefined,
                    };
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
                      if (!loc) return cols;
                      const updated = cols.map((c) => c.slice());
                      updated[loc.c][loc.i] = { ...block, text: left };
                      updated[loc.c].splice(loc.i + 1, 0, next);
                      return updated;
                    });
                    focusBlock(next.id, "start");
                  }}
                  onBackspaceAtStart={() => {
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
        </div>

        {/* —————————— Companion (right of writing column, pinned to top) ——————————
            Sits in the writingRef container (which doesn't scroll) so the
            character stays put as the user scrolls through the page.
            The horizontal position is measured against the column's right
            edge, so it follows resize without any CSS-vs-actual drift. */}
        {blobLeft !== null && (
          <div
            className="pointer-events-auto absolute z-30"
            style={{
              left: blobLeft,
              top: PAGE_PADDING_Y,
              transition: "left 0.15s ease-out",
            }}
          >
            <BlobCharacter
              state={blob.state}
              hidden={blob.hidden}
              onWakeUp={blob.onCanvasInteraction}
            />
          </div>
        )}
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
                  "var(--font-manrope), system-ui, -apple-system, sans-serif",
              }}
            >
              {selectedBlockIds.length > 1 && (
                <span className="mr-0.5 rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-black/50">
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

      {/* —————————— Manual save (top-right) —————————— */}
      <button
        type="button"
        title="Save"
        aria-label="Save"
        onClick={() => {
          triggerMilestoneSave();
          blob.onSave();
        }}
        className="fixed right-4 top-4 z-40 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.06] bg-white/85 text-[#615E5E] shadow-[0_4px_16px_rgba(15,15,15,0.06)] backdrop-blur-md transition hover:bg-white hover:text-[#2C2C2A]"
      >
        <Save size={16} strokeWidth={iconStrokePx(16)} />
      </button>
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
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<JournalImage>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
};

/** Fixed height of the two-polaroid stack — container never grows. */
const STACK_HEIGHT_PX = 300;
/** Tilt for the front polaroid. */
const FRONT_TILT_DEG = -5;
/** Tilt for the back polaroid — visible peek without feeling extreme. */
const BACK_TILT_DEG = 14;
/** Back card offset so it peeks from behind the front. */
const BACK_NUDGE_X_PX = 7;
const BACK_NUDGE_Y_PX = 14;
const STACK_SWAP_MS = 560;
const STACK_SWAP_TRANSITION = `transform ${STACK_SWAP_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;

function ImageStack({
  images,
  selectedImageId,
  onSelect,
  onUpdate,
  onRemove,
  onAdd,
}: ImageStackProps) {
  // Which of the two slots is displayed in front (0 = first slot, 1 = second).
  const [frontSlot, setFrontSlot] = useState(0);
  /** Keeps the rising card above the other for the full swap animation. */
  const [liftedSlot, setLiftedSlot] = useState<number | null>(null);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bringForward = useCallback((slotIdx: number) => {
    if (slotIdx === frontSlot) return;
    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    setLiftedSlot(slotIdx);
    setFrontSlot(slotIdx);
    swapTimerRef.current = setTimeout(() => {
      setLiftedSlot(null);
      swapTimerRef.current = null;
    }, STACK_SWAP_MS + 40);
  }, [frontSlot]);

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

  // Render back slot first in DOM so the front slot paints on top.
  const backSlot = 1 - frontSlot;

  return (
    <aside
      aria-label="Image column"
      className="relative z-10 shrink-0 self-end rounded-[22px]"
      style={{
        width: "20%",
        height: "fit-content",
        margin: 12,
        position: "sticky",
        bottom: 20,
        padding: 24,
        background: CANVAS_RECESS,
      }}
    >
      <div
        className="flex flex-col items-center justify-end"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-polaroid]")) return;
          onSelect(null);
        }}
      >
        {/* Fixed-height stack — never grows regardless of image count. */}
        <div
          className="relative w-full shrink-0 overflow-visible"
          style={{ height: STACK_HEIGHT_PX }}
        >
          {([backSlot, frontSlot] as const).map((slotIdx) => {
            const isFront = slotIdx === frontSlot;
            const isLifted = liftedSlot === slotIdx;
            const tilt = isFront ? FRONT_TILT_DEG : BACK_TILT_DEG;
            const nudgeX = isFront ? 0 : BACK_NUDGE_X_PX;
            const nudgeY = isFront ? 0 : BACK_NUDGE_Y_PX;
            const scale = isFront ? 1 : 0.98;
            const img = ordered[slotIdx] ?? null;
            const zIndex = isLifted ? 3 : isFront ? 2 : 1;

            return (
              <div
                key={slotIdx}
                data-polaroid
                className="absolute"
                style={{
                  width: "80%",
                  left: "50%",
                  bottom: 20,
                  transform: `translate3d(calc(-50% + ${nudgeX}px), ${nudgeY}px, 0) scale(${scale}) rotate(${tilt}deg)`,
                  transformOrigin: "50% 100%",
                  zIndex,
                  cursor: "pointer",
                  transition: STACK_SWAP_TRANSITION,
                }}
                onTransitionEnd={(e) => {
                  if (e.propertyName !== "transform") return;
                  setLiftedSlot((prev) => (prev === slotIdx ? null : prev));
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
    </aside>
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
        className="mt-2 block w-full shrink-0 text-center text-[11px] italic text-black/20 transition-colors duration-200 group-hover:text-black/35"
        style={{
          fontFamily: "var(--font-caveat), var(--font-lora), cursive",
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
          className="w-full border-0 bg-transparent p-0 text-center text-[11px] italic tracking-tight text-black/55 outline-none placeholder:text-black/25"
          style={{
            fontFamily: "var(--font-caveat), var(--font-lora), cursive",
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
/*  Canvas header — Heading + "Saved · Last opened" meta strip                 */
/* -------------------------------------------------------------------------- */

/**
 * Returns a calm relative-time phrase suitable for the canvas meta strip.
 * Buckets are intentionally coarse — the journal aesthetic should feel
 * approximate, not surveillance-grade.
 */
function formatRelativeTime(ts: number | null | undefined): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "just now";
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "just now";
  if (diffMs < 45_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

type CanvasHeaderProps = {
  title?: string;
  savedAt: number;
  previousOpenedAt: number | null;
  maxWidthCss: string;
};

function CanvasHeader({
  title,
  savedAt,
  previousOpenedAt,
  maxWidthCss,
}: CanvasHeaderProps) {
  const displayTitle =
    typeof title === "string" && title.trim().length > 0
      ? title.trim()
      : "Heading";

  const openedLabel =
    previousOpenedAt === null
      ? "Last opened just now"
      : `Last opened ${formatRelativeTime(previousOpenedAt)}`;

  return (
    <header
      className="mx-auto w-full"
      style={{
        maxWidth: maxWidthCss,
        marginBottom: 56,
        fontFamily:
          "var(--font-manrope), system-ui, -apple-system, sans-serif",
      }}
    >
      <h1
        className="text-[15px] font-semibold tracking-tight text-[#2C2C2A]"
        style={{ lineHeight: 1.3 }}
      >
        {displayTitle}
      </h1>
      <p
        className="mt-1 text-[12px] text-black/40"
        style={{ lineHeight: 1.5 }}
      >
        <span>Saved {formatRelativeTime(savedAt)}</span>
        <span aria-hidden className="mx-1.5 opacity-50">
          ·
        </span>
        <span>{openedLabel}</span>
      </p>
    </header>
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

  // Placeholder logic:
  // - Bullet / checklist items always show their type hint.
  // - Paragraphs only show "Start writing..." on the FOCUSED block AND only
  //   while the block is empty. This is the "fades on first keystroke" rule
  //   in the product spec — once the user has any text the placeholder is
  //   gone for good.
  const placeholder =
    block.blockKind === "bullet"
      ? "List item"
      : block.blockKind === "checklist"
        ? "To-do"
        : isActive && block.text.length === 0
          ? "Start writing..."
          : "";

  return (
    <div
      data-block-element="text"
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
            <span
              className="leading-none opacity-60"
              style={{ fontSize: WRITING_FONT_SIZE + 1 }}
            >
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
          "block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:outline-none",
          block.blockKind === "checklist" && block.checked
            ? "text-black/35 line-through decoration-black/30 decoration-[1.5px]"
            : ""
        )}
        style={{
          fontFamily:
            "var(--font-lora), Georgia, 'Times New Roman', serif",
          fontSize: WRITING_FONT_SIZE,
          lineHeight: WRITING_LINE_HEIGHT,
          color: WRITING_INK,
          // Placeholder color is set via CSS var so we don't fight Tailwind's preset.
          // (We use a `::placeholder` style hook below in global.css.)
          ["--placeholder-color" as string]: PLACEHOLDER_INK,
        }}
      />
    </div>
  );
}
