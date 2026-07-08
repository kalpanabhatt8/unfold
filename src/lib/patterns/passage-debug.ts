/**
 * Dev helpers — inspect the pattern passage pipeline in the browser console.
 *
 *   __keepsPatternDebug()          — full dump: state, cache, beats, API probe
 *   __keepsPatternDebug("avoidance") — single pattern
 */

import { buildSlotGenerationInput } from "@/lib/ai/pattern-slots/input";
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
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
  PATTERN_NAMES,
  type PatternName,
} from "@/lib/patterns/vocabulary";

const logPassage = (name: PatternName) => {
  const passage = getCachedPassage(name);
  const state = getState(name);
  if (!passage && !state) return null;

  const beats = passage ? passageToBeats(passage.slots, passage.shapeId) : [];
  const ratio = passage ? passageEvidenceRatio(passage) : null;
  const input = passage
    ? buildSlotGenerationInput(
        passage,
        PATTERN_LABELS[passage.name],
        PATTERN_DEFINITIONS[passage.name],
      )
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

  console.log(name, summary);
  if (passage) console.log(`  PatternPassage (${name})`, passage);
  return { passage, state, beats, input, summary };
};

export function debugPassageQuality(): void {
  if (typeof window === "undefined") return;
  console.group("Pattern passage quality");
  for (const name of PATTERN_NAMES) logPassage(name);
  console.groupEnd();
}

async function probeSlotApi(name: PatternName): Promise<void> {
  const passage = getCachedPassage(name);
  if (!passage) {
    console.warn("[probe] no cached passage for", name);
    return;
  }

  const input = buildSlotGenerationInput(
    passage,
    PATTERN_LABELS[name],
    PATTERN_DEFINITIONS[name],
  );

  if (!input) {
    console.log("[probe] no voice slots needed for", name, passage.shapeId);
    return;
  }

  console.log("[probe] POST /api/pattern-slots", {
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
    console.log("[probe] response", { status: res.status, ok: res.ok, body });
  } catch (error) {
    console.error("[probe] fetch failed", error);
  }
}

/** Full pipeline dump — paste output when reporting issues. */
export async function debugPatternPipeline(
  patternName?: PatternName,
): Promise<void> {
  if (typeof window === "undefined") return;

  console.group("keeps pattern pipeline");

  const aggregate = aggregateAnalyses();
  console.log("aggregate.surfaced", aggregate.surfaced.map((p) => p.name));

  const reconciled = reconcileAllPassages(
    aggregate.surfaced.map((p) => ({ name: p.name, evidence: p.evidence })),
  );

  for (const [name, result] of reconciled) {
    if (patternName && name !== patternName) continue;
    console.log(`reconcile:${name}`, {
      shapeId: result.passage.shapeId,
      regenerated: result.regenerated,
      needsGeneration: result.needsGeneration,
      lifecycle: result.passage.lifecycle,
      slotKinds: result.passage.slots.map((s) => s.kind),
    });
    console.log(`  reconciled passage`, result.passage);
    console.log(`  beats`, passageToBeats(result.passage.slots, result.passage.shapeId));
  }

  console.group("cached passages");
  const names = patternName ? [patternName] : PATTERN_NAMES;
  for (const name of names) logPassage(name);
  console.groupEnd();

  if (patternName) {
    await probeSlotApi(patternName);
  }

  console.groupEnd();
}

if (typeof window !== "undefined") {
  const w = window as Window & {
    __keepsPatternDebug?: typeof debugPatternPipeline;
  };
  w.__keepsPatternDebug = debugPatternPipeline;
}
