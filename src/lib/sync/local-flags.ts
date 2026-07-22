/**
 * Sync bookkeeping in localStorage — dirty entry ids, delete tombstones,
 * a durable deleted-id set (so deletes never resurrect), a patterns-dirty
 * flag, the pull cursor, and the one-time import flag.
 *
 * Zero imports on purpose: the data stores (journal-entries, pattern stores)
 * call into this module, and the sync engine reads from it — keeping it
 * dependency-free avoids cycles.
 */

import "@/lib/storage-namespace";

const DIRTY_ENTRIES_KEY = "unfold-sync-dirty-entries";
const DELETED_ENTRIES_KEY = "unfold-sync-deleted-entries";
/** Durable set of entry ids the user (or sync) has deleted — never resurrect. */
const DELETED_IDS_KEY = "unfold-sync-deleted-ids";
const PATTERNS_DIRTY_KEY = "unfold-sync-patterns-dirty";
const PULL_CURSOR_KEY = "unfold-sync-cursor";
const IMPORTED_KEY = "unfold-sync-imported";

/** Fired whenever something becomes dirty — the sync provider debounces on it. */
export const SYNC_DIRTY_EVENT = "unfold-sync-dirty";

/**
 * Fired by `flushPendingSync` so in-memory editors (canvas / title) write through
 * to localStorage + dirty queues before a forced push (e.g. sign-out).
 */
export const FLUSH_LOCAL_WRITES_EVENT = "unfold-flush-local-writes";

/** Fired when a sync lock starts/ends — `{ status: "syncing" | "idle" }`. */
export const SYNC_STATUS_EVENT = "unfold-sync-status";

/** Fired once the first post-sign-in `fullSync` settles for this session. */
export const INITIAL_SYNC_DONE_EVENT = "unfold-initial-sync-done";

export type SyncStatusDetail = { status: "syncing" | "idle" };

const hasWindow = () => typeof window !== "undefined";

const readJson = <T>(key: string, fallback: T): T => {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* best effort */
  }
};

const notifyDirty = () => {
  if (!hasWindow()) return;
  window.dispatchEvent(new Event(SYNC_DIRTY_EVENT));
};

// The sync engine applies server data through the normal store write paths;
// suppression stops those applies from re-marking everything dirty and
// ping-ponging straight back to the server.
let dirtyTrackingSuppressed = false;

export const withDirtyTrackingSuppressed = <T>(fn: () => T): T => {
  dirtyTrackingSuppressed = true;
  try {
    return fn();
  } finally {
    dirtyTrackingSuppressed = false;
  }
};

// ── Dirty entries ───────────────────────────────────────────────────────────

export const markEntryDirty = (id: string) => {
  if (dirtyTrackingSuppressed) return;
  const ids = readJson<string[]>(DIRTY_ENTRIES_KEY, []);
  if (!ids.includes(id)) {
    writeJson(DIRTY_ENTRIES_KEY, [...ids, id]);
  }
  notifyDirty();
};

export const takeDirtyEntries = (): string[] => {
  const ids = readJson<string[]>(DIRTY_ENTRIES_KEY, []);
  writeJson(DIRTY_ENTRIES_KEY, []);
  return ids;
};

export const restoreDirtyEntries = (ids: string[]) => {
  if (ids.length === 0) return;
  const current = readJson<string[]>(DIRTY_ENTRIES_KEY, []);
  writeJson(DIRTY_ENTRIES_KEY, [...new Set([...current, ...ids])]);
};

/** Drop a single id from the dirty queue (e.g. after a local delete). */
export const clearDirtyEntry = (id: string) => {
  const ids = readJson<string[]>(DIRTY_ENTRIES_KEY, []);
  if (!ids.includes(id)) return;
  writeJson(
    DIRTY_ENTRIES_KEY,
    ids.filter((entryId) => entryId !== id),
  );
};

// ── Delete tombstones ───────────────────────────────────────────────────────

export type EntryTombstone = { id: string; deletedAt: number };

const rememberDeletedId = (id: string) => {
  const ids = readJson<string[]>(DELETED_IDS_KEY, []);
  if (ids.includes(id)) return;
  writeJson(DELETED_IDS_KEY, [...ids, id]);
};

/** True if this entry was deleted locally or via a server tombstone apply. */
export const isEntryDeleted = (id: string): boolean =>
  readJson<string[]>(DELETED_IDS_KEY, []).includes(id);

export const recordEntryTombstone = (id: string) => {
  if (dirtyTrackingSuppressed) return;
  rememberDeletedId(id);
  const tombstones = readJson<EntryTombstone[]>(DELETED_ENTRIES_KEY, []);
  if (!tombstones.some((t) => t.id === id)) {
    writeJson(DELETED_ENTRIES_KEY, [
      ...tombstones,
      { id, deletedAt: Date.now() },
    ]);
  }
  notifyDirty();
};

/**
 * Mark an id as permanently deleted without queuing a push (server already
 * has the tombstone, or we're applying a remote delete).
 */
export const rememberRemoteDelete = (id: string) => {
  rememberDeletedId(id);
};

/** True while a local delete is waiting to reach the server. */
export const hasEntryTombstone = (id: string): boolean =>
  readJson<EntryTombstone[]>(DELETED_ENTRIES_KEY, []).some((t) => t.id === id);

export const takeEntryTombstones = (): EntryTombstone[] => {
  const tombstones = readJson<EntryTombstone[]>(DELETED_ENTRIES_KEY, []);
  writeJson(DELETED_ENTRIES_KEY, []);
  return tombstones;
};

export const restoreEntryTombstones = (tombstones: EntryTombstone[]) => {
  if (tombstones.length === 0) return;
  const current = readJson<EntryTombstone[]>(DELETED_ENTRIES_KEY, []);
  const merged = [...current];
  for (const tombstone of tombstones) {
    if (!merged.some((t) => t.id === tombstone.id)) merged.push(tombstone);
  }
  writeJson(DELETED_ENTRIES_KEY, merged);
};

// ── Patterns dirty flag ─────────────────────────────────────────────────────

export const markPatternsDirty = () => {
  if (dirtyTrackingSuppressed) return;
  writeJson(PATTERNS_DIRTY_KEY, true);
  notifyDirty();
};

export const isPatternsDirty = (): boolean =>
  readJson<boolean>(PATTERNS_DIRTY_KEY, false);

export const clearPatternsDirty = () => {
  writeJson(PATTERNS_DIRTY_KEY, false);
};

/** True when dirty entries, delete tombstones, or patterns still need a push. */
export const hasPendingSync = (): boolean =>
  readJson<string[]>(DIRTY_ENTRIES_KEY, []).length > 0 ||
  readJson<EntryTombstone[]>(DELETED_ENTRIES_KEY, []).length > 0 ||
  readJson<boolean>(PATTERNS_DIRTY_KEY, false);

// ── Pull cursor + import flag ───────────────────────────────────────────────

export const getPullCursor = (): number => readJson<number>(PULL_CURSOR_KEY, 0);

export const setPullCursor = (cursor: number) => {
  writeJson(PULL_CURSOR_KEY, cursor);
};

export const isImported = (): boolean => readJson<boolean>(IMPORTED_KEY, false);

export const setImported = () => {
  writeJson(IMPORTED_KEY, true);
};
