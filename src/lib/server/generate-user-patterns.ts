import "server-only";

import { generateDisplay } from "@/lib/ai/pattern-display/generate";
import { fallbackDisplay } from "@/lib/ai/pattern-display/fallback";
import { generateSlotFills } from "@/lib/ai/pattern-slots/generate";
import { buildFallbackReflectionFills } from "@/lib/ai/pattern-slots/fallback";
import { buildSlotGenerationInput } from "@/lib/ai/pattern-slots/input";
import { aggregateFromInputs } from "@/lib/patterns/aggregate";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import type { JournalEntry } from "@/lib/journal-entries";
import { applySlotFills, isCompleteVoicePassage } from "@/lib/patterns/passage-fill";
import { reconcileAllPassages } from "@/lib/patterns/passage-orchestrator";
import {
  getCachedDisplay,
  putCachedDisplay,
} from "@/lib/patterns/pattern-display-store";
import {
  isPatternFullyReady,
  type SurfacedPatternTarget,
} from "@/lib/patterns/pattern-readiness";
import {
  getCachedPassage,
  putCachedPassage,
} from "@/lib/patterns/passage-store";
import {
  passageNeedsGeneration,
  type PatternPassage,
} from "@/lib/patterns/passage-types";
import type { PatternState } from "@/lib/patterns/pattern-state";
import {
  activatePatternStoreBacking,
  deactivatePatternStoreBacking,
  type PatternStoreBacking,
} from "@/lib/patterns/store-backing";
import type { EntryAnalysis, PatternDisplay } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary-public";
import {
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
} from "@/lib/patterns/vocabulary";
import { isPatternName } from "@/lib/patterns/vocabulary-public";
import { dbAnalysisToEntryAnalysis } from "@/lib/server/analyze-entry";
import { db } from "@/lib/server/db";
import { pushPatterns } from "@/lib/server/patterns";
import type { WireDisplay, WirePassage } from "@/lib/sync/wire-types";

const MAX_VOICE_ROUNDS = 8;

const toJournalEntry = (row: {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastEditedAt: Date | null;
  sealedAt: Date | null;
  crisisFlagged: boolean;
  qualityFlagged: boolean;
  searchText: string;
}): JournalEntry => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
  lastEditedAt: row.lastEditedAt?.getTime(),
  sealedAt: row.sealedAt?.getTime() ?? null,
  crisisFlagged: row.crisisFlagged,
  qualityFlagged: row.qualityFlagged,
  searchText: row.searchText,
});

const seedBackingFromDb = async (
  userId: string,
): Promise<PatternStoreBacking> => {
  const [stateRows, passageRows, displayRows] = await Promise.all([
    db.patternState.findMany({ where: { userId } }),
    db.patternPassage.findMany({ where: { userId } }),
    db.patternDisplay.findMany({ where: { userId } }),
  ]);

  const states: Record<string, PatternState> = {};
  for (const row of stateRows) {
    if (!isPatternName(row.patternName)) continue;
    states[row.patternName] = {
      name: row.patternName,
      lifecycle: row.lifecycle as PatternState["lifecycle"],
      lifecycleSince: row.lifecycleSince.getTime(),
      recentSignatures: row.recentSignatures,
      lastEndingKind: row.lastEndingKind as PatternState["lastEndingKind"],
      planEpoch: row.planEpoch,
      evidenceKey: row.evidenceKey,
      lastPlanAt: row.lastPlanAt.getTime(),
    };
  }

  const passages: Record<string, PatternPassage> = {};
  for (const row of passageRows) {
    const passage = row.passage as PatternPassage | null;
    if (!passage || !isPatternName(passage.name)) continue;
    passages[passage.name] = passage;
  }

  const displays: Record<string, PatternDisplay> = {};
  for (const row of displayRows) {
    if (!isPatternName(row.patternName)) continue;
    displays[`${row.patternName}|${row.evidenceKey}`] = {
      displayTitle: row.displayTitle,
      summary: row.summary,
      sourceEvidenceKey: row.evidenceKey,
      createdAt: row.createdAt.getTime(),
    };
  }

  return { states, passages, displays };
};

const generateVoiceForPassage = async (
  apiKey: string,
  passage: PatternPassage,
): Promise<PatternPassage> => {
  let current = passage;
  for (let round = 0; round < MAX_VOICE_ROUNDS; round += 1) {
    if (!passageNeedsGeneration(current)) break;
    const input = buildSlotGenerationInput(
      current,
      PATTERN_LABELS[current.name],
      PATTERN_DEFINITIONS[current.name],
    );
    if (!input) break;
    const result = await generateSlotFills(apiKey, input);
    current = applySlotFills(current, result.fills);
    putCachedPassage(current);
    if (result.rejected.length > 0) {
      console.warn("[pattern-pipeline] voice slot rejected", {
        pattern: current.name,
        round: round + 1,
        rejected: result.rejected.map((r) => ({
          index: r.index,
          reason: r.reason,
        })),
      });
    }
    if (!passageNeedsGeneration(current)) break;
  }

  if (passageNeedsGeneration(current)) {
    const input = buildSlotGenerationInput(
      current,
      PATTERN_LABELS[current.name],
      PATTERN_DEFINITIONS[current.name],
    );
    const fallbackFills = input ? buildFallbackReflectionFills(input) : [];
    if (fallbackFills.length > 0) {
      current = applySlotFills(current, fallbackFills);
      putCachedPassage(current);
      console.info("[pattern-pipeline] applied fallback reflection", {
        pattern: current.name,
      });
    }
  }

  return current;
};

const ensurePatternArtifacts = async (
  apiKey: string,
  pattern: SurfacedPatternTarget,
): Promise<void> => {
  const name = pattern.name as PatternName;
  const evidenceKey = buildEvidenceKey(pattern.evidence);
  const quotes = pattern.evidence.flatMap((item) => item.quotes);

  if (!getCachedDisplay(name, evidenceKey)) {
    const generated =
      (await generateDisplay(apiKey, {
        patternName: name,
        label: PATTERN_LABELS[name],
        definition: PATTERN_DEFINITIONS[name],
        quotes,
      })) ?? fallbackDisplay(name, evidenceKey);
    putCachedDisplay(name, evidenceKey, generated);
  }

  let passage = getCachedPassage(name);
  if (passage && passageNeedsGeneration(passage)) {
    passage = await generateVoiceForPassage(apiKey, passage);
  }

  if (passage && isCompleteVoicePassage(passage)) {
    putCachedPassage(passage);
  }
};

/**
 * Aggregate surfaced patterns from DB analyses, plan passages, generate
 * display + voice, and persist artifacts for client pull on next open.
 */
export async function generateUserPatternArtifacts(
  userId: string,
  apiKey: string,
): Promise<void> {
  const backing = await seedBackingFromDb(userId);
  activatePatternStoreBacking(backing);

  try {
    const [entryRows, analysisRows] = await Promise.all([
      db.journalEntry.findMany({
        where: { userId, deletedAt: null },
      }),
      db.entryAnalysis.findMany({ where: { userId } }),
    ]);

    const entries = entryRows.map(toJournalEntry);
    const analyses: EntryAnalysis[] = analysisRows.map(dbAnalysisToEntryAnalysis);
    const { surfaced } = aggregateFromInputs(analyses, entries, {
      applyOverlapSuppression: true,
    });

    if (surfaced.length === 0) return;

    reconcileAllPassages(
      surfaced.map((p) => ({
        name: p.name as PatternName,
        evidence: p.evidence,
      })),
    );

    for (const pattern of surfaced) {
      await ensurePatternArtifacts(apiKey, pattern);
    }

    const displays: WireDisplay[] = [];
    for (const [key, display] of Object.entries(backing.displays)) {
      const patternName = key.split("|")[0] ?? "";
      if (!isPatternName(patternName)) continue;
      displays.push({
        patternName,
        evidenceKey: display.sourceEvidenceKey,
        displayTitle: display.displayTitle,
        summary: display.summary,
        createdAt: display.createdAt,
      });
    }

    const passages: WirePassage[] = Object.values(backing.passages);
    const states = Object.values(backing.states);

    await pushPatterns(userId, { states, passages, displays });

    console.info("[pattern-pipeline] artifacts saved", {
      userId,
      surfaced: surfaced.length,
      passages: passages.length,
      displays: displays.length,
    });
  } finally {
    deactivatePatternStoreBacking();
  }
}

/**
 * True when surfaced patterns exist but display/voice artifacts are incomplete.
 * Cheap pre-check before running artifact generation (no AI calls).
 */
export async function userNeedsArtifactGeneration(
  userId: string,
): Promise<boolean> {
  const backing = await seedBackingFromDb(userId);
  activatePatternStoreBacking(backing);

  try {
    const [entryRows, analysisRows] = await Promise.all([
      db.journalEntry.findMany({ where: { userId, deletedAt: null } }),
      db.entryAnalysis.findMany({ where: { userId } }),
    ]);

    if (analysisRows.length === 0) return false;

    const entries = entryRows.map(toJournalEntry);
    const analyses: EntryAnalysis[] = analysisRows.map(dbAnalysisToEntryAnalysis);
    const { surfaced } = aggregateFromInputs(analyses, entries, {
      applyOverlapSuppression: true,
    });

    if (surfaced.length === 0) return false;

    reconcileAllPassages(
      surfaced.map((p) => ({
        name: p.name as PatternName,
        evidence: p.evidence,
      })),
    );

    return surfaced.some((pattern) => !isPatternFullyReady(pattern));
  } finally {
    deactivatePatternStoreBacking();
  }
}
