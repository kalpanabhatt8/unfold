/**
 * Pattern artifacts repository — analyses (durable), pattern states
 * (deterministic memory), passages + displays (AI caches).
 *
 * These are client-authoritative upserts today: the browser still runs the
 * deterministic pipeline and calls the AI routes, then pushes results here so
 * they survive devices. Moving generation server-side later only changes who
 * calls these functions.
 */

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/server/db";
import { PROMPT_VERSIONS } from "@/lib/ai/versions";
import { EXTRACTION_MODEL } from "@/lib/ai/pattern-extraction/constants";
import { SLOT_MODEL } from "@/lib/ai/pattern-slots/constants";
import { DISPLAY_MODEL } from "@/lib/ai/pattern-display/constants";
import { isPatternName } from "@/lib/patterns/vocabulary";
import type {
  PatternsPullResponse,
  PatternsSnapshot,
  WireAnalysis,
  WireDisplay,
  WirePassage,
  WirePatternState,
  WirePatternVote,
} from "@/lib/sync/wire-types";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/**
 * Analyses are small JSON (~0.5KB/row here) vs entry boards, so the page can
 * be larger than entries' 40. Aim: one round-trip for typical accounts; page
 * only when the analysis set grows large.
 */
const PULL_ANALYSES_PAGE_SIZE = 200;

type RawAnalysisRow = {
  entryId: string;
  topics: string[];
  patterns: WireAnalysis["patterns"];
  sourceContentHash: string | null;
};

type RawStateRow = {
  name: string;
  lifecycle: string;
  lifecycleSince: number;
  recentSignatures: string[];
  lastEndingKind: string;
  planEpoch: number;
  evidenceKey: string;
  lastPlanAt: number;
};

type RawDisplayRow = {
  patternName: string;
  evidenceKey: string;
  displayTitle: string;
  summary: string | null;
  createdAt: number;
};

type RawVoteRow = {
  patternName: string;
  entryIds: string[];
  vote: string;
  updatedAt: number;
};

type RawPullRow = {
  analyses: RawAnalysisRow[] | null;
  states: RawStateRow[] | null;
  passages: WirePassage[] | null;
  displays: RawDisplayRow[] | null;
  votes: RawVoteRow[] | null;
};

const toAnalyses = (rows: RawAnalysisRow[] | null): WireAnalysis[] =>
  (rows ?? []).map((row) => ({
    entryId: row.entryId,
    topics: Array.isArray(row.topics) ? row.topics : [],
    patterns: row.patterns,
    sourceContentHash: row.sourceContentHash ?? undefined,
  }));

const toStates = (rows: RawStateRow[] | null): WirePatternState[] =>
  (rows ?? []).map((row) => ({
    name: row.name as WirePatternState["name"],
    lifecycle: row.lifecycle as WirePatternState["lifecycle"],
    lifecycleSince: Number(row.lifecycleSince),
    recentSignatures: Array.isArray(row.recentSignatures)
      ? row.recentSignatures
      : [],
    lastEndingKind: row.lastEndingKind as WirePatternState["lastEndingKind"],
    planEpoch: row.planEpoch,
    evidenceKey: row.evidenceKey,
    lastPlanAt: Number(row.lastPlanAt),
  }));

const toDisplays = (rows: RawDisplayRow[] | null): WireDisplay[] =>
  (rows ?? []).map((row) => ({
    patternName: row.patternName,
    evidenceKey: row.evidenceKey,
    displayTitle: row.displayTitle,
    summary: row.summary,
    createdAt: Number(row.createdAt),
  }));

const toVotes = (rows: RawVoteRow[] | null): WirePatternVote[] =>
  (rows ?? []).map((row) => ({
    patternName: row.patternName,
    entryIds: Array.isArray(row.entryIds) ? row.entryIds : [],
    vote: row.vote === "down" ? "down" : "up",
    updatedAt: Number(row.updatedAt),
  }));

const pageAnalyses = (
  analysisRows: RawAnalysisRow[],
): Pick<PatternsPullResponse, "analyses" | "cursor" | "hasMore"> => {
  const hasMore = analysisRows.length > PULL_ANALYSES_PAGE_SIZE;
  const page = hasMore
    ? analysisRows.slice(0, PULL_ANALYSES_PAGE_SIZE)
    : analysisRows;
  const last = page[page.length - 1];
  return {
    analyses: toAnalyses(page),
    cursor: last?.entryId ?? null,
    hasMore,
  };
};

// ── Pull ────────────────────────────────────────────────────────────────────

/**
 * Pull pattern layer in one Neon round-trip.
 *
 * Five parallel Prisma `findMany`s contended on the pooler (~3s). One SQL with
 * json_agg subselects stays near a single RTT. Analyses are cursor-paged;
 * states/passages/displays/votes ship only on the first page (they're tiny).
 */
export const pullPatterns = async (
  userId: string,
  cursor?: string | null,
): Promise<PatternsPullResponse> => {
  const take = PULL_ANALYSES_PAGE_SIZE + 1;

  // Continuation pages: analyses only (meta tables already applied on page 1).
  if (cursor) {
    const rows = await db.$queryRaw<Array<{ analyses: RawAnalysisRow[] | null }>>`
      SELECT coalesce(json_agg(row_to_json(a)), '[]'::json) AS analyses
      FROM (
        SELECT entry_id AS "entryId",
               topics,
               patterns,
               source_content_hash AS "sourceContentHash"
        FROM entry_analyses
        WHERE user_id = ${userId} AND entry_id > ${cursor}
        ORDER BY entry_id ASC
        LIMIT ${take}
      ) a
    `;
    return {
      ...pageAnalyses(rows[0]?.analyses ?? []),
      states: [],
      passages: [],
      displays: [],
      votes: [],
    };
  }

  const rows = await db.$queryRaw<RawPullRow[]>`
    SELECT
      (
        SELECT coalesce(json_agg(row_to_json(a)), '[]'::json) FROM (
          SELECT entry_id AS "entryId",
                 topics,
                 patterns,
                 source_content_hash AS "sourceContentHash"
          FROM entry_analyses
          WHERE user_id = ${userId}
          ORDER BY entry_id ASC
          LIMIT ${take}
        ) a
      ) AS analyses,
      (
        SELECT coalesce(json_agg(row_to_json(s)), '[]'::json) FROM (
          SELECT pattern_name AS name,
                 lifecycle,
                 (extract(epoch FROM lifecycle_since) * 1000) AS "lifecycleSince",
                 recent_signatures AS "recentSignatures",
                 last_ending_kind AS "lastEndingKind",
                 plan_epoch AS "planEpoch",
                 evidence_key AS "evidenceKey",
                 (extract(epoch FROM last_plan_at) * 1000) AS "lastPlanAt"
          FROM pattern_states
          WHERE user_id = ${userId}
        ) s
      ) AS states,
      (
        SELECT coalesce(json_agg(passage), '[]'::json)
        FROM pattern_passages
        WHERE user_id = ${userId}
      ) AS passages,
      (
        SELECT coalesce(json_agg(row_to_json(d)), '[]'::json) FROM (
          SELECT pattern_name AS "patternName",
                 evidence_key AS "evidenceKey",
                 display_title AS "displayTitle",
                 summary,
                 (extract(epoch FROM created_at) * 1000) AS "createdAt"
          FROM pattern_displays
          WHERE user_id = ${userId}
        ) d
      ) AS displays,
      (
        SELECT coalesce(json_agg(row_to_json(v)), '[]'::json) FROM (
          SELECT pattern_name AS "patternName",
                 entry_ids AS "entryIds",
                 vote,
                 (extract(epoch FROM updated_at) * 1000) AS "updatedAt"
          FROM pattern_votes
          WHERE user_id = ${userId}
        ) v
      ) AS votes
  `;

  const row = rows[0];
  return {
    ...pageAnalyses(row?.analyses ?? []),
    states: toStates(row?.states ?? null),
    passages: (row?.passages ?? []) as WirePassage[],
    displays: toDisplays(row?.displays ?? null),
    votes: toVotes(row?.votes ?? null),
  };
};

// ── Push ────────────────────────────────────────────────────────────────────

export const pushAnalyses = async (
  userId: string,
  analyses: WireAnalysis[],
): Promise<number> => {
  let written = 0;
  for (const analysis of analyses) {
    if (typeof analysis?.entryId !== "string" || !analysis.entryId) continue;
    if (!Array.isArray(analysis.topics) || !Array.isArray(analysis.patterns)) {
      continue;
    }
    // Analyses belong to an entry — skip if the entry hasn't synced yet
    // (or belongs to someone else); the next patterns push will catch it.
    const entry = await db.journalEntry.findUnique({
      where: { id: analysis.entryId },
      select: { userId: true },
    });
    if (!entry || entry.userId !== userId) continue;

    const data = {
      topics: analysis.topics.filter((t) => typeof t === "string"),
      patterns: analysis.patterns as unknown as Prisma.InputJsonValue,
      sourceContentHash: analysis.sourceContentHash ?? null,
      modelId: EXTRACTION_MODEL,
      promptVersion: PROMPT_VERSIONS.extraction,
    };
    await db.entryAnalysis.upsert({
      where: { entryId: analysis.entryId },
      create: { entryId: analysis.entryId, userId, ...data },
      update: data,
    });
    written += 1;
  }
  return written;
};

export const pushStates = async (
  userId: string,
  states: WirePatternState[],
): Promise<number> => {
  let written = 0;
  for (const state of states) {
    if (!isRecord(state) || !isPatternName(state.name)) continue;
    const data = {
      lifecycle: state.lifecycle,
      lifecycleSince: new Date(state.lifecycleSince),
      recentSignatures: state.recentSignatures,
      lastEndingKind: state.lastEndingKind,
      planEpoch: state.planEpoch,
      evidenceKey: state.evidenceKey,
      lastPlanAt: new Date(state.lastPlanAt),
    };
    await db.patternState.upsert({
      where: {
        userId_patternName: { userId, patternName: state.name },
      },
      create: { userId, patternName: state.name, ...data },
      update: data,
    });
    written += 1;
  }
  return written;
};

export const pushPassages = async (
  userId: string,
  passages: WirePassage[],
): Promise<number> => {
  let written = 0;
  for (const passage of passages) {
    if (!isRecord(passage) || !isPatternName(passage.name)) continue;
    if (typeof passage.cacheKey !== "string") continue;
    const data = {
      cacheKey: passage.cacheKey,
      passage: passage as unknown as Prisma.InputJsonValue,
      modelId: SLOT_MODEL,
      promptVersion: PROMPT_VERSIONS.slots,
    };
    await db.patternPassage.upsert({
      where: {
        userId_patternName: { userId, patternName: passage.name },
      },
      create: { userId, patternName: passage.name, ...data },
      update: data,
    });
    written += 1;
  }
  return written;
};

export const pushDisplays = async (
  userId: string,
  displays: WireDisplay[],
): Promise<number> => {
  let written = 0;
  for (const display of displays) {
    if (!isRecord(display) || !isPatternName(display.patternName)) continue;
    if (typeof display.displayTitle !== "string" || !display.displayTitle) {
      continue;
    }
    // One live display per pattern: prune rows for stale evidence keys.
    await db.patternDisplay.deleteMany({
      where: {
        userId,
        patternName: display.patternName,
        evidenceKey: { not: display.evidenceKey },
      },
    });
    const data = {
      displayTitle: display.displayTitle,
      summary: display.summary ?? null,
      createdAt: new Date(display.createdAt),
      modelId: DISPLAY_MODEL,
      promptVersion: PROMPT_VERSIONS.display,
    };
    await db.patternDisplay.upsert({
      where: {
        userId_patternName_evidenceKey: {
          userId,
          patternName: display.patternName,
          evidenceKey: display.evidenceKey,
        },
      },
      create: {
        userId,
        patternName: display.patternName,
        evidenceKey: display.evidenceKey,
        ...data,
      },
      update: data,
    });
    written += 1;
  }
  return written;
};

export const pushVotes = async (
  userId: string,
  votes: WirePatternVote[],
): Promise<number> => {
  let written = 0;
  for (const vote of votes) {
    if (!isRecord(vote) || !isPatternName(vote.patternName)) continue;
    if (vote.vote !== "up" && vote.vote !== "down") continue;
    if (typeof vote.updatedAt !== "number" || !Number.isFinite(vote.updatedAt)) {
      continue;
    }
    const entryIds = Array.isArray(vote.entryIds)
      ? vote.entryIds.filter((id): id is string => typeof id === "string")
      : [];
    const data = {
      entryIds,
      vote: vote.vote,
      updatedAt: new Date(vote.updatedAt),
    };
    await db.patternVote.upsert({
      where: {
        userId_patternName: { userId, patternName: vote.patternName },
      },
      create: { userId, patternName: vote.patternName, ...data },
      update: data,
    });
    written += 1;
  }
  return written;
};

export const pushPatterns = async (
  userId: string,
  snapshot: Partial<PatternsSnapshot>,
): Promise<{
  analyses: number;
  states: number;
  passages: number;
  displays: number;
  votes: number;
}> => ({
  analyses: await pushAnalyses(userId, snapshot.analyses ?? []),
  states: await pushStates(userId, snapshot.states ?? []),
  passages: await pushPassages(userId, snapshot.passages ?? []),
  displays: await pushDisplays(userId, snapshot.displays ?? []),
  votes: await pushVotes(userId, snapshot.votes ?? []),
});
