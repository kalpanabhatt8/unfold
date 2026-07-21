/**
 * Journal entry metadata — the sidebar's single source of truth.
 *
 * Entry {
 *   id, title, createdAt, updatedAt, sealedAt, crisisFlagged,
 *   crisisFlaggedAt, qualityFlagged, qualityFlaggedAt, searchText
 * }
 *
 * `content` itself is NOT stored here — the canvas owns it entirely at
 * `unfold-board-{id}` (a `CanvasSnapshot`, untouched by this file). We only
 * cache a flattened plain-text copy (`searchText`) alongside the metadata so
 * the sidebar can search titles + content without re-reading every board
 * snapshot on each keystroke.
 */

import "@/lib/storage-namespace";
import { startTransition } from "react";
import {
  clearDirtyEntry,
  isEntryDeleted,
  markEntryDirty,
  recordEntryTombstone,
  rememberRemoteDelete,
} from "@/lib/sync/local-flags";

export const ENTRY_DRAFTS_STORAGE_KEY = "unfold-drafts";
export const ENTRIES_UPDATED_EVENT = "unfold-recents-updated";
export const ENTRY_BOARD_STORAGE_PREFIX = "unfold-board-";

export type JournalEntry = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Canvas header stamp — frozen for the whole editing session. */
  lastEditedAt?: number;
  /** Unix ms when sealed; `null`/absent = still a draft. */
  sealedAt?: number | null;
  /** Crisis-risk gate — boolean only; never store reasoning or snippets. */
  crisisFlagged?: boolean;
  /** Unix ms when crisis was flagged; absent/null when not flagged. */
  crisisFlaggedAt?: number | null;
  /** Content-quality gate — boolean only; never store reasoning or snippets. */
  qualityFlagged?: boolean;
  /** Unix ms when quality was flagged; absent/null when not flagged. */
  qualityFlaggedAt?: number | null;
  /** Flattened plain text of the entry's blocks, used for content search. */
  searchText?: string;
};

type EntryRecord = JournalEntry & Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeEntry = (value: unknown): JournalEntry | null => {
  if (!isRecord(value)) return null;
  const { id, title } = value;
  if (typeof id !== "string" || typeof title !== "string") return null;

  const updatedAtRaw = value.updatedAt;
  const updatedAt =
    typeof updatedAtRaw === "number" && Number.isFinite(updatedAtRaw)
      ? updatedAtRaw
      : 0;

  const createdAtRaw = value.createdAt;
  const createdAt =
    typeof createdAtRaw === "number" && Number.isFinite(createdAtRaw)
      ? createdAtRaw
      : updatedAt;

  const normalized: JournalEntry = { id, title, createdAt, updatedAt };

  if (
    typeof value.lastEditedAt === "number" &&
    Number.isFinite(value.lastEditedAt)
  ) {
    normalized.lastEditedAt = value.lastEditedAt;
  }

  if (typeof value.sealedAt === "number" && Number.isFinite(value.sealedAt)) {
    normalized.sealedAt = value.sealedAt;
  } else if (value.sealedAt === null) {
    normalized.sealedAt = null;
  }

  if (value.crisisFlagged === true) {
    normalized.crisisFlagged = true;
  } else if (value.crisisFlagged === false) {
    normalized.crisisFlagged = false;
  }

  if (
    typeof value.crisisFlaggedAt === "number" &&
    Number.isFinite(value.crisisFlaggedAt)
  ) {
    normalized.crisisFlaggedAt = value.crisisFlaggedAt;
  } else if (value.crisisFlaggedAt === null) {
    normalized.crisisFlaggedAt = null;
  }

  if (value.qualityFlagged === true) {
    normalized.qualityFlagged = true;
  } else if (value.qualityFlagged === false) {
    normalized.qualityFlagged = false;
  }

  if (
    typeof value.qualityFlaggedAt === "number" &&
    Number.isFinite(value.qualityFlaggedAt)
  ) {
    normalized.qualityFlaggedAt = value.qualityFlaggedAt;
  } else if (value.qualityFlaggedAt === null) {
    normalized.qualityFlaggedAt = null;
  }

  if (typeof value.searchText === "string") {
    normalized.searchText = value.searchText;
  }

  return normalized;
};

const readDraftsRaw = (): Record<string, unknown> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ENTRY_DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch (error) {
    console.error("Failed to read journal entries", error);
    return {};
  }
};

const writeDraftsRaw = (drafts: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ENTRY_DRAFTS_STORAGE_KEY,
      JSON.stringify(drafts),
    );
    // Defer sidebar refresh so urgent work (route changes after "+" / seal)
    // is not blocked behind a recents-list re-render.
    startTransition(() => {
      window.dispatchEvent(new Event(ENTRIES_UPDATED_EVENT));
    });
  } catch (error) {
    console.error("Failed to save journal entries", error);
  }
};

export const createEntryId = () =>
  `entry-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const readEntryById = (id: string): JournalEntry | null => {
  const drafts = readDraftsRaw();
  const entry = drafts[id];
  if (!isRecord(entry)) return null;
  return normalizeEntry({ ...entry, id });
};

/** All journal entries, newest `createdAt` first. No cap — the sidebar is the only nav surface. */
export const readAllEntries = (): JournalEntry[] => {
  const drafts = readDraftsRaw();
  return Object.entries(drafts)
    .map(([id, value]) => normalizeEntry({ ...(value as object), id }))
    .filter((item): item is JournalEntry => Boolean(item))
    .sort((a, b) => b.createdAt - a.createdAt);
};

/** Merge fields into an entry's stored record (creating it if needed) and notify the sidebar. */
export const upsertEntry = (
  id: string,
  updates: Partial<Omit<JournalEntry, "id">>,
): JournalEntry => {
  const now = Date.now();

  // A deleted entry must never be recreated by a late canvas save or hydrate.
  if (isEntryDeleted(id)) {
    return (
      readEntryById(id) ?? {
        id,
        title: updates.title ?? "",
        createdAt: updates.createdAt ?? now,
        updatedAt: updates.updatedAt ?? now,
      }
    );
  }

  const drafts = readDraftsRaw();
  const existing = isRecord(drafts[id])
    ? (drafts[id] as EntryRecord)
    : undefined;

  const next: EntryRecord = {
    ...(existing ?? {}),
    ...updates,
    id,
    title: updates.title !== undefined ? updates.title : existing?.title ?? "",
    createdAt: existing?.createdAt ?? updates.createdAt ?? now,
    updatedAt: updates.updatedAt ?? now,
  };

  // Once sealed, never accidentally clear sealedAt via a stale canvas mirror.
  if (
    typeof existing?.sealedAt === "number" &&
    (updates.sealedAt === null || updates.sealedAt === undefined)
  ) {
    next.sealedAt = existing.sealedAt;
  }

  // Once crisis-flagged, never clear via a stale merge that omits the fields.
  if (existing?.crisisFlagged === true) {
    next.crisisFlagged = true;
    if (
      updates.crisisFlaggedAt === null ||
      updates.crisisFlaggedAt === undefined
    ) {
      next.crisisFlaggedAt =
        typeof existing.crisisFlaggedAt === "number"
          ? existing.crisisFlaggedAt
          : next.crisisFlaggedAt;
    }
  }

  // Once quality-flagged, never clear via a stale merge that omits the fields.
  if (existing?.qualityFlagged === true) {
    next.qualityFlagged = true;
    if (
      updates.qualityFlaggedAt === null ||
      updates.qualityFlaggedAt === undefined
    ) {
      next.qualityFlaggedAt =
        typeof existing.qualityFlaggedAt === "number"
          ? existing.qualityFlaggedAt
          : next.qualityFlaggedAt;
    }
  }

  drafts[id] = next;
  writeDraftsRaw(drafts);
  markEntryDirty(id);
  return normalizeEntry(next) ?? next;
};

export const deleteEntry = (id: string) => {
  const drafts = readDraftsRaw();
  if (!(id in drafts)) return;
  delete drafts[id];
  writeDraftsRaw(drafts);
  clearDirtyEntry(id);
  recordEntryTombstone(id);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(`${ENTRY_BOARD_STORAGE_PREFIX}${id}`);
    } catch {
      // ignore storage cleanup errors
    }
  }
};

/**
 * Apply a server-won copy locally WITHOUT re-marking it dirty — used by the
 * sync engine so pull-applies don't ping-pong back to the server.
 */
export const applyRemoteEntry = (entry: JournalEntry) => {
  // Never resurrect a locally deleted entry from a live server copy.
  if (isEntryDeleted(entry.id)) return;

  const drafts = readDraftsRaw();
  drafts[entry.id] = { ...entry };
  writeDraftsRaw(drafts);
};

/** Apply a server-side delete locally without recording a new tombstone. */
export const applyRemoteDelete = (id: string) => {
  rememberRemoteDelete(id);
  const drafts = readDraftsRaw();
  if (id in drafts) {
    delete drafts[id];
    writeDraftsRaw(drafts);
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(`${ENTRY_BOARD_STORAGE_PREFIX}${id}`);
    } catch {
      // ignore storage cleanup errors
    }
  }
};
