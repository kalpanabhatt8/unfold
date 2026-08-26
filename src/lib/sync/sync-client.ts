/**
 * Client sync engine - localStorage stays the instant write-through cache,
 * the server is authoritative. Last-write-wins at whole-entry granularity
 * (client `updatedAt` clock); the pattern layer syncs as whole snapshots.
 * Deletes are sticky: tombstones always win over live content.
 *
 * Flow (`fullSync`):
 *   1. one-time import of pre-cloud local data
 *   2. push pending delete tombstones first (so pull cannot resurrect them)
 *   3. pull entries changed since the last cursor (incl. tombstones) + apply
 *   4. pull the pattern layer + apply
 *   5. push dirty live entries and, when flagged, the pattern snapshot
 */

import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import { contentHash } from "@/lib/content-hash";
import {
  applyRemoteDelete,
  applyRemoteEntry,
  ENTRY_BOARD_STORAGE_PREFIX,
  readAllEntries,
  readEntryById,
  type JournalEntry,
} from "@/lib/journal-entries";
import { listAnalyses, putAnalysis } from "@/lib/patterns/analysis-store";
import {
  listCachedDisplays,
  putCachedDisplay,
} from "@/lib/patterns/pattern-display-store";
import { getState, listStates, putState } from "@/lib/patterns/pattern-state";
import { isCompleteVoicePassage } from "@/lib/patterns/passage-fill";
import {
  getCachedPassage,
  listCachedPassages,
  putCachedPassage,
} from "@/lib/patterns/passage-store";
import { listServerReadyPatterns } from "@/lib/patterns/server-ready-patterns";
import {
  listVotes,
  putVoteQuiet,
} from "@/lib/patterns/pattern-vote-store";
import { isPatternName } from "@/lib/patterns/vocabulary-public";
import {
  clearPatternsDirty,
  FLUSH_LOCAL_WRITES_EVENT,
  getPullCursor,
  hasEntryTombstone,
  hasPendingSync,
  INITIAL_PATTERNS_SYNC_DONE_EVENT,
  INITIAL_SYNC_DONE_EVENT,
  PATTERNS_HYDRATED_EVENT,
  isEntryDeleted,
  isImported,
  isPatternsDirty,
  markPatternsDirty,
  restoreDirtyEntries,
  restoreEntryTombstones,
  setImported,
  setPullCursor,
  SYNC_STATUS_EVENT,
  takeDirtyEntries,
  takeEntryTombstones,
  withDirtyTrackingSuppressed,
  type EntryTombstone,
  type SyncStatusDetail,
} from "@/lib/sync/local-flags";
import { waitForSyncScope } from "@/lib/sync/sync-scope";
import { clearSessionPatternCache } from "@/lib/patterns/client-session-cache";
import type {
  EntriesPullResponse,
  EntryPushResult,
  PatternsPullMeta,
  PatternsPullResponse,
  PatternsSnapshot,
  WireEntry,
} from "@/lib/sync/wire-types";

const emitSyncStatus = (status: SyncStatusDetail["status"]) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SyncStatusDetail>(SYNC_STATUS_EVENT, { detail: { status } }),
  );
};
// ── Local readers ───────────────────────────────────────────────────────────

const readBoardSnapshot = (entryId: string): CanvasSnapshot | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `${ENTRY_BOARD_STORAGE_PREFIX}${entryId}`,
    );
    return raw ? (JSON.parse(raw) as CanvasSnapshot) : null;
  } catch {
    return null;
  }
};

const writeBoardSnapshot = (entryId: string, snapshot: CanvasSnapshot) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${ENTRY_BOARD_STORAGE_PREFIX}${entryId}`,
      JSON.stringify(snapshot),
    );
  } catch {
    /* best effort */
  }
};

const toWireEntry = (entry: JournalEntry): WireEntry => ({
  id: entry.id,
  title: entry.title,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  lastEditedAt: entry.lastEditedAt ?? null,
  sealedAt: entry.sealedAt ?? null,
  deletedAt: null,
  crisisFlagged: entry.crisisFlagged === true,
  crisisFlaggedAt: entry.crisisFlaggedAt ?? null,
  qualityFlagged: entry.qualityFlagged === true,
  qualityFlaggedAt: entry.qualityFlaggedAt ?? null,
  searchText: entry.searchText ?? "",
  contentHash: contentHash(entry.searchText ?? ""),
  content: readBoardSnapshot(entry.id),
});

const collectPatternsSnapshot = (): PatternsSnapshot => ({
  analyses: listAnalyses(),
  states: listStates(),
  passages: listCachedPassages(),
  displays: listCachedDisplays().map(({ patternName, display }) => ({
    patternName,
    evidenceKey: display.sourceEvidenceKey,
    displayTitle: display.displayTitle,
    summary: display.summary,
    createdAt: display.createdAt,
  })),
  votes: listVotes().map((v) => ({
    patternName: v.patternName,
    entryIds: v.entryIds,
    vote: v.vote,
    updatedAt: v.updatedAt,
  })),
});

// ── Applying server data locally (dirty tracking suppressed) ────────────────

const applyServerEntry = (wire: WireEntry) => {
  if (wire.deletedAt) {
    withDirtyTrackingSuppressed(() => applyRemoteDelete(wire.id));
    return;
  }

  // A pending local delete (or durable deleted id) must not be undone by a
  // live pull copy.
  if (isEntryDeleted(wire.id) || hasEntryTombstone(wire.id)) return;

  const local = readEntryById(wire.id);
  if (local && local.updatedAt >= wire.updatedAt) return; // local copy wins

  withDirtyTrackingSuppressed(() => {
    applyRemoteEntry({
      id: wire.id,
      title: wire.title,
      createdAt: wire.createdAt,
      updatedAt: wire.updatedAt,
      lastEditedAt: wire.lastEditedAt ?? undefined,
      sealedAt: wire.sealedAt ?? null,
      crisisFlagged: wire.crisisFlagged === true,
      crisisFlaggedAt: wire.crisisFlaggedAt ?? null,
      qualityFlagged: wire.qualityFlagged === true,
      qualityFlaggedAt: wire.qualityFlaggedAt ?? null,
      searchText: wire.searchText,
    });
    if (wire.content) {
      const localBoard = readBoardSnapshot(wire.id);
      const incomingHasText = wire.content.textColumns?.some((col) =>
        col.some((b) => typeof b.text === "string" && b.text.trim().length > 0),
      );
      const localHasText = localBoard?.textColumns.some((col) =>
        col.some((b) => b.text.trim().length > 0),
      );
      // Never clobber a local sealed body with an empty remote snapshot.
      if (!incomingHasText && localHasText && wire.sealedAt) {
        /* keep local board */
      } else {
        writeBoardSnapshot(wire.id, wire.content);
      }
    }
  });
};

const applyServerPatterns = (snapshot: PatternsSnapshot) => {
  withDirtyTrackingSuppressed(() => {
    for (const analysis of snapshot.analyses) {
      putAnalysis(analysis);
    }
    for (const state of snapshot.states) {
      const local = getState(state.name);
      const localPassage = getCachedPassage(state.name);
      const localComplete =
        localPassage != null && isCompleteVoicePassage(localPassage);
      // Server artifacts are authoritative unless local offline planning is
      // strictly ahead *and* still has a complete passage to show.
      if (
        local?.evidenceKey &&
        local.lastPlanAt > state.lastPlanAt &&
        localComplete
      ) {
        continue;
      }
      putState(state);
    }
    for (const passage of snapshot.passages) {
      putCachedPassage(passage);
    }
    for (const { patternName, evidenceKey, displayTitle, summary, createdAt } of
      snapshot.displays) {
      if (!isPatternName(patternName)) continue;
      putCachedDisplay(patternName, evidenceKey, {
        displayTitle,
        summary,
        createdAt,
      });
    }
    for (const vote of snapshot.votes ?? []) {
      if (!isPatternName(vote.patternName)) continue;
      if (vote.vote !== "up" && vote.vote !== "down") continue;
      putVoteQuiet({
        patternName: vote.patternName,
        entryIds: Array.isArray(vote.entryIds) ? vote.entryIds : [],
        vote: vote.vote,
        updatedAt: vote.updatedAt,
      });
    }
  });
};

// ── Network steps ───────────────────────────────────────────────────────────

/**
 * Fetch + JSON parse that treats network drops and HTML error/auth pages as
 * soft failures (null) instead of throwing TypeError / SyntaxError into sync.
 */
const fetchJson = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> => {
  try {
    const response = await fetch(input, init);
    if (!response.ok) return { ok: false, status: response.status };

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      // HTML sign-in / Next error pages look like 200 until you parse them.
      await response.text().catch(() => undefined);
      return { ok: false, status: response.status };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
};

/** Returns false when the server could not be reached / rejected the pull. */
const pullAndApplyEntries = async (): Promise<boolean> => {
  let since = getPullCursor();
  // Page until the server says we're caught up - keeps each response small
  // when the account has many large board snapshots.
  for (let page = 0; page < 50; page++) {
    const result = await fetchJson<EntriesPullResponse>(
      `/api/sync/entries?since=${since}`,
    );
    if (!result.ok) return false;
    const payload = result.data;
    for (const entry of payload.entries) {
      applyServerEntry(entry);
    }
    setPullCursor(payload.cursor);
    if (!payload.hasMore) return true;
    since = payload.cursor;
  }
  return true;
};

const recordPatternsPullMeta = (payload: PatternsPullResponse): void => {
  lastPatternsPullMeta = payload.meta ?? {
    states: payload.states.length,
    passages: payload.passages.length,
    displays: payload.displays.length,
  };
};

const pullAndApplyPatternsOnce = async (): Promise<boolean> => {
  patternsPullAttempted = true;
  let cursor: string | null = null;
  let anyPageOk = false;
  // Page analyses until caught up - meta tables arrive on page 1 only.
  for (let page = 0; page < 50; page++) {
    const url: string = cursor
      ? `/api/sync/patterns?cursor=${encodeURIComponent(cursor)}`
      : "/api/sync/patterns";
    const result = await fetchJson<PatternsPullResponse>(url);
    if (!result.ok) {
      patternsPullSucceeded = anyPageOk;
      return anyPageOk;
    }
    anyPageOk = true;
    const payload: PatternsPullResponse = result.data;
    applyServerPatterns(payload);
    if (!cursor) {
      recordPatternsPullMeta(payload);
      markPatternsMetaHydrated();
    }
    if (!payload.hasMore) {
      patternsPullSucceeded = true;
      return true;
    }
    cursor = payload.cursor ?? null;
    if (!cursor) {
      patternsPullSucceeded = true;
      return true;
    }
  }
  patternsPullSucceeded = anyPageOk;
  return anyPageOk;
};

const PATTERNS_PULL_MAX_ATTEMPTS = 3;

const pullAndApplyPatterns = async (): Promise<boolean> => {
  for (let attempt = 0; attempt < PATTERNS_PULL_MAX_ATTEMPTS; attempt++) {
    const ok = await pullAndApplyPatternsOnce();
    if (!ok) {
      if (attempt + 1 < PATTERNS_PULL_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
      continue;
    }
    const meta = lastPatternsPullMeta;
    if (
      meta &&
      meta.passages > 0 &&
      listServerReadyPatterns().length === 0 &&
      attempt + 1 < PATTERNS_PULL_MAX_ATTEMPTS
    ) {
      // Server sent passages but local caches did not surface them — retry apply.
      await new Promise((resolve) => setTimeout(resolve, 200));
      continue;
    }
    return true;
  }
  return patternsPullSucceeded;
};

const toTombstoneWire = (tombstone: EntryTombstone): WireEntry => ({
  id: tombstone.id,
  title: "",
  createdAt: tombstone.deletedAt,
  updatedAt: Date.now(),
  deletedAt: tombstone.deletedAt,
  searchText: "",
  contentHash: "",
  content: null,
});

/** Push local deletes before pull so a live server copy cannot resurrect them. */
const pushEntryTombstones = async (): Promise<void> => {
  const tombstones = takeEntryTombstones();
  if (tombstones.length === 0) return;

  const result = await fetchJson<{ results: EntryPushResult[] }>(
    "/api/sync/entries",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: tombstones.map(toTombstoneWire),
      }),
    },
  );
  if (!result.ok) {
    restoreEntryTombstones(tombstones);
    return;
  }

  const rejected: EntryTombstone[] = [];
  for (const pushResult of result.data.results) {
    const tombstone = tombstones.find((t) => t.id === pushResult.id);
    if (!tombstone) continue;
    if (pushResult.accepted) continue;

    if (pushResult.server?.deletedAt) {
      // Server already has the delete - apply locally, drop the tombstone.
      applyServerEntry(pushResult.server);
      continue;
    }

    // Keep retrying; never apply a live server copy over a local delete.
    rejected.push(tombstone);
  }
  restoreEntryTombstones(rejected);
};

const pushDirtyEntries = async (): Promise<void> => {
  // Always flush deletes first so a dirty live push cannot race them.
  await pushEntryTombstones();

  const dirtyIds = takeDirtyEntries();
  if (dirtyIds.length === 0) return;

  const entries: WireEntry[] = [];
  for (const id of dirtyIds) {
    // Deleted ids are owned by the tombstone path - never push live content.
    if (isEntryDeleted(id) || hasEntryTombstone(id)) continue;
    const entry = readEntryById(id);
    if (entry) entries.push(toWireEntry(entry));
  }
  if (entries.length === 0) return;

  const pushedIds = entries.map((entry) => entry.id);

  const result = await fetchJson<{ results: EntryPushResult[] }>(
    "/api/sync/entries",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    },
  );
  if (!result.ok) {
    // Offline or server error - restore the queues for the next attempt.
    restoreDirtyEntries(pushedIds);
    return;
  }

  for (const pushResult of result.data.results) {
    if (!pushResult.accepted && pushResult.server) {
      applyServerEntry(pushResult.server);
    }
  }
};

const pushPatternsIfDirty = async (): Promise<void> => {
  if (!isPatternsDirty()) return;
  clearPatternsDirty();
  const result = await fetchJson<unknown>("/api/sync/patterns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(collectPatternsSnapshot()),
  });
  if (!result.ok) markPatternsDirty();
};

// ── One-time import of pre-cloud local data ─────────────────────────────────

const maybeImport = async (): Promise<void> => {
  if (isImported()) return;

  const status = await fetchJson<{ hasServerData: boolean }>("/api/import");
  if (!status.ok) return; // signed out / server issue - retry next sync
  const { hasServerData } = status.data;

  if (hasServerData) {
    // Account already has cloud data - pulls will populate this device.
    setImported();
    return;
  }

  const entries = readAllEntries();
  // One entry per request: embedded base64 images can make payloads large.
  for (const entry of entries) {
    const response = await fetchJson("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [toWireEntry(entry)] }),
    });
    if (!response.ok) return; // abort - flag stays unset, retried next sync
  }

  // A brand-new account has nothing to migrate - skip the patterns POST so
  // sign-up doesn't pay a round trip just to upload an empty snapshot.
  const patterns = collectPatternsSnapshot();
  const hasPatternData =
    patterns.analyses.length > 0 ||
    patterns.states.length > 0 ||
    patterns.passages.length > 0 ||
    patterns.displays.length > 0 ||
    (patterns.votes?.length ?? 0) > 0;

  if (hasPatternData) {
    const response = await fetchJson("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patterns }),
    });
    if (!response.ok) return;
  }

  setImported();
};

// ── Entry point ─────────────────────────────────────────────────────────────

/** Serializes full/push/flush so overlapping callers never share the network pass. */
let syncGate: Promise<void> = Promise.resolve();

const withSyncLock = async (fn: () => Promise<void>): Promise<void> => {
  const previous = syncGate;
  let release!: () => void;
  syncGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  emitSyncStatus("syncing");
  try {
    await fn();
  } finally {
    emitSyncStatus("idle");
    release();
  }
};

/**
 * True once a pull has reconciled local entries with the server in this
 * session. Until then an empty store means "not loaded yet", not "no entries",
 * so callers must not mint a draft off it.
 */
let entriesPulled = false;

export const hasPulledEntries = (): boolean => entriesPulled;

export const fullSync = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  // Never touch local storage before we know whose data it is - a wipe landing
  // mid-pass would erase the entries and cursor this pass just applied.
  await waitForSyncScope();
  // Captured before the lock so a pass superseded by a re-scope can't report
  // its entries as reconciled against the new gate.
  const generation = initialSyncGeneration;
  await withSyncLock(async () => {
    try {
      await maybeImport();
      // Push deletes before pull so a live server copy cannot reappear locally.
      await pushEntryTombstones();
      const pulled = await pullAndApplyEntries();
      entriesPulled = pulled || entriesPulled;
      // Entries are reconciled: unblock routing + clear skeletons now, before
      // the patterns pull and pushes below - none of which routing needs.
      if (pulled && generation === initialSyncGeneration) {
        markEntriesReconciled();
      }
      await pullAndApplyPatterns();
      await pushDirtyEntries();
      await pushPatternsIfDirty();
    } catch (error) {
      console.error("Sync failed", error);
    }
  });
};

/** Push-only pass - used on the dirty-event debounce between full syncs. */
export const pushSync = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  await waitForSyncScope();
  await withSyncLock(async () => {
    try {
      await pushDirtyEntries();
      await pushPatternsIfDirty();
    } catch (error) {
      console.error("Sync push failed", error);
    }
  });
};

/**
 * Persist any in-memory editor state, then push all dirty queues to the server.
 * Returns true when nothing remains pending. Used before sign-out.
 */
export const flushPendingSync = async (): Promise<boolean> => {
  if (typeof window === "undefined") return true;

  // Synchronous: canvas / title listeners write through to local dirty queues.
  window.dispatchEvent(new Event(FLUSH_LOCAL_WRITES_EVENT));

  const pushAll = async () => {
    await pushEntryTombstones();
    await pushDirtyEntries();
    await pushPatternsIfDirty();
  };

  await withSyncLock(async () => {
    try {
      await pushAll();
    } catch (error) {
      console.error("Sync flush failed", error);
    }
  });

  // One more pass if something was marked dirty while the flush ran.
  if (hasPendingSync()) {
    await withSyncLock(async () => {
      try {
        await pushAll();
      } catch (error) {
        console.error("Sync flush retry failed", error);
      }
    });
  }

  return !hasPendingSync();
};

// ── Initial sync gate (skeletons / dashboard routing) ───────────────────────

let initialSyncCompleted = false;
let initialSyncPromise: Promise<void> | null = null;
/** Bumped on every re-scope so a superseded pass cannot report readiness. */
let initialSyncGeneration = 0;

/** True after pattern meta (states/passages/displays) applied from pull page 1. */
let patternsMetaHydrated = false;
let patternsPullAttempted = false;
let patternsPullSucceeded = false;
let lastPatternsPullMeta: PatternsPullMeta | null = null;
let patternsHydratedPromise: Promise<void> | null = null;
let patternsHydratedResolve: (() => void) | null = null;

export const hasPatternsMetaHydrated = (): boolean => patternsMetaHydrated;
export const hasPatternsPullAttempted = (): boolean => patternsPullAttempted;
export const hasPatternsPullSucceeded = (): boolean => patternsPullSucceeded;
export const getLastPatternsPullMeta = (): PatternsPullMeta | null =>
  lastPatternsPullMeta;

const patternsHydratedGate = (): Promise<void> => {
  if (!patternsHydratedPromise) {
    patternsHydratedPromise = new Promise<void>((resolve) => {
      patternsHydratedResolve = resolve;
    });
  }
  return patternsHydratedPromise;
};

const markPatternsMetaHydrated = (): void => {
  if (patternsMetaHydrated) return;
  patternsMetaHydrated = true;
  patternsHydratedResolve?.();
  patternsHydratedResolve = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PATTERNS_HYDRATED_EVENT));
  }
};

// Entries-ready gate. Resolves as soon as one pass reconciles entries with the
// server (or a pass settles without a successful pull). Routing waits on this
// rather than the whole pass, so opening the first entry no longer blocks on
// the patterns pull + pushes that trail the entries pull inside `fullSync`.
let entriesReconciled = false;
let entriesReadyPromise: Promise<void> | null = null;
let entriesReadyResolve: (() => void) | null = null;

const entriesReadyGate = (): Promise<void> => {
  if (!entriesReadyPromise) {
    entriesReadyPromise = new Promise<void>((resolve) => {
      entriesReadyResolve = resolve;
    });
  }
  return entriesReadyPromise;
};

/** Unblock routing + clear skeletons; fired once per gate generation. */
const markEntriesReconciled = (): void => {
  if (entriesReconciled) return;
  entriesReconciled = true;
  entriesReadyGate();
  entriesReadyResolve?.();
  entriesReadyResolve = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(INITIAL_SYNC_DONE_EVENT));
  }
};

export const isInitialSyncCompleted = (): boolean => initialSyncCompleted;

/** True once entries have been reconciled this session (routing may proceed). */
export const hasReconciledEntries = (): boolean => entriesReconciled;

/** Cleared when local caches are wiped for a new signed-in user. */
export const resetInitialSyncGate = (): void => {
  initialSyncGeneration += 1;
  initialSyncCompleted = false;
  initialSyncPromise = null;
  patternsMetaHydrated = false;
  patternsPullAttempted = false;
  patternsPullSucceeded = false;
  lastPatternsPullMeta = null;
  patternsHydratedPromise = null;
  patternsHydratedResolve = null;
  clearSessionPatternCache();
  // The wipe discarded whatever the previous pull reconciled.
  entriesPulled = false;
  entriesReconciled = false;
  entriesReadyPromise = null;
  entriesReadyResolve = null;
};

const markInitialSyncCompleted = (): void => {
  initialSyncCompleted = true;
  // Fallback: if the entries pull never succeeded, still unblock routing once
  // the pass settles so a transient failure can't strand the skeleton.
  markEntriesReconciled();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(INITIAL_PATTERNS_SYNC_DONE_EVENT));
  }
};

/**
 * Kick the first full pass and resolve as soon as entries are reconciled -
 * routing does not need the trailing patterns pull + pushes. Safe to call from
 * SyncProvider, dashboard routing, and journal hydrate; concurrent callers
 * share the same pass.
 *
 * If a re-scope supersedes the pass we were awaiting, await the replacement
 * too: returning off an orphaned pass would let callers read a store that was
 * just wiped and had no chance to refill.
 */
export const ensureInitialSync = async (): Promise<void> => {
  if (typeof window === "undefined") return;

  while (!entriesReconciled) {
    const generation = initialSyncGeneration;
    const ready = entriesReadyGate();
    if (!initialSyncPromise) {
      initialSyncPromise = fullSync().finally(() => {
        if (generation === initialSyncGeneration) markInitialSyncCompleted();
      });
    }
    await ready;
    if (generation === initialSyncGeneration) return;
  }
};

/**
 * Wait until pattern titles/voice meta has been pulled and applied at least once.
 * Safe to call from the Patterns page — kicks or joins the in-flight full sync.
 */
export const ensurePatternsHydrated = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  if (hasPatternsMetaHydrated()) return;

  await waitForSyncScope();

  while (!hasPatternsMetaHydrated()) {
    const generation = initialSyncGeneration;
    const ready = patternsHydratedGate();
    if (!initialSyncPromise) {
      initialSyncPromise = fullSync().finally(() => {
        if (generation === initialSyncGeneration) markInitialSyncCompleted();
      });
    }
    await ready;
    if (generation === initialSyncGeneration) return;
  }
};
