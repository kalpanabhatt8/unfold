/**
 * Client sync engine — localStorage stays the instant write-through cache,
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
import {
  listCachedPassages,
  putCachedPassage,
} from "@/lib/patterns/passage-store";
import {
  listVotes,
  putVoteQuiet,
} from "@/lib/patterns/pattern-vote-store";
import { isPatternName } from "@/lib/patterns/vocabulary";
import {
  clearPatternsDirty,
  getPullCursor,
  hasEntryTombstone,
  isEntryDeleted,
  isImported,
  isPatternsDirty,
  markPatternsDirty,
  restoreDirtyEntries,
  restoreEntryTombstones,
  setImported,
  setPullCursor,
  takeDirtyEntries,
  takeEntryTombstones,
  withDirtyTrackingSuppressed,
  type EntryTombstone,
} from "@/lib/sync/local-flags";
import type {
  EntriesPullResponse,
  EntryPushResult,
  PatternsPullResponse,
  PatternsSnapshot,
  WireEntry,
} from "@/lib/sync/wire-types";

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
      // Local state may be ahead (device kept planning offline) — prefer the
      // copy with the later plan activity.
      const local = getState(state.name);
      if (local && local.lastPlanAt >= state.lastPlanAt) continue;
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

const pullAndApplyEntries = async (): Promise<void> => {
  let since = getPullCursor();
  // Page until the server says we're caught up — keeps each response small
  // when the account has many large board snapshots.
  for (let page = 0; page < 50; page++) {
    const response = await fetch(`/api/sync/entries?since=${since}`);
    if (!response.ok) return;
    const payload = (await response.json()) as EntriesPullResponse;
    for (const entry of payload.entries) {
      applyServerEntry(entry);
    }
    setPullCursor(payload.cursor);
    if (!payload.hasMore) return;
    since = payload.cursor;
  }
};

const pullAndApplyPatterns = async (): Promise<void> => {
  let cursor: string | null = null;
  // Page analyses until caught up — meta tables arrive on page 1 only.
  for (let page = 0; page < 50; page++) {
    const url = cursor
      ? `/api/sync/patterns?cursor=${encodeURIComponent(cursor)}`
      : "/api/sync/patterns";
    const response = await fetch(url);
    if (!response.ok) return;
    const payload = (await response.json()) as PatternsPullResponse;
    applyServerPatterns(payload);
    if (!payload.hasMore) return;
    cursor = payload.cursor ?? null;
    if (!cursor) return;
  }
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

  try {
    const response = await fetch("/api/sync/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: tombstones.map(toTombstoneWire),
      }),
    });
    if (!response.ok) throw new Error(`push failed: ${response.status}`);

    const { results } = (await response.json()) as {
      results: EntryPushResult[];
    };
    const rejected: EntryTombstone[] = [];
    for (const result of results) {
      const tombstone = tombstones.find((t) => t.id === result.id);
      if (!tombstone) continue;
      if (result.accepted) continue;

      if (result.server?.deletedAt) {
        // Server already has the delete — apply locally, drop the tombstone.
        applyServerEntry(result.server);
        continue;
      }

      // Keep retrying; never apply a live server copy over a local delete.
      rejected.push(tombstone);
    }
    restoreEntryTombstones(rejected);
  } catch {
    restoreEntryTombstones(tombstones);
  }
};

const pushDirtyEntries = async (): Promise<void> => {
  // Always flush deletes first so a dirty live push cannot race them.
  await pushEntryTombstones();

  const dirtyIds = takeDirtyEntries();
  if (dirtyIds.length === 0) return;

  const entries: WireEntry[] = [];
  for (const id of dirtyIds) {
    // Deleted ids are owned by the tombstone path — never push live content.
    if (isEntryDeleted(id) || hasEntryTombstone(id)) continue;
    const entry = readEntryById(id);
    if (entry) entries.push(toWireEntry(entry));
  }
  if (entries.length === 0) return;

  const pushedIds = entries.map((entry) => entry.id);

  try {
    const response = await fetch("/api/sync/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    if (!response.ok) throw new Error(`push failed: ${response.status}`);

    const { results } = (await response.json()) as {
      results: EntryPushResult[];
    };
    for (const result of results) {
      if (!result.accepted && result.server) {
        applyServerEntry(result.server);
      }
    }
  } catch {
    // Offline or server error — restore the queues for the next attempt.
    restoreDirtyEntries(pushedIds);
  }
};

const pushPatternsIfDirty = async (): Promise<void> => {
  if (!isPatternsDirty()) return;
  clearPatternsDirty();
  try {
    const response = await fetch("/api/sync/patterns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collectPatternsSnapshot()),
    });
    if (!response.ok) throw new Error(`push failed: ${response.status}`);
  } catch {
    markPatternsDirty();
  }
};

// ── One-time import of pre-cloud local data ─────────────────────────────────

const maybeImport = async (): Promise<void> => {
  if (isImported()) return;

  const status = await fetch("/api/import");
  if (!status.ok) return; // signed out / server issue — retry next sync
  const { hasServerData } = (await status.json()) as {
    hasServerData: boolean;
  };

  if (hasServerData) {
    // Account already has cloud data — pulls will populate this device.
    setImported();
    return;
  }

  const entries = readAllEntries();
  // One entry per request: embedded base64 images can make payloads large.
  for (const entry of entries) {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [toWireEntry(entry)] }),
    });
    if (!response.ok) return; // abort — flag stays unset, retried next sync
  }

  const response = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patterns: collectPatternsSnapshot() }),
  });
  if (!response.ok) return;

  setImported();
};

// ── Entry point ─────────────────────────────────────────────────────────────

let syncInFlight = false;

export const fullSync = async (): Promise<void> => {
  if (typeof window === "undefined" || syncInFlight) return;
  syncInFlight = true;
  try {
    await maybeImport();
    // Push deletes before pull so a live server copy cannot reappear locally.
    await pushEntryTombstones();
    await pullAndApplyEntries();
    await pullAndApplyPatterns();
    await pushDirtyEntries();
    await pushPatternsIfDirty();
  } catch (error) {
    console.error("Sync failed", error);
  } finally {
    syncInFlight = false;
  }
};

/** Push-only pass — used on the dirty-event debounce between full syncs. */
export const pushSync = async (): Promise<void> => {
  if (typeof window === "undefined" || syncInFlight) return;
  syncInFlight = true;
  try {
    await pushDirtyEntries();
    await pushPatternsIfDirty();
  } catch (error) {
    console.error("Sync push failed", error);
  } finally {
    syncInFlight = false;
  }
};
