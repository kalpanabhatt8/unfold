/**
 * Unfold — read a completed entry's plain text for analysis.
 *
 * Prefers the canvas board snapshot (`keeps-board-{id}`, read as inert JSON so
 * we never touch the canvas runtime), falling back to the entry's cached
 * `searchText`. Decoupled from the caller so both the completion trigger and
 * the backfill reconciler can work from an entryId alone.
 */

import {
  ENTRY_BOARD_STORAGE_PREFIX,
  readEntryById,
} from "@/lib/journal-entries";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const pushText = (lines: string[], value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) lines.push(trimmed);
  }
};

/** Flatten a raw canvas snapshot into newline-separated plain text. */
function flattenRawSnapshot(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const lines: string[] = [];

  if (Array.isArray(raw.textColumns)) {
    for (const col of raw.textColumns) {
      if (!Array.isArray(col)) continue;
      for (const block of col) {
        if (isRecord(block)) pushText(lines, block.text);
      }
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

/** Whitespace-separated word count for plain journal text. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/** An entry's full plain text — snapshot first, cached `searchText` fallback. */
export function readEntryText(entryId: string): string {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(
        `${ENTRY_BOARD_STORAGE_PREFIX}${entryId}`,
      );
      if (raw) {
        const flattened = flattenRawSnapshot(JSON.parse(raw) as unknown);
        if (flattened) return flattened;
      }
    } catch {
      /* fall through to searchText */
    }
  }
  return readEntryById(entryId)?.searchText ?? "";
}
