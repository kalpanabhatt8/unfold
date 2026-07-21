/**
 * Wire shapes shared by the sync client and the server routes.
 *
 * Timestamps are unix ms numbers (the client's native representation); the
 * server data-access layer converts to/from Postgres timestamps at the edge.
 */

import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import type { EntryAnalysis } from "@/lib/patterns/types";
import type { PatternPassage } from "@/lib/patterns/passage-types";
import type { PatternState } from "@/lib/patterns/pattern-state";

export type WireEntry = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastEditedAt?: number | null;
  sealedAt?: number | null;
  deletedAt?: number | null;
  searchText: string;
  contentHash: string;
  /** Full CanvasSnapshot; null for tombstones. */
  content: CanvasSnapshot | null;
};

export type WireAnalysis = EntryAnalysis & {
  sourceContentHash?: string | null;
};

export type WirePatternState = PatternState;

export type WirePassage = PatternPassage;

export type WireDisplay = {
  patternName: string;
  evidenceKey: string;
  displayTitle: string;
  summary: string | null;
  createdAt: number;
};

export type WirePatternVote = {
  patternName: string;
  entryIds: string[];
  vote: "up" | "down";
  updatedAt: number;
};

/** GET /api/sync/entries response. */
export type EntriesPullResponse = {
  entries: WireEntry[];
  /** Server clock cursor to pass as `since` on the next pull. */
  cursor: number;
  /**
   * When true, more rows exist after `cursor` — call again with since=cursor.
   * Older clients that ignore this still advance the cursor and catch up on
   * the next fullSync interval.
   */
  hasMore?: boolean;
};

/** POST /api/sync/entries — per-entry LWW result. */
export type EntryPushResult = {
  id: string;
  accepted: boolean;
  /** Populated when the server copy won LWW — client should apply it. */
  server?: WireEntry;
};

export type PatternsSnapshot = {
  analyses: WireAnalysis[];
  states: WirePatternState[];
  passages: WirePassage[];
  displays: WireDisplay[];
  /** Optional for older clients / servers — treat missing as []. */
  votes?: WirePatternVote[];
};

/** GET /api/sync/patterns response — analyses are paged; meta tables on page 1. */
export type PatternsPullResponse = PatternsSnapshot & {
  /** Last analysis entryId on this page — pass as `cursor` on the next pull. */
  cursor?: string | null;
  /**
   * When true, more analyses exist after `cursor`. Older clients that ignore
   * this still apply the first page (states/passages/displays/votes included).
   */
  hasMore?: boolean;
};

export type ImportPayload = {
  entries?: WireEntry[];
  patterns?: Partial<PatternsSnapshot>;
};
