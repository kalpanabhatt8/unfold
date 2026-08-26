import "server-only";

import {
  analyzeEntryOnServer,
  dbAnalysisToEntryAnalysis,
  entryNeedsAnalysis,
} from "@/lib/server/analyze-entry";
import { generateUserPatternArtifacts, userNeedsArtifactGeneration } from "@/lib/server/generate-user-patterns";
import {
  evaluatePatternGenerationGate,
  markPatternsGenerated,
} from "@/lib/server/pattern-generation-gate";
import { resolveEntryText } from "@/lib/server/entry-text";
import { db } from "@/lib/server/db";

const BATCH_SIZE = 5;
/** Full pass when the generation gate opens — analyze every pending sealed entry. */
const MAX_ENTRIES_PER_GENERATION = 50;

export type PipelineMode = "event" | "backfill" | "manual";

const findAllPendingEntryIds = async (
  userId: string,
  limit: number,
): Promise<string[]> => {
  const rows = await db.journalEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      sealedAt: { not: null },
      crisisFlagged: false,
      qualityFlagged: false,
    },
    include: { analysis: true },
    orderBy: [{ sealedAt: "asc" }, { id: "asc" }],
  });

  const pending: string[] = [];
  for (const row of rows) {
    const text = resolveEntryText(row);
    const analysis = row.analysis
      ? dbAnalysisToEntryAnalysis(row.analysis)
      : null;
    if (!entryNeedsAnalysis(text, analysis)) continue;
    pending.push(row.id);
    if (pending.length >= limit) break;
  }
  return pending;
};

const analyzeEntryBatch = async (
  userId: string,
  entryIds: string[],
  apiKey: string,
): Promise<number> => {
  let analyzed = 0;
  for (const entryId of entryIds) {
    const ok = await analyzeEntryOnServer(userId, entryId, apiKey);
    if (ok) analyzed += 1;
  }
  return analyzed;
};

/**
 * Full server-side pattern generation: analyze all pending sealed entries,
 * build pattern artifacts, persist to Postgres. No-op when gate not met.
 */
/** One pipeline run per user — overlapping rebuilds corrupt in-memory stores. */
const inflightByUser = new Map<string, Promise<boolean>>();

const runFullPatternGenerationInner = async (
  userId: string,
  options?: { bypassGate?: boolean },
): Promise<boolean> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[pattern-pipeline] missing ANTHROPIC_API_KEY");
    return false;
  }

  const gate = await evaluatePatternGenerationGate(userId, {
    bypassThresholds: options?.bypassGate,
  });

  if (!gate.needsGeneration) {
    console.info("[pattern-pipeline] skipped", {
      userId,
      reason: gate.skipReason,
      sealedCount: gate.sealedCount,
      totalWords: gate.totalWords,
    });
    return false;
  }

  const pending = await findAllPendingEntryIds(
    userId,
    MAX_ENTRIES_PER_GENERATION,
  );

  let analyzed = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    analyzed += await analyzeEntryBatch(
      userId,
      pending.slice(i, i + BATCH_SIZE),
      apiKey,
    );
  }

  await generateUserPatternArtifacts(userId, apiKey);

  const artifactsReady = !(await userNeedsArtifactGeneration(userId));
  if (gate.latestSealAt && artifactsReady) {
    await markPatternsGenerated(userId, gate.latestSealAt);
  }

  console.info("[pattern-pipeline] complete", {
    userId,
    analyzed,
    artifactsReady,
    sealedCount: gate.sealedCount,
    totalWords: gate.totalWords,
  });

  return artifactsReady;
};

export async function runFullPatternGeneration(
  userId: string,
  options?: { bypassGate?: boolean },
): Promise<boolean> {
  const inflight = inflightByUser.get(userId);
  if (inflight) {
    console.info("[pattern-pipeline] join inflight run", { userId });
    return inflight;
  }

  const promise = runFullPatternGenerationInner(userId, options).finally(() => {
    inflightByUser.delete(userId);
  });
  inflightByUser.set(userId, promise);
  return promise;
}

export const isPatternGenerationInflight = (userId: string): boolean =>
  inflightByUser.has(userId);

/** Users whose gate is open and patterns are stale since the latest seal. */
export const findUsersNeedingPatternGeneration = async (): Promise<
  string[]
> => {
  const rows = await db.journalEntry.findMany({
    where: { deletedAt: null, sealedAt: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  });

  const userIds: string[] = [];
  for (const { userId } of rows) {
    const gate = await evaluatePatternGenerationGate(userId);
    if (gate.needsGeneration) userIds.push(userId);
  }
  return userIds;
};

/** Cron safety net — gate-checked; zero Claude calls when nothing to do. */
export async function runBackfillPatternPipeline(): Promise<void> {
  const userIds = await findUsersNeedingPatternGeneration();
  if (userIds.length === 0) return;

  for (const userId of userIds) {
    try {
      await runFullPatternGeneration(userId);
    } catch (error) {
      console.error("[pattern-pipeline] backfill user failed", { userId, error });
    }
  }
}

/** Event-driven: runs after a sealed entry syncs to the server. */
export function scheduleSealedEntryPipeline(
  userId: string,
  _entryIds: string[],
): void {
  void runFullPatternGeneration(userId).catch((error) => {
    console.error("[pattern-pipeline] seal event failed", { userId, error });
  });
}

/** Manual rebuild — bypasses entry/word thresholds; still skips if already current. */
export function scheduleUserPatternPipeline(userId: string): void {
  void runFullPatternGeneration(userId, { bypassGate: true }).catch((error) => {
    console.error("[pattern-pipeline] manual run failed", { userId, error });
  });
}
