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

const boardStorageKey = (entryId: string) =>
  `${ENTRY_BOARD_STORAGE_PREFIX}${entryId}`;

const isDataUrlImage = (src: string) => src.startsWith("data:");

/** Drop inlined base64 images (common localStorage quota killer); keep remote URLs. */
const stripHeavyImages = (snapshot: CanvasSnapshot): CanvasSnapshot => ({
  ...snapshot,
  imageBlocks: snapshot.imageBlocks
    .filter((image) => !isDataUrlImage(image.src))
    .map((image, order) => ({ ...image, order })),
});

/**
 * Persist board snapshot. Returns false when the write did not stick
 * (quota / private mode). Retries once without heavy data-URL images.
 */
const persistBoardSnapshot = (
  entryId: string,
  snapshot: CanvasSnapshot,
): boolean => {
  if (typeof window === "undefined") return false;

  const key = boardStorageKey(entryId);
  const tryWrite = (snap: CanvasSnapshot): boolean => {
    try {
      const payload = JSON.stringify(snap);
      window.localStorage.setItem(key, payload);
      return window.localStorage.getItem(key) === payload;
    } catch {
      return false;
    }
  };

  if (tryWrite(snapshot)) return true;

  const stripped = stripHeavyImages(snapshot);
  if (
    stripped.imageBlocks.length !== snapshot.imageBlocks.length &&
    tryWrite(stripped)
  ) {
    return true;
  }

  return false;
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
  // Prefer a fresh fetch keyed to *this* seal snapshot. Prefetch is only reused
  // when its signature still matches — otherwise a hover-prefetch from earlier
  // text could title an empty/wrong board.
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
  const searchText = flattenSnapshotText(sealedSnapshot);

  const boardOk = persistBoardSnapshot(entryId, sealedSnapshot);
  if (!boardOk && searchText.length > 0) {
    // Last resort: text-only board so reopen is not blank under a generated title.
    const textOnly: CanvasSnapshot = {
      ...sealedSnapshot,
      imageBlocks: [],
    };
    persistBoardSnapshot(entryId, textOnly);
  }

  upsertEntry(entryId, {
    searchText,
    sealedAt: now,
    // Bump so sync LWW prefers this sealed copy over an older empty draft.
    updatedAt: now,
  });

  // Title + pattern analysis are intentionally async and unbound from the
  // open editor — navigating to a new entry mid-stamp must not wait on them.
  applySealTitleInBackground(entryId, sealedSnapshot, existing?.title ?? "");
  window.setTimeout(() => {
    void notifyEntryCompleted(entryId, "seal");
  }, 0);

  return now;
};
