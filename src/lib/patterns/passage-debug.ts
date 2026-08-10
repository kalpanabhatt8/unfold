/**
 * Dev helpers - inspect the pattern passage pipeline in the browser console.
 *
 *   __unfoldPatternDebug()          - full dump: state, cache, beats, API probe
 *   __unfoldPatternDebug("avoidance") - single pattern
 *
 * Silent in production (see isDebugLoggingEnabled). Loaded only from local
 * development via dynamic import.
 */

import { buildSlotGenerationInput } from "@/lib/ai/pattern-slots/input";
import {
  debugGroup,
  debugGroupEnd,
  debugLog,
  debugWarn,
  isDebugLoggingEnabled,
} from "@/lib/debug-log";
import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import {
  passageEvidenceRatio,
  passageIsLoading,
  passageStructureValid,
} from "@/lib/patterns/passage-fill";
import { passageToBeats } from "@/lib/patterns/passage-beats";
import { reconcileAllPassages } from "@/lib/patterns/passage-orchestrator";
import { getCachedPassage } from "@/lib/patterns/passage-store";
import { passageNeedsGeneration } from "@/lib/patterns/passage-types";
import { getState } from "@/lib/patterns/pattern-state";
import {
  PATTERN_LABELS,
  PATTERN_NAMES,
  type PatternName,
} from "@/lib/patterns/vocabulary-public";

const logPassage = (name: PatternName) => {
  if (!isDebugLoggingEnabled()) return null;
  const passage = getCachedPassage(name);
  const state = getState(name);
  if (!passage && !state) return null;

  const beats = passage ? passageToBeats(passage.slots, passage.shapeId) : [];
  const ratio = passage ? passageEvidenceRatio(passage) : null;
  // Definition is resolved server-side on the slots API — never pull catalog.
  const input = passage
    ? buildSlotGenerationInput(passage, PATTERN_LABELS[passage.name], "")
    : null;

  const summary = {
    lifecycle: state?.lifecycle,
    shapeId: passage?.shapeId,
    depthTier: passage?.depthTier,
    endingKind: passage?.endingKind,
    cacheKey: passage?.cacheKey,
    needsGeneration: passage ? passageNeedsGeneration(passage) : null,
    structureValid: passage ? passageStructureValid(passage) : null,
    loading: passage ? passageIsLoading(passage) : null,
    evidenceToVoiceRatio: ratio?.toFixed(1),
    slotKinds: passage?.slots.map((s) => s.kind),
    slotDetail: passage?.slots.map((s, i) => ({ i, ...s })),
    beatTypes: beats.map((b) => b.type),
    beats,
    voiceSlots: input?.voiceSlots ?? [],
  };

  debugLog(name, summary);
  if (passage) debugLog(`  PatternPassage (${name})`, passage);
  return { passage, state, beats, input, summary };
};

export function debugPassageQuality(): void {
  if (typeof window === "undefined") return;
  if (!isDebugLoggingEnabled()) return;
  debugGroup("Pattern passage quality");
  for (const name of PATTERN_NAMES) logPassage(name);
  debugGroupEnd();
}

async function probeSlotApi(name: PatternName): Promise<void> {
  if (!isDebugLoggingEnabled()) return;
  const passage = getCachedPassage(name);
  if (!passage) {
    debugWarn("[probe] no cached passage for", name);
    return;
  }

  const input = buildSlotGenerationInput(
    passage,
    PATTERN_LABELS[name],
    "",
  );

  if (!input) {
    debugLog("[probe] no voice slots needed for", name, passage.shapeId);
    return;
  }

  debugLog("[probe] POST /api/pattern-slots", {
    patternName: input.patternName,
    quoteCount: input.quotes.length,
    voiceSlots: input.voiceSlots,
  });

  try {
    const res = await fetch("/api/pattern-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patternName: input.patternName,
        quotes: input.quotes,
        voiceSlots: input.voiceSlots,
      }),
    });
    const body = await res.json();
    debugLog("[probe] response", { status: res.status, ok: res.ok, body });
  } catch (error) {
    debugWarn("[probe] fetch failed", error);
  }
}

/** Full pipeline dump - paste output when reporting issues. */
export async function debugPatternPipeline(
  patternName?: PatternName,
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isDebugLoggingEnabled()) return;

  debugGroup("unfold pattern pipeline");

  const aggregate = aggregateAnalyses();
  debugLog("aggregate.surfaced", aggregate.surfaced.map((p) => p.name));

  const reconciled = reconcileAllPassages(
    aggregate.surfaced.map((p) => ({ name: p.name, evidence: p.evidence })),
  );

  for (const [name, result] of reconciled) {
    if (patternName && name !== patternName) continue;
    debugLog(`reconcile:${name}`, {
      shapeId: result.passage.shapeId,
      regenerated: result.regenerated,
      needsGeneration: result.needsGeneration,
      lifecycle: result.passage.lifecycle,
      slotKinds: result.passage.slots.map((s) => s.kind),
    });
    debugLog(`  reconciled passage`, result.passage);
    debugLog(`  beats`, passageToBeats(result.passage.slots, result.passage.shapeId));
  }

  debugGroup("cached passages");
  const names = patternName ? [patternName] : PATTERN_NAMES;
  for (const name of names) logPassage(name);
  debugGroupEnd();

  if (patternName) {
    await probeSlotApi(patternName);
  }

  debugGroupEnd();
}

if (typeof window !== "undefined" && isDebugLoggingEnabled()) {
  const w = window as Window & {
    __unfoldPatternDebug?: typeof debugPatternPipeline;
    __keepsPatternDebug?: typeof debugPatternPipeline;
  };
  w.__unfoldPatternDebug = debugPatternPipeline;
  // Legacy alias during rebrand.
  w.__keepsPatternDebug = debugPatternPipeline;
}
