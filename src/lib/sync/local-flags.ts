/**
 * Sync bookkeeping in localStorage — dirty entry ids, delete tombstones, a
 * patterns-dirty flag, the pull cursor, and the one-time import flag.
 *
 * Zero imports on purpose: the data stores (journal-entries, pattern stores)
 * call into this module, and the sync engine reads from it — keeping it
 * dependency-free avoids cycles.
 */

const DIRTY_ENTRIES_KEY = "keeps-sync-dirty-entries";
const DELETED_ENTRIES_KEY = "keeps-sync-deleted-entries";
const PATTERNS_DIRTY_KEY = "keeps-sync-patterns-dirty";
const PULL_CURSOR_KEY = "keeps-sync-cursor";
const IMPORTED_KEY = "keeps-sync-imported";

/** Fired whenever something becomes dirty — the sync provider debounces on it. */
export const SYNC_DIRTY_EVENT = "keeps-sync-dirty";

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

// ── Delete tombstones ───────────────────────────────────────────────────────

export type EntryTombstone = { id: string; deletedAt: number };

export const recordEntryTombstone = (id: string) => {
  if (dirtyTrackingSuppressed) return;
  const tombstones = readJson<EntryTombstone[]>(DELETED_ENTRIES_KEY, []);
  if (!tombstones.some((t) => t.id === id)) {
    writeJson(DELETED_ENTRIES_KEY, [
      ...tombstones,
      { id, deletedAt: Date.now() },
    ]);
  }
  notifyDirty();
};

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

// ── Pull cursor + import flag ───────────────────────────────────────────────

export const getPullCursor = (): number => readJson<number>(PULL_CURSOR_KEY, 0);

export const setPullCursor = (cursor: number) => {
  writeJson(PULL_CURSOR_KEY, cursor);
};

export const isImported = (): boolean => readJson<boolean>(IMPORTED_KEY, false);

export const setImported = () => {
  writeJson(IMPORTED_KEY, true);
};
