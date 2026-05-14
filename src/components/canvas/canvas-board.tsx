"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import Image from "next/image";
import {
  Archive,
  Columns,
  Columns3,
  ImagePlus,
  List,
  ListChecks,
  NotebookPen,
  Pilcrow,
  RectangleHorizontal,
  RotateCw,
  Square,
  Trash2,
} from "lucide-react";
import { btnIcon, iconPx, iconStroke, iconStrokePx } from "@/components/ui/button-system";

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

export type JournalImage = {
  id: string;
  src: string;
  /** Pixel offset from the left of the page container. */
  x: number;
  /** Pixel offset from the top of the page container. */
  y: number;
  /** Pixel width of the image content (excludes polaroid padding). */
  w: number;
  /** height / width of the underlying picture. */
  ratio: number;
  /** Rotation in degrees (0 = upright). */
  rotate?: number;
  caption?: string;
  polaroid?: boolean;
  /** Bordered “figure” layout with caption (mutually exclusive with polaroid in UI). */
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

export const BACKGROUND_PRESETS = [
  { id: "ivory", value: "#fbf8f1", label: "Ivory" },
  { id: "sand", value: "#f3ede0", label: "Sand" },
  { id: "sage", value: "#edf1ec", label: "Sage" },
  { id: "mist", value: "#eaeef3", label: "Mist" },
  { id: "blush", value: "#f5ecec", label: "Blush" },
] as const;

export const DEFAULT_BACKGROUND = BACKGROUND_PRESETS[0].value;

const PAGE_TOP_PADDING = 80;
const PAGE_BOTTOM_PADDING = 240;
const TEXT_COLUMN_GAP = 32;
const PAGE_MAX_WIDTH = 1300;

/** Container width per column count. */
const COLUMN_WIDTH_CSS: Record<1 | 2 | 3, string> = {
  1: "min(52vw, 760px)",   // single focused column, comfortably readable
  2: "min(82vw, 1200px)",  // two equal halves, generous but not full-bleed
  3: "min(82vw, 1200px)",  // three equal thirds, same container as 2-col
};

const MIN_IMAGE_WIDTH = 80;
const MAX_IMAGE_WIDTH = PAGE_MAX_WIDTH;
const DEFAULT_IMAGE_WIDTH = 360;

/** Fallback viewport width when measuring isn’t available (SSR). */
const VIEWPORT_FALLBACK = 1200;

function useViewportWidth(): number {
  const [vw, setVw] = useState(VIEWPORT_FALLBACK);
  useLayoutEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return vw;
}

/**
 * Polaroid padding: scales with viewport, then scales down when the image is
 * narrow so the white frame stays proportional to the photo.
 */
function getPolaroidPadsForImage(
  imageContentWidth: number,
  viewportW: number
): { padX: number; padTop: number; padBottom: number } {
  const baseX = Math.round(clamp(viewportW * 0.038, 12, 24));
  const baseTop = Math.round(clamp(viewportW * 0.038, 12, 24));
  const baseBot = Math.round(clamp(viewportW * 0.028, 9, 20));
  /** ~400px-wide image = full padding; smaller images tighten the frame. */
  const scale = clamp(imageContentWidth / 400, 0.32, 1);
  return {
    padX: Math.max(5, Math.round(baseX * scale)),
    padTop: Math.max(5, Math.round(baseTop * scale)),
    padBottom: Math.max(4, Math.round(baseBot * scale)),
  };
}

/** Padding around image when `figure` mode is on (caption allowed). */
const FIGURE_PAD = 8;

const AUTOSAVE_MS = 400;
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
/*  Snapshot helpers                                                           */
/* -------------------------------------------------------------------------- */

export const emptySnapshot = (): CanvasSnapshot => ({
  version: CANVAS_SNAPSHOT_VERSION,
  textColumns: [[emptyParagraph()]],
  imageBlocks: [],
  background: DEFAULT_BACKGROUND,
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
  const w =
    typeof raw.w === "number" && Number.isFinite(raw.w)
      ? clamp(raw.w, MIN_IMAGE_WIDTH, MAX_IMAGE_WIDTH)
      : DEFAULT_IMAGE_WIDTH;
  const ratio =
    typeof raw.ratio === "number" && Number.isFinite(raw.ratio)
      ? clamp(raw.ratio, 0.1, 4)
      : 0.66;
  const x = typeof raw.x === "number" && Number.isFinite(raw.x) ? raw.x : 60;
  const y = typeof raw.y === "number" && Number.isFinite(raw.y) ? raw.y : 60;
  const caption =
    typeof raw.caption === "string" && raw.caption.length > 0
      ? raw.caption
      : undefined;
  const rotate =
    typeof raw.rotate === "number" && Number.isFinite(raw.rotate)
      ? raw.rotate
      : 0;
  const polaroid = Boolean(raw.polaroid);
  const figure = Boolean(raw.figure) && !polaroid;
  return {
    id,
    src,
    x,
    y,
    w,
    ratio,
    rotate: rotate !== 0 ? rotate : undefined,
    caption,
    polaroid,
    figure: figure || undefined,
  };
};

/**
 * Best-effort migration from any prior snapshot version (v1 positional,
 * v2 positional + multi-line lists, v3 sequential mixed blocks) into v4.
 */
function migrateLegacy(raw: Record<string, unknown>): CanvasSnapshot {
  const flatText: JournalTextBlock[] = [];
  const images: JournalImage[] = [];
  let imageY = PAGE_TOP_PADDING;
  const imageX = 80;

  const v3Blocks = arrayOrEmpty<Record<string, unknown>>(raw.blocks);
  if (v3Blocks.length > 0) {
    for (const b of v3Blocks) {
      if (b.kind === "image" && typeof b.src === "string") {
        const ratio =
          typeof b.ratio === "number" && Number.isFinite(b.ratio)
            ? b.ratio
            : 0.66;
        const w = DEFAULT_IMAGE_WIDTH;
        images.push({
          id: typeof b.id === "string" ? b.id : newId(),
          src: b.src,
          x: imageX,
          y: imageY,
          w,
          ratio,
          caption: typeof b.caption === "string" ? b.caption : undefined,
          polaroid: Boolean(b.polaroid),
        });
        imageY += Math.round(w * ratio) + 60;
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
          ? clamp(im.w, MIN_IMAGE_WIDTH, MAX_IMAGE_WIDTH)
          : DEFAULT_IMAGE_WIDTH;
      const h =
        typeof im.h === "number" && Number.isFinite(im.h)
          ? im.h
          : Math.round(w * 0.66);
      const ratio = w > 0 ? h / w : 0.66;
      images.push({
        id: typeof im.id === "string" ? im.id : newId(),
        src,
        x: imageX,
        y: imageY,
        w,
        ratio,
        caption: typeof im.caption === "string" ? im.caption : undefined,
        polaroid: false,
      });
      imageY += Math.round(w * ratio) + 60;
    }
  }

  const background =
    typeof raw.background === "string" && raw.background.length > 0
      ? raw.background
      : DEFAULT_BACKGROUND;

  return {
    version: CANVAS_SNAPSHOT_VERSION,
    textColumns: [flatText.length > 0 ? flatText : [emptyParagraph()]],
    imageBlocks: images,
    background,
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

  // Conform the column count to the saved layout setting without
  // redistributing existing content.
  textColumns = adjustColumns(
    textColumns.length === 0 ? [[emptyParagraph()]] : textColumns,
    columns
  );

  const imageBlocks = arrayOrEmpty<unknown>(value.imageBlocks)
    .map(sanitizeImage)
    .filter((b): b is JournalImage => Boolean(b));

  const background =
    typeof value.background === "string" && value.background.length > 0
      ? value.background
      : DEFAULT_BACKGROUND;

  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : Date.now();

  return {
    version: CANVAS_SNAPSHOT_VERSION,
    textColumns,
    imageBlocks,
    background,
    columns,
    updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/*  Top-level component                                                        */
/* -------------------------------------------------------------------------- */

type CanvasBoardProps = {
  storageKey: string;
  initialSnapshot?: CanvasSnapshot | null;
  onSnapshotChange?: (snapshot: CanvasSnapshot) => void;
};

type ImageDims = { width: number; height: number };

const loadImageDims = (src: string): Promise<ImageDims> =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1200, height: 800 });
    img.src = src;
  });

/** Convert a File to a persistent base64 data-URL so it survives page reloads. */
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Approximate x-offset (px) from the textarea's left border to `index`,
 * using canvas measureText (good enough for left-anchored format popovers).
 */
const approxCharXInTextarea = (el: HTMLTextAreaElement, index: number): number => {
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

export default function CanvasBoard({
  storageKey,
  initialSnapshot,
  onSnapshotChange,
}: CanvasBoardProps) {
  const [textColumns, setTextColumns] = useState<JournalTextBlock[][]>(() => [
    [emptyParagraph()],
  ]);
  const [imageBlocks, setImageBlocks] = useState<JournalImage[]>([]);
  const [columns, setColumns] = useState<ColumnLayout>(1);
  const [background, setBackground] = useState<string>(DEFAULT_BACKGROUND);
  const [showImages, setShowImages] = useState(true);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  /** Anchor of a multi-block range selection (shift-click extends from here). */
  const [rangeAnchorId, setRangeAnchorId] = useState<string | null>(null);
  /** All block ids currently in the selection range (active row + anchor range). */
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const viewportWidth = useViewportWidth();

  const outerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const hydratedRef = useRef(false);
  const focusAfterRender = useRef<{
    id: string;
    position: "start" | "end";
  } | null>(null);

  /* ------------------------------ Hydration ------------------------------ */

  useLayoutEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    hydratedRef.current = true;

    const apply = (snap: CanvasSnapshot) => {
      setTextColumns(snap.textColumns);
      setImageBlocks(snap.imageBlocks);
      setBackground(snap.background);
      setColumns(snap.columns);
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

  /* ------------------------------ Autosave ------------------------------- */

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const snap: CanvasSnapshot = {
          version: CANVAS_SNAPSHOT_VERSION,
          textColumns,
          imageBlocks,
          background,
          columns,
          updatedAt: Date.now(),
        };
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(snap));
          onSnapshotChange?.(snap);
        } catch {
          /* noop */
        }
      }, AUTOSAVE_MS);
    };
    schedule();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [
    textColumns,
    imageBlocks,
    background,
    columns,
    storageKey,
    onSnapshotChange,
  ]);

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
      // Multi-block range: apply kind to every block in the range.
      const targets = batchIds && batchIds.length > 1 ? batchIds : null;
      if (targets) {
        setTextColumns((cols) =>
          cols.map((col) =>
            col.map((b) => {
              if (!targets.includes(b.id)) return b;
              if (kind === "checklist")
                return { ...b, blockKind: "checklist", checked: b.checked ?? false };
              return { ...b, blockKind: kind, checked: undefined };
            })
          )
        );
        setSelectedBlockIds([id]);
        return;
      }

      // Single-block path (handles within-block multi-line selection split).
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

          /* Multi-line selection → one list row per line (bullet or checklist). */
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

          /* Default: change kind for the whole block. */
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

  /* --------------------------- Layout switching --------------------------- */

  const switchColumns = useCallback((next: ColumnLayout) => {
    setColumns(next);
    setTextColumns((cols) => adjustColumns(cols, next));
  }, []);

  /* ------------------------------ Images ------------------------------- */

  const insertImage = useCallback(
    async (
      file: File,
      placement?: { clientX: number; clientY: number }
    ) => {
      if (!file.type.startsWith("image/")) return;
      // Use a data-URL so the image persists across page reloads in localStorage.
      const src = await fileToDataUrl(file);
      const dims = await loadImageDims(src);
      const ratio = dims.width > 0 ? dims.height / dims.width : 0.66;
      const w = Math.min(DEFAULT_IMAGE_WIDTH, MAX_IMAGE_WIDTH);
      const h = w * ratio;

      // Coordinates are relative to the outer full-width container.
      const outer = outerRef.current?.getBoundingClientRect();
      let x: number;
      let y: number;
      if (placement && outer) {
        x = placement.clientX - outer.left - w / 2;
        y = placement.clientY - outer.top + window.scrollY - h / 2;
      } else if (outer) {
        const scrollY = window.scrollY;
        const viewCenterY = window.innerHeight / 2 + scrollY;
        x = outer.width / 2 - w / 2;
        y = viewCenterY - scrollY - h / 2;
      } else {
        x = 80;
        y = PAGE_TOP_PADDING;
      }

      x = Math.max(0, x);
      y = Math.max(0, y);

      const id = newId();
      const block: JournalImage = {
        id,
        src,
        x,
        y,
        w,
        ratio,
        polaroid: false,
      };

      setImageBlocks((bs) => [...bs, block]);
      setSelectedImageId(id);
    },
    []
  );

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
            insertImage(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [insertImage]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = Array.from(e.dataTransfer.files)[0] ?? null;
      if (file?.type.startsWith("image/")) {
        insertImage(file, { clientX: e.clientX, clientY: e.clientY });
      }
    },
    [insertImage]
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

  /** All block ids in the active column, in order — used for range selection. */
  const activeColumnBlocks = useMemo<JournalTextBlock[]>(() => {
    if (!activeBlockId) return [];
    for (const col of textColumns) {
      if (col.some((b) => b.id === activeBlockId)) return col;
    }
    return [];
  }, [activeBlockId, textColumns]);

  // Whether the text contextual bar is currently visible.
  const [showTextCtx, setShowTextCtx] = useState(false);
  const [textCtxPos, setTextCtxPos] = useState<{ x: number; y: number } | null>(null);

  // Show text format bar only when the user has selected ≥ TEXT_CTX_SELECTION_MIN
  // characters inside the active textarea. Fires on every selection change so it
  // disappears as soon as typing collapses the selection.
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
        const anchorIdx = Math.min(el.selectionStart ?? 0, el.selectionEnd ?? 0);
        const relX = approxCharXInTextarea(el, anchorIdx);
        // Left-align the popover near the selection start; clamp inside field + viewport.
        const inField = r.left + Math.min(Math.max(relX, 4), Math.max(4, r.width - 4));
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
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [activeBlockId]);

  // Clear when the active block is deselected entirely.
  useEffect(() => {
    if (!activeBlockId) { setShowTextCtx(false); setTextCtxPos(null); }
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

  const selectedImage = useMemo(
    () => imageBlocks.find((b) => b.id === selectedImageId) ?? null,
    [imageBlocks, selectedImageId]
  );

  // Page minimum height: the lowest image bottom (so the page grows for
  // freely-placed images), or the natural text content height (already in
  // flow) — whichever is larger.
  const lowestImageBottom = useMemo(() => {
    let max = 0;
    for (const im of imageBlocks) {
      const polPads = im.polaroid
        ? getPolaroidPadsForImage(im.w, viewportWidth)
        : null;
      const polPadBot = polPads ? polPads.padTop + polPads.padBottom : 0;
      const figPadBot = im.figure ? FIGURE_PAD * 2 : 0;
      const captionSpace = im.polaroid || im.figure ? 30 : 0;
      const bottom = im.y + im.w * im.ratio + polPadBot + figPadBot + captionSpace;
      if (bottom > max) max = bottom;
    }
    return max;
  }, [imageBlocks, viewportWidth]);

  /* ---------------------------- Surface gestures -------------------------- */

  const onPagePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Image clicks: their own handlers stop propagation.
      if (target.closest("[data-block-element='image']")) return;
      // Other interactive elements (text block / caption): consume directly.
      if (target.closest("[data-block-element]")) return;
      // Whitespace inside a column: focus that column's last block.
      const col = target.closest("[data-text-column]");
      if (col instanceof HTMLElement) {
        const idx = Number(col.dataset.textColumn);
        if (Number.isFinite(idx)) {
          e.preventDefault();
          focusLastBlockOf(idx);
          setSelectedImageId(null);
          return;
        }
      }
      // Click on the page outside any column → clear image selection.
      setSelectedImageId(null);
    },
    [focusLastBlockOf]
  );

  /* ------------------------------- Render ------------------------------- */

  return (
    <div
      ref={outerRef}
      className="relative w-full transition-colors duration-500"
      style={{
        background,
        color: "var(--fg, #1a1a1a)",
        /* At least full viewport; grow when images extend below the fold.
           (Inline minHeight previously replaced min-h-[100svh] and caused a short page.) */
        minHeight: `max(100svh, ${lowestImageBottom + PAGE_BOTTOM_PADDING}px)`,
        caretColor: "currentColor",
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        ref={pageRef}
        className="relative mx-auto"
        style={{
          width: COLUMN_WIDTH_CSS[columns],
          paddingTop: PAGE_TOP_PADDING,
          paddingBottom: PAGE_BOTTOM_PADDING,
        }}
        onPointerDown={onPagePointerDown}
      >
        {/* ---------------------- Text columns layer ---------------------- */}
        <div className="relative flex w-full" style={{ gap: TEXT_COLUMN_GAP }}>
          {textColumns.map((col, colIdx) => (
            <div
              key={colIdx}
              data-text-column={colIdx}
              className="flex min-w-0 flex-1 flex-col gap-3"
              style={{ minHeight: 200 }}
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
                  onChange={(text) => updateTextBlock(block.id, { text })}
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

      {/* ---------------------- Image (free) layer ---------------------- */}
      {showImages && <div className="pointer-events-none absolute inset-0">
        {imageBlocks.map((im) => (
          <FreeImage
            key={im.id}
            block={im}
            viewportWidth={viewportWidth}
            selected={selectedImageId === im.id}
              onSelect={() => { setSelectedImageId(im.id); setShowTextCtx(false); }}
            onChange={(patch) => updateImage(im.id, patch)}
          />
        ))}
      </div>}

      {/* Hidden file input used by toolbar. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          if (file) insertImage(file);
          ev.target.value = "";
        }}
      />

      {/* ── TEXT CONTEXTUAL ─ floats above the focused text block ──────── */}
      {(showTextCtx || selectedBlockIds.length > 1) && textCtxPos && activeBlockId && (
        <div
          data-ctx
          className="pointer-events-auto fixed z-40 -translate-y-full"
          style={{ left: textCtxPos.x, top: textCtxPos.y - 8 }}
        >
          <div className="flex items-center gap-0.5 rounded-xl border border-black/[0.06] bg-white/95 px-1.5 py-1 shadow-[0_4px_20px_rgba(15,15,15,0.10)] backdrop-blur-md">
            {selectedBlockIds.length > 1 && (
              <span className="mr-0.5 rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-black/50">
                {selectedBlockIds.length} rows
              </span>
            )}
            {(
              [
                { kind: "paragraph" as const, icon: <Pilcrow size={14} strokeWidth={iconStrokePx(14)} />, label: "Paragraph" },
                { kind: "bullet"    as const, icon: <List     size={14} strokeWidth={iconStrokePx(14)} />, label: "Bullet list" },
                { kind: "checklist" as const, icon: <ListChecks size={14} strokeWidth={iconStrokePx(14)} />, label: "Checklist" },
              ] as const
            ).map(({ kind, icon, label }) => (
              <button
                key={kind}
                type="button"
                aria-label={label}
                title={label}
                onClick={() => setBlockKind(activeBlockId, kind, selectedBlockIds.length > 1 ? selectedBlockIds : undefined)}
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

      {/* ── IMAGE CONTEXTUAL — right side so it never covers top-center rotate handle ─ */}
      {selectedImage && !showTextCtx && (() => {
        const pol =
          selectedImage.polaroid &&
          getPolaroidPadsForImage(selectedImage.w, viewportWidth);
        const px = pol
          ? pol.padX
          : selectedImage.figure
            ? FIGURE_PAD
            : 0;
        const pt = pol
          ? pol.padTop
          : selectedImage.figure
            ? FIGURE_PAD
            : 0;
        const outerW = selectedImage.w + px * 2;
        const imgH = selectedImage.w * selectedImage.ratio;
        const midY = selectedImage.y + pt + imgH / 2;
        return (
        <div
          data-ctx
          className="pointer-events-none absolute z-20"
          style={{
            left: selectedImage.x + outerW + 12,
            top: midY,
            transform: "translateY(-50%)",
          }}
        >
          <div className="pointer-events-auto flex flex-col gap-0.5 rounded-xl border border-black/[0.08] bg-white px-1 py-1 shadow-[0_6px_24px_rgba(15,15,15,0.12)] backdrop-blur-md">
            <button
              type="button"
              aria-label="Polaroid frame"
              title="Polaroid frame"
              onClick={() => {
                const next = !selectedImage.polaroid;
                updateImage(selectedImage.id, {
                  polaroid: next,
                  figure: false,
                  ...(!next ? { caption: undefined } : {}),
                });
              }}
              className={clsx(
                "inline-flex h-7 w-7 items-center justify-center rounded-lg transition",
                selectedImage.polaroid
                  ? "bg-black/10 text-[var(--color-canvas-toolbar-icon)]"
                  : "text-[var(--color-canvas-toolbar-icon)]/70 hover:bg-black/[0.05] hover:text-[var(--color-canvas-toolbar-icon)]"
              )}
            >
              <Square size={14} strokeWidth={iconStrokePx(14)} />
            </button>
            <div aria-hidden className="h-px w-5 self-center bg-black/10" />
            <button
              type="button"
              aria-label="Delete image"
              title="Delete image"
              onClick={() => removeImage(selectedImage.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-canvas-toolbar-icon)]/65 transition hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={14} strokeWidth={iconStrokePx(14)} />
            </button>
          </div>
        </div>
        );
      })()}

      {/* ── BOTTOM TOOLBAR: [ Image ] | [ Layout ] | [ Color ] ─────────────── */}
      <div
        data-toolbar
        className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2"
      >
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/90 px-3 py-2 shadow-[0_8px_32px_rgba(15,15,15,0.10)] backdrop-blur-md">

          {/* —— Section 1 · Image —— */}
          <div className="flex items-center" role="group" aria-label="Image">
            <button
              type="button"
              aria-label="Add image"
              title="Add image"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-canvas-toolbar-icon)] transition hover:bg-black/[0.06]"
            >
              <ImagePlus size={18} strokeWidth={iconStrokePx(18)} />
            </button>
          </div>

          <span aria-hidden className="h-7 w-px shrink-0 bg-black/[0.10]" />

          {/* —— Section 2 · Layout (segmented, always visible) —— */}
          <div
            role="group"
            aria-label="Column layout"
            className="flex items-center rounded-lg bg-[var(--color-segment-control-surface)] p-0.5"
          >
            {(
              [
                { n: 1 as const, icon: <RectangleHorizontal size={14} strokeWidth={iconStrokePx(14)} />, label: "One column" },
                { n: 2 as const, icon: <Columns size={14} strokeWidth={iconStrokePx(14)} />, label: "Two columns" },
                { n: 3 as const, icon: <Columns3 size={14} strokeWidth={iconStrokePx(14)} />, label: "Three columns" },
              ] as const
            ).map(({ n, icon, label }) => (
              <button
                key={n}
                type="button"
                aria-label={label}
                title={label}
                onClick={() => switchColumns(n)}
                className={clsx(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-canvas-toolbar-icon)] transition",
                  columns === n
                    ? "bg-white shadow-sm"
                    : "hover:bg-black/[0.05]"
                )}
              >
                {icon}
              </button>
            ))}
          </div>

          <span aria-hidden className="h-7 w-px shrink-0 bg-black/[0.10]" />

          {/* —— Section 3 · Color (swatches, always visible) —— */}
          <div
            role="group"
            aria-label="Background color"
            className="flex items-center gap-1.5"
          >
            {BACKGROUND_PRESETS.map((preset) => {
              const isSelected = preset.value === background;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={`${preset.label} background`}
                  onClick={() => setBackground(preset.value)}
                  className={clsx(
                    "h-5 w-5 shrink-0 rounded-full border transition",
                    isSelected
                      ? "border-black/45 ring-2 ring-black/10"
                      : "border-black/15 hover:border-black/35"
                  )}
                  style={{ background: preset.value }}
                />
              );
            })}
          </div>

        </div>
      </div>

      {/* Mode toggle — top-right segmented control (icon-only) */}
      <div
        role="group"
        aria-label="View mode"
        className="fixed right-4 top-4 z-40 rounded-lg border border-black/[0.06] p-1 bg-[var(--color-segment-control-surface)]"
      >
        <div className="flex items-center p-0.5">
          <button
            type="button"
            title="Text only"
            aria-label="Text only"
            aria-pressed={!showImages}
            onClick={() => setShowImages(false)}
            className={clsx(
              btnIcon("md"),
              "!rounded-md text-[var(--color-canvas-toolbar-icon)] transition",
              !showImages
                ? "bg-white shadow-sm"
                : "bg-transparent text-[var(--color-canvas-toolbar-icon)]/70 hover:bg-black/[0.05] hover:text-[var(--color-canvas-toolbar-icon)]"
            )}
          >
            <NotebookPen
              size={iconPx("md")}
              strokeWidth={iconStroke("md")}
              aria-hidden
            />
          </button>
          <button
            type="button"
            title="Show images"
            aria-label="Show images"
            aria-pressed={showImages}
            onClick={() => setShowImages(true)}
            className={clsx(
              btnIcon("md"),
              "!rounded-md text-[var(--color-canvas-toolbar-icon)] transition",
              showImages
                ? "bg-white shadow-sm"
                : "bg-transparent text-[var(--color-canvas-toolbar-icon)]/70 hover:bg-black/[0.05] hover:text-[var(--color-canvas-toolbar-icon)]"
            )}
          >
            <Archive
              size={iconPx("md")}
              strokeWidth={iconStroke("md")}
              aria-hidden
            />
          </button>
        </div>
      </div>

    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Toolbar atom                                                               */
/* -------------------------------------------------------------------------- */

function ToolbarButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-canvas-toolbar-icon)] transition",
        active
          ? "bg-black/10"
          : "hover:bg-black/[0.06] disabled:opacity-40 disabled:hover:bg-transparent"
      )}
    >
      {icon}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Text block                                                                 */
/* -------------------------------------------------------------------------- */

type TextBlockViewProps = {
  block: JournalTextBlock;
  /** True when this block is currently focused — drives the roaming placeholder. */
  isActive: boolean;
  /** True when this block is inside the current multi-block selection range. */
  isInRange: boolean;
  registerRef: (el: HTMLTextAreaElement | null) => void;
  onFocus: () => void;
  /** Shift-click: extend the selection range to this block. */
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

  // Auto-resize textarea height to content (no inner scrolling).
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [block.text, block.blockKind]);

  const showMarker = block.blockKind !== "paragraph";

  // Placeholder logic:
  // - Bullet / checklist items always show their type hint.
  // - Paragraphs show "Start writing..." only on the currently focused
  //   block, so there is exactly one placeholder at a time and it
  //   follows wherever the cursor is.
  const placeholder =
    block.blockKind === "bullet"
      ? "List item"
      : block.blockKind === "checklist"
        ? "To-do"
        : isActive
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
        if (e.shiftKey) { e.preventDefault(); onShiftFocus(); }
      }}
    >
      {showMarker && (
        <div
          className="flex shrink-0 select-none items-start pt-[0.42rem]"
          aria-hidden={block.blockKind === "bullet"}
        >
          {block.blockKind === "bullet" ? (
            <span className="text-[1.05em] leading-none opacity-60">•</span>
          ) : (
            <button
              type="button"
              onClick={onToggleCheck}
              aria-label={block.checked ? "Mark incomplete" : "Mark complete"}
              className={clsx(
                "mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all duration-150",
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
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
          "block w-full resize-none overflow-hidden border-0 bg-transparent p-0 leading-relaxed outline-none placeholder:text-[color-mix(in_srgb,currentColor_30%,transparent)] focus:outline-none",
          block.blockKind === "checklist" && block.checked
            ? "text-black/35 line-through decoration-black/30 decoration-[1.5px]"
            : ""
        )}
        style={{
          fontFamily: "inherit",
          color: "inherit",
          fontSize: 17,
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Free-positioned image                                                      */
/* -------------------------------------------------------------------------- */

type Corner = "tl" | "tr" | "bl" | "br";

type FreeImageProps = {
  block: JournalImage;
  viewportWidth: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<JournalImage>) => void;
};

function FreeImage({ block, viewportWidth, selected, onSelect, onChange }: FreeImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [interacting, setInteracting] = useState(false);

  const rotate = block.rotate ?? 0;
  const polaroidPads = useMemo(
    () => getPolaroidPadsForImage(block.w, viewportWidth),
    [block.w, viewportWidth]
  );
  const padX = block.polaroid
    ? polaroidPads.padX
    : block.figure
      ? FIGURE_PAD
      : 0;
  const padTop = block.polaroid
    ? polaroidPads.padTop
    : block.figure
      ? FIGURE_PAD
      : 0;
  const padBottom = block.polaroid
    ? polaroidPads.padBottom
    : block.figure
      ? FIGURE_PAD
      : 0;

  const imageW = block.w;
  const imageH = imageW * block.ratio;
  const figureW = imageW + padX * 2;

  /* ── Move ─────────────────────────────────────────────────────────── */
  const startMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect();

      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = { x: block.x, y: block.y };
      let didMove = false;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!didMove && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        if (!didMove) { didMove = true; setInteracting(true); }
        onChange({ x: Math.max(0, startPos.x + dx), y: Math.max(0, startPos.y + dy) });
      };
      const onUp = () => {
        setInteracting(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [block.x, block.y, onChange, onSelect]
  );

  /* ── Corner resize (aspect-ratio locked) ─────────────────────────── */
  const startCornerResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, corner: Corner) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      setInteracting(true);

      const startX = e.clientX;
      const startW = block.w;
      const startH = startW * block.ratio;
      const startPos = { x: block.x, y: block.y };

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        // Right-side corners grow rightward; left-side corners grow leftward.
        const delta = corner === "br" || corner === "tr" ? dx : -dx;
        const newW = clamp(startW + delta, MIN_IMAGE_WIDTH, MAX_IMAGE_WIDTH);
        const newH = newW * block.ratio;
        const patch: Partial<JournalImage> = { w: newW };
        // Anchor the opposite edge by adjusting position.
        if (corner === "bl" || corner === "tl") {
          patch.x = Math.max(0, startPos.x + startW - newW);
        }
        if (corner === "tl" || corner === "tr") {
          patch.y = Math.max(0, startPos.y + startH - newH);
        }
        onChange(patch);
      };
      const onUp = () => {
        setInteracting(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [block.w, block.ratio, block.x, block.y, onChange, onSelect]
  );

  /* ── Rotate ───────────────────────────────────────────────────────── */
  const startRotate = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      setInteracting(true);

      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
      const startRot = rotate;

      const onMove = (ev: PointerEvent) => {
        const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI);
        onChange({ rotate: startRot + angle - startAngle });
      };
      const onUp = () => {
        setInteracting(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [rotate, onChange, onSelect]
  );

  /* ── Corner handle positions ──────────────────────────────────────── */
  // Handles sit outside the image (overlapping the border) — offset by half handle size.
  const HANDLE = 10;   // visible grip size (px)
  const H = -8;
  const cornerStyle: Record<Corner, React.CSSProperties> = {
    tl: { top: H, left: H,  cursor: "nwse-resize" },
    tr: { top: H, right: H, cursor: "nesw-resize" },
    bl: { bottom: H, left: H,  cursor: "nesw-resize" },
    br: { bottom: H, right: H, cursor: "nwse-resize" },
  };

  return (
    <div
      ref={wrapperRef}
      data-block-element="image"
      className={clsx(
        "pointer-events-auto absolute",
        selected && "z-[30]"
      )}
      style={{
        left: block.x,
        top: block.y,
        width: figureW,
        transform: rotate !== 0 ? `rotate(${rotate}deg)` : undefined,
        transformOrigin: "center center",
        cursor: interacting ? "grabbing" : "grab",
        userSelect: interacting ? "none" : undefined,
        touchAction: "none",
      }}
      onPointerDown={startMove}
    >
      {/* Rotate handle — light floating pill (reads calm on any photo) */}
      {selected && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute z-[35]"
            style={{
              left: "50%",
              top: padTop - 30,
              width: 1,
              height: 26,
              borderRadius: 999,
              background: "linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(0,0,0,0.12))",
              boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)",
              transform: "translateX(-50%)",
            }}
          />
          <div
            data-no-drag
            role="button"
            aria-label="Rotate image"
            title="Rotate"
            className="absolute z-[35] flex h-8 w-8 cursor-alias items-center justify-center rounded-full border border-white/80 bg-white/90 text-neutral-500 shadow-[0_2px_10px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.06)] backdrop-blur-sm transition hover:bg-white hover:text-neutral-700"
            style={{ top: padTop - 56, left: "50%", transform: "translateX(-50%)" }}
            onPointerDown={startRotate}
          >
            <RotateCw size={14} strokeWidth={iconStrokePx(14)} className="opacity-80" />
          </div>
        </>
      )}

      {/* Polaroid / figure frame + image */}
      <figure
        className={clsx(
          block.polaroid &&
            "rounded-[0.75rem] bg-white shadow-[0_4px_18px_rgba(15,15,15,0.08)]",
          block.figure &&
            !block.polaroid &&
            "rounded-xl border border-black/[0.08] bg-white/80 shadow-[0_2px_14px_rgba(15,15,15,0.07)] backdrop-blur-sm"
        )}
        style={{
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: padTop,
          paddingBottom: padBottom,
        }}
      >
        {/* Image container — overflow visible so handles can bleed outside */}
        <div
          className="relative"
          style={{ width: imageW, height: imageH }}
        >
          {/* Actual clipping wrapper */}
          <div
            className={clsx(
              "absolute inset-0 overflow-hidden rounded-[4px]",
              block.polaroid
                ? "rounded-[2px]"
                : block.figure
                  ? "!rounded-lg"
                  : "rounded-[0.7rem]",
              selected && "ring-1 ring-black/[0.12]"
            )}
          >
            <Image
              src={block.src}
              alt={block.caption ?? ""}
              fill
              unoptimized
              draggable={false}
              className="select-none object-cover"
            />
          </div>

          {/* Corner resize — soft glassy knobs (readable but not heavy) */}
          {selected &&
            (["tl", "tr", "bl", "br"] as Corner[]).map((corner) => (
              <div
                key={corner}
                data-no-drag
                aria-label={`Resize ${corner}`}
                className="absolute z-[35] flex items-center justify-center"
                style={{
                  ...cornerStyle[corner],
                  width: HANDLE + 22,
                  height: HANDLE + 22,
                  cursor: cornerStyle[corner].cursor,
                }}
                onPointerDown={(e) => startCornerResize(e, corner)}
              >
                <div
                  className="relative flex h-[11px] w-[11px] items-center justify-center rounded-full border border-white/90 bg-white/95 shadow-[0_1px_4px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.07)] ring-1 ring-black/[0.06] backdrop-blur-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400/80" />
                </div>
              </div>
            ))}
        </div>

        {/* Caption — only for polaroid or figure layouts */}
        {(block.polaroid || block.figure) && (
          <figcaption
            data-no-drag
            className={clsx("w-full", block.polaroid ? "mt-3" : "mt-2.5")}
            style={{ width: imageW }}
          >
            <input
              type="text"
              value={block.caption ?? ""}
              placeholder="Caption"
              onChange={(e) => onChange({ caption: e.target.value || undefined })}
              onFocus={onSelect}
              onPointerDown={(e) => e.stopPropagation()}
              className={clsx(
                "w-full border-0 bg-transparent p-0 text-center outline-none placeholder:text-[color-mix(in_srgb,currentColor_30%,transparent)]",
                block.polaroid
                  ? "text-[15px] tracking-tight text-black/75"
                  : "text-sm text-black/60"
              )}
              style={{ fontFamily: "inherit" }}
            />
          </figcaption>
        )}
      </figure>
    </div>
  );
}
