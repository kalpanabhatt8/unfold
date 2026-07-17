/**
 * Background seal pipeline — commits seal state immediately and finishes title
 * generation independently of whichever entry is open in the editor.
 *
 * Safe to navigate away the moment this returns: persistence + title/analysis
 * continue without the canvas staying mounted.
 */

import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import { hasBookTitle } from "@/lib/book-title";
import {
  clearSealTitlePrefetch,
  fallbackSealTitle,
  fetchJournalTitle,
  MIN_WORDS_FOR_AI_TITLE,
  prefetchSealTitle,
  UNTITLED_ENTRY,
} from "@/lib/ai/title/client";
import {
  collectJournalWordTokens,
  extractJournalPlainText,
} from "@/lib/canvas-word-count";
import {
  ENTRY_BOARD_STORAGE_PREFIX,
  readEntryById,
  upsertEntry,
} from "@/lib/journal-entries";
import { notifyEntryCompleted } from "@/lib/patterns/entry-completion";

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

export const entryIdFromBoardStorageKey = (storageKey: string): string =>
  storageKey.startsWith(ENTRY_BOARD_STORAGE_PREFIX)
    ? storageKey.slice(ENTRY_BOARD_STORAGE_PREFIX.length)
    : storageKey.replace(/^keeps-board-/, "");

const persistBoardSnapshot = (entryId: string, snapshot: CanvasSnapshot) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${ENTRY_BOARD_STORAGE_PREFIX}${entryId}`,
      JSON.stringify(snapshot),
    );
  } catch {
    /* noop */
  }
};

/** In-flight guard — one active title job per entry. */
const titleJobs = new Set<string>();

const applySealTitleInBackground = (
  entryId: string,
  snapshot: CanvasSnapshot,
  existingTitle: string,
): void => {
  if (titleJobs.has(entryId)) return;
  titleJobs.add(entryId);

  const finish = (title: string) => {
    const entry = readEntryById(entryId);
    if (!entry) {
      titleJobs.delete(entryId);
      clearSealTitlePrefetch();
      return;
    }
    upsertEntry(entryId, {
      title,
      updatedAt: entry.updatedAt,
    });
    titleJobs.delete(entryId);
    clearSealTitlePrefetch();
  };

  const committedTitle = existingTitle.trim();
  if (hasBookTitle(committedTitle)) {
    titleJobs.delete(entryId);
    return;
  }

  const wordCount = collectJournalWordTokens(snapshot).length;
  if (wordCount < MIN_WORDS_FOR_AI_TITLE) {
    finish(UNTITLED_ENTRY);
    return;
  }

  const text = extractJournalPlainText(snapshot);
  const promise = prefetchSealTitle(text) ?? fetchJournalTitle(text);

  void promise
    .then((generated) => finish(generated))
    .catch(() => finish(fallbackSealTitle(text)));
};

/**
 * Commit an explicit seal for `entryId`. Idempotent — returns the existing
 * `sealedAt` when already sealed. Safe to call before navigating away.
 */
export const commitEntrySeal = (
  entryId: string,
  snapshot: CanvasSnapshot,
): number | null => {
  if (!entryId || typeof window === "undefined") return null;

  const existing = readEntryById(entryId);
  if (!existing) return null;
  if (typeof existing.sealedAt === "number") {
    return existing.sealedAt;
  }

  const now = Date.now();
  const sealedSnapshot: CanvasSnapshot = { ...snapshot, sealedAt: now };

  persistBoardSnapshot(entryId, sealedSnapshot);
  upsertEntry(entryId, {
    searchText: flattenSnapshotText(sealedSnapshot),
    sealedAt: now,
    updatedAt: existing?.updatedAt,
  });

  // Title + pattern analysis are intentionally async and unbound from the
  // open editor — navigating to a new entry mid-stamp must not wait on them.
  applySealTitleInBackground(entryId, sealedSnapshot, existing?.title ?? "");
  window.setTimeout(() => {
    void notifyEntryCompleted(entryId, "seal");
  }, 0);

  return now;
};
