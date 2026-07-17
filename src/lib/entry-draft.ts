/**
 * Draft lifecycle helpers — keep at most one empty unsealed entry.
 *
 * Board content lives at `keeps-board-{id}`; metadata at `keeps-drafts`.
 * Reads snapshots as raw JSON to avoid pulling in the canvas runtime.
 *
 * Creating a draft is sync and cheap; callers should navigate immediately
 * afterward. Seal/title work for any previous entry runs in the background
 * via `journal-seal.ts` and must not gate this path.
 */

import {
  createEntryId,
  ENTRY_BOARD_STORAGE_PREFIX,
  readAllEntries,
  upsertEntry,
  type JournalEntry,
} from "@/lib/journal-entries";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readBoardRaw = (entryId: string): unknown | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `${ENTRY_BOARD_STORAGE_PREFIX}${entryId}`,
    );
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
};

const boardHasText = (raw: unknown): boolean => {
  if (!isRecord(raw) || !Array.isArray(raw.textColumns)) return false;
  for (const col of raw.textColumns) {
    if (!Array.isArray(col)) continue;
    for (const block of col) {
      if (isRecord(block) && typeof block.text === "string") {
        if (block.text.trim().length > 0) return true;
      }
    }
  }
  const signature = raw.signature;
  return typeof signature === "string" && signature.trim().length > 0;
};

const boardHasAttachments = (raw: unknown): boolean => {
  if (!isRecord(raw) || !Array.isArray(raw.imageBlocks)) return false;
  return raw.imageBlocks.some(
    (image) => isRecord(image) && typeof image.src === "string" && image.src.length > 0,
  );
};

/** Unsealed entry with no written text and no image attachments. */
export const isEmptyDraftEntry = (entry: JournalEntry): boolean => {
  if (typeof entry.sealedAt === "number") return false;

  const board = readBoardRaw(entry.id);
  if (board) {
    return !boardHasText(board) && !boardHasAttachments(board);
  }

  return (entry.searchText ?? "").trim().length === 0;
};

/** Newest empty unsealed draft, if any. */
export const findEmptyDraftEntry = (): JournalEntry | null =>
  readAllEntries().find(isEmptyDraftEntry) ?? null;

/** Reuse an empty draft or create a fresh one. */
export const resolveNewEntryTarget = (): { id: string; created: boolean } => {
  const existing = findEmptyDraftEntry();
  if (existing) {
    return { id: existing.id, created: false };
  }

  const id = createEntryId();
  upsertEntry(id, { title: "" });
  return { id, created: true };
};
