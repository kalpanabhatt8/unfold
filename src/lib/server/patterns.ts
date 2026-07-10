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
  PatternsSnapshot,
  WireAnalysis,
  WireDisplay,
  WirePassage,
  WirePatternState,
} from "@/lib/sync/wire-types";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

// ── Pull ────────────────────────────────────────────────────────────────────

export const pullPatterns = async (
  userId: string,
): Promise<PatternsSnapshot> => {
  const [analyses, states, passages, displays] = await Promise.all([
    db.entryAnalysis.findMany({ where: { userId } }),
    db.patternState.findMany({ where: { userId } }),
    db.patternPassage.findMany({ where: { userId } }),
    db.patternDisplay.findMany({ where: { userId } }),
  ]);

  return {
    analyses: analyses.map((row) => ({
      entryId: row.entryId,
      topics: row.topics,
      patterns: row.patterns as WireAnalysis["patterns"],
      sourceContentHash: row.sourceContentHash ?? undefined,
    })),
    states: states.map((row) => ({
      name: row.patternName as WirePatternState["name"],
      lifecycle: row.lifecycle as WirePatternState["lifecycle"],
      lifecycleSince: row.lifecycleSince.getTime(),
      recentSignatures: row.recentSignatures,
      lastEndingKind: row.lastEndingKind as WirePatternState["lastEndingKind"],
      planEpoch: row.planEpoch,
      evidenceKey: row.evidenceKey,
      lastPlanAt: row.lastPlanAt.getTime(),
    })),
    passages: passages.map((row) => row.passage as unknown as WirePassage),
    displays: displays.map((row) => ({
      patternName: row.patternName,
      evidenceKey: row.evidenceKey,
      displayTitle: row.displayTitle,
      summary: row.summary,
      createdAt: row.createdAt.getTime(),
    })),
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

export const pushPatterns = async (
  userId: string,
  snapshot: Partial<PatternsSnapshot>,
): Promise<{ analyses: number; states: number; passages: number; displays: number }> => ({
  analyses: await pushAnalyses(userId, snapshot.analyses ?? []),
  states: await pushStates(userId, snapshot.states ?? []),
  passages: await pushPassages(userId, snapshot.passages ?? []),
  displays: await pushDisplays(userId, snapshot.displays ?? []),
});
