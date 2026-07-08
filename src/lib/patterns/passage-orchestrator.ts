/**
 * Unfold — passage orchestration for living patterns.
 *
 * Wires lifecycle classification, composition planning, slot materialization,
 * and passage caching. Regenerates only when evidence or lifecycle changes,
 * or when no valid cached passage exists.
 */

import { deriveGlobalActivityAt } from "@/lib/patterns/evidence-signals";
import { deriveEvidenceSignals } from "@/lib/patterns/evidence-signals";
import {
  applySlotFills,
  passageStructureValid,
  passageVoiceEchoes,
} from "@/lib/patterns/passage-fill";
import type { ParsedSlotFill } from "@/lib/ai/pattern-slots/parse";
import { materializePassage } from "@/lib/patterns/passage-materialize";
import { getCachedPassage, putCachedPassage } from "@/lib/patterns/passage-store";
import {
  buildPassageCacheKey,
  passageNeedsGeneration,
  type PatternPassage,
} from "@/lib/patterns/passage-types";
import {
  advancePatternState,
  createPlan,
  type NeighborShape,
} from "@/lib/patterns/planner";
import {
  getState,
  putState,
  type Lifecycle,
  type PatternState,
} from "@/lib/patterns/pattern-state";
import type { PatternEvidenceItem } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

const voiceFillsFrom = (passage: PatternPassage): ParsedSlotFill[] => {
  const fills: ParsedSlotFill[] = [];
  passage.slots.forEach((slot, index) => {
    if (slot.kind === "line" && slot.text) {
      fills.push({ index, text: slot.text });
    }
    if (
      slot.kind === "close" &&
      slot.endingKind !== "quote" &&
      slot.text
    ) {
      fills.push({ index, text: slot.text });
    }
  });
  return fills;
};

/** Re-materialize but keep any voice fills already in cache. */
const materializePreservingVoice = (
  name: PatternName,
  plan: Parameters<typeof materializePassage>[1],
  evidenceKey: string,
  now: number,
): PatternPassage => {
  const fresh = materializePassage(name, plan, evidenceKey, now);
  const existing = getCachedPassage(name);
  if (!existing || existing.cacheKey !== fresh.cacheKey) return fresh;
  if (passageVoiceEchoes(existing)) return fresh;
  const fills = voiceFillsFrom(existing);
  return fills.length > 0 ? applySlotFills(fresh, fills) : fresh;
};

/** Cached passages that no longer match planner policy — force one re-plan. */
const isPassageShapeStale = (
  passage: PatternPassage,
  lifecycle: Lifecycle,
  quoteCount: number,
): boolean => {
  if (
    passage.shapeId === "single" &&
    (lifecycle === "strengthening" || lifecycle === "strong") &&
    quoteCount >= 3
  ) {
    return true;
  }
  // Old recognition arcs — regenerate into the evidence-dominant shape:
  //  - moments,line,moments  (evidence → summary → more evidence → quote)
  //  - moments,line,line      (one quote → three AI cards; too AI-heavy)
  if (passage.signature.includes("moments,line,moments")) return true;
  if (passage.signature.includes("moments,line,line")) return true;
  return false;
};

export type ReconcileResult = {
  passage: PatternPassage;
  state: PatternState;
  regenerated: boolean;
  needsGeneration: boolean;
  evidenceChanged: boolean;
  lifecycleChanged: boolean;
};

export type ReconcileContext = {
  name: PatternName;
  evidence: PatternEvidenceItem[];
  globalActivityAt: number;
  neighbors: NeighborShape[];
  now: number;
  /** In-memory state from a batch reconcile — avoids mid-batch localStorage drift. */
  prevState?: PatternState | null;
  /** When false, caller persists state after the batch completes. */
  persist?: boolean;
};

/**
 * Reconcile one pattern: advance state, optionally re-plan, materialize or
 * restore cached passage, persist.
 */
export function reconcilePatternPassage(
  ctx: ReconcileContext,
): ReconcileResult {
  const prevState =
    ctx.prevState !== undefined ? ctx.prevState : getState(ctx.name);
  const persist = ctx.persist !== false;
  const advanced = advancePatternState({
    name: ctx.name,
    evidence: ctx.evidence,
    globalActivityAt: ctx.globalActivityAt,
    prevState,
    neighbors: ctx.neighbors,
    now: ctx.now,
  });

  const cached = getCachedPassage(ctx.name);
  const cacheKeyMatches =
    cached !== null &&
    cached.cacheKey ===
      buildPassageCacheKey(
        advanced.evidenceKey,
        advanced.lifecycle,
        cached.signature,
      );

  const quoteCount = deriveEvidenceSignals(
    ctx.evidence,
    advanced.lifecycle,
    ctx.now,
  ).selectedQuotes.length;

  const cacheUsable =
    cached !== null &&
    cacheKeyMatches &&
    passageStructureValid(cached) &&
    !passageVoiceEchoes(cached) &&
    !isPassageShapeStale(cached, advanced.lifecycle, quoteCount);

  const shouldReplan =
    !cacheUsable ||
    advanced.evidenceChanged ||
    advanced.lifecycleChanged;

  if (!shouldReplan && cached) {
    if (persist) putState(advanced.state);
    return {
      passage: cached,
      state: advanced.state,
      regenerated: false,
      needsGeneration: passageNeedsGeneration(cached),
      evidenceChanged: false,
      lifecycleChanged: advanced.lifecycleChanged,
    };
  }

  const { plan, state: plannedState } = createPlan(
    {
      name: ctx.name,
      evidence: ctx.evidence,
      globalActivityAt: ctx.globalActivityAt,
      prevState,
      neighbors: ctx.neighbors,
      now: ctx.now,
    },
    advanced,
  );

  const recordPlan =
    advanced.evidenceChanged ||
    advanced.lifecycleChanged ||
    (cached !== null &&
      isPassageShapeStale(cached, advanced.lifecycle, quoteCount));

  const state = recordPlan ? plannedState : advanced.state;

  const passage = materializePreservingVoice(
    ctx.name,
    plan,
    advanced.evidenceKey,
    ctx.now,
  );

  putCachedPassage(passage);
  if (persist) putState(state);

  return {
    passage,
    state,
    regenerated: true,
    needsGeneration: passageNeedsGeneration(passage),
    evidenceChanged: advanced.evidenceChanged,
    lifecycleChanged: advanced.lifecycleChanged,
  };
}

/** Reconcile all surfaced patterns in one cycle. */
export function reconcileAllPassages(
  patterns: Array<{ name: PatternName; evidence: PatternEvidenceItem[] }>,
  now: number = Date.now(),
): Map<PatternName, ReconcileResult> {
  const globalActivityAt = deriveGlobalActivityAt(
    patterns.map((p) => p.evidence),
  );

  const results = new Map<PatternName, ReconcileResult>();
  const neighbors: NeighborShape[] = [];
  const stateByName = new Map<PatternName, PatternState | null>(
    patterns.map(({ name }) => [name, getState(name)]),
  );

  for (const { name, evidence } of patterns) {
    const result = reconcilePatternPassage({
      name,
      evidence,
      globalActivityAt,
      neighbors,
      now,
      prevState: stateByName.get(name) ?? null,
      persist: false,
    });
    results.set(name, result);
    stateByName.set(name, result.state);
    neighbors.push({
      depthTier: result.passage.depthTier,
      endingKind: result.passage.endingKind,
      shapeId: result.passage.shapeId,
    });
  }

  for (const { name } of patterns) {
    const state = stateByName.get(name);
    if (state) putState(state);
  }

  return results;
}
