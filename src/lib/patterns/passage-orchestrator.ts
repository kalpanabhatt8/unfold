/**
 * Unfold — passage orchestration for living patterns.
 *
 * Wires lifecycle classification, composition planning, slot materialization,
 * and passage caching. Regenerates only when evidence or lifecycle changes,
 * or when no valid cached passage exists.
 */

import { isVoiceArcShape } from "@/lib/patterns/discovery-arc";
import { deriveGlobalActivityAt } from "@/lib/patterns/evidence-signals";
import { deriveEvidenceSignals } from "@/lib/patterns/evidence-signals";
import { isVoiceGenerationActive } from "@/lib/patterns/pattern-lifecycle";
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
  createDiscoveryPlan,
  createPlan,
  pickPlannedShape,
  type NeighborShape,
  type PlanContext,
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
  if (!existing) return fresh;

  const fills = voiceFillsFrom(existing);
  if (fills.length === 0) return fresh;

  // Re-plans may change cacheKey while slot indices stay aligned — keep voice
  // text instead of wiping it and forcing another multi-second generation pass.
  const applied = applySlotFills(fresh, fills);
  if (passageVoiceEchoes(applied)) return fresh;
  return applied;
};

/** Cached passages that no longer match planner policy — force one re-plan. */
const EVIDENCE_ONLY_SHAPES = new Set([
  "bare",
  "bare_close",
  "echo",
  "pair",
]);

const isDiscoveryEligible = (
  lifecycle: Lifecycle,
  quoteCount: number,
): boolean =>
  quoteCount >= 3 &&
  lifecycle !== "resting" &&
  lifecycle !== "emerging";

const countPassageQuotes = (passage: PatternPassage): number => {
  let n = 0;
  for (const slot of passage.slots) {
    if (slot.kind === "moments" || slot.kind === "pair") n += slot.quotes.length;
    if (slot.kind === "echo") n += slot.quotes.length;
  }
  return n;
};

/** Quote count for upgrade/stale checks — bound passage quotes count too. */
const effectiveQuoteCount = (
  signalQuoteCount: number,
  passage: PatternPassage | null,
): number =>
  passage
    ? Math.max(signalQuoteCount, countPassageQuotes(passage))
    : signalQuoteCount;

/**
 * Retired arc layouts (exact slot lists, the part of the signature before
 * the first "|"). NEVER match these as substrings: the current discovery
 * signature ("moments,line,line,close:question|…") CONTAINS
 * "moments,line,line", so a substring check flags every healthy discovery
 * passage as stale — forcing a replan on every open, poisoning the
 * planner's signature memory, and oscillating the shape (and beat count)
 * between opens.
 */
const LEGACY_SLOT_LAYOUTS = new Set([
  "moments,line,moments",
  "moments,line,line",
]);

const slotLayoutOf = (signature: string): string =>
  signature.split("|")[0] ?? "";

const passageEvidenceKey = (cacheKey: string): string =>
  cacheKey.split("|")[1] ?? "";

const isReusableVoiceArc = (passage: PatternPassage): boolean =>
  isVoiceArcShape(passage.shapeId) &&
  !passageNeedsGeneration(passage) &&
  passageStructureValid(passage) &&
  !passageVoiceEchoes(passage);

/** Discovery for the same evidence — complete or still generating. */
const isContinuableDiscovery = (
  passage: PatternPassage,
  evidenceKey: string,
): boolean =>
  passage.shapeId === "discovery" &&
  passageEvidenceKey(passage.cacheKey) === evidenceKey &&
  passageStructureValid(passage) &&
  !passageVoiceEchoes(passage);

const wouldDowngradeDiscovery = (
  cached: PatternPassage,
  planShapeId: string,
  evidenceKey: string,
): boolean =>
  isContinuableDiscovery(cached, evidenceKey) &&
  EVIDENCE_ONLY_SHAPES.has(planShapeId);

const isPassageShapeStale = (
  passage: PatternPassage,
  lifecycle: Lifecycle,
  quoteCount: number,
): boolean => {
  const eligibleQuotes = effectiveQuoteCount(quoteCount, passage);
  if (
    isDiscoveryEligible(lifecycle, eligibleQuotes) &&
    EVIDENCE_ONLY_SHAPES.has(passage.shapeId)
  ) {
    return true;
  }
  if (
    passage.shapeId === "single" &&
    isDiscoveryEligible(lifecycle, eligibleQuotes)
  ) {
    return true;
  }
  if (LEGACY_SLOT_LAYOUTS.has(slotLayoutOf(passage.signature))) return true;
  if (
    isDiscoveryEligible(lifecycle, eligibleQuotes) &&
    passage.shapeId !== "discovery" &&
    (passage.shapeId === "recognition" ||
      passage.shapeId === "recognition_q" ||
      passage.shapeId === "recognition_deep" ||
      passage.shapeId === "single")
  ) {
    return true;
  }
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
  const planCtx: PlanContext = {
    name: ctx.name,
    evidence: ctx.evidence,
    globalActivityAt: ctx.globalActivityAt,
    prevState,
    neighbors: ctx.neighbors,
    now: ctx.now,
  };
  const advanced = advancePatternState(planCtx);
  const cached = getCachedPassage(ctx.name);

  const quoteCount = deriveEvidenceSignals(
    ctx.evidence,
    advanced.lifecycle,
    ctx.now,
  ).selectedQuotes.length;

  const discoveryQuotes = effectiveQuoteCount(quoteCount, cached);

  const identityUnchanged =
    !advanced.evidenceChanged && !advanced.lifecycleChanged;

  const returnCached = (
    passage: PatternPassage,
    needsGeneration: boolean,
  ): ReconcileResult => {
    if (persist) putState(advanced.state);
    return {
      passage,
      state: advanced.state,
      regenerated: false,
      needsGeneration,
      evidenceChanged: false,
      lifecycleChanged: false,
    };
  };

  // Voice generation in flight — never replan; keep reading from cache.
  if (cached !== null && identityUnchanged && isVoiceGenerationActive(ctx.name)) {
    return returnCached(cached, passageNeedsGeneration(cached));
  }

  // Same evidence: reuse complete voice-arc passage (planner lottery ignored).
  if (
    cached !== null &&
    identityUnchanged &&
    passageEvidenceKey(cached.cacheKey) === advanced.evidenceKey &&
    isReusableVoiceArc(cached)
  ) {
    return returnCached(cached, false);
  }

  // Same evidence: keep discovery in progress or complete — never downgrade.
  if (
    cached !== null &&
    identityUnchanged &&
    isContinuableDiscovery(cached, advanced.evidenceKey)
  ) {
    return returnCached(cached, passageNeedsGeneration(cached));
  }

  const cachedMatchesEvidence =
    cached !== null &&
    passageEvidenceKey(cached.cacheKey) === advanced.evidenceKey;

  // Deterministic upgrade: stale evidence-only → discovery (skip planner lottery).
  if (
    cachedMatchesEvidence &&
    isDiscoveryEligible(advanced.lifecycle, discoveryQuotes) &&
    EVIDENCE_ONLY_SHAPES.has(cached.shapeId) &&
    isPassageShapeStale(cached, advanced.lifecycle, quoteCount) &&
    !isVoiceGenerationActive(ctx.name)
  ) {
    const upgraded = createDiscoveryPlan(planCtx, advanced);
    if (upgraded) {
      const passage = materializePreservingVoice(
        ctx.name,
        upgraded.plan,
        advanced.evidenceKey,
        ctx.now,
      );
      putCachedPassage(passage);
      if (persist) putState(upgraded.state);
      return {
        passage,
        state: upgraded.state,
        regenerated: true,
        needsGeneration: passageNeedsGeneration(passage),
        evidenceChanged: advanced.evidenceChanged,
        lifecycleChanged: advanced.lifecycleChanged,
      };
    }
  }

  const planned = pickPlannedShape(planCtx, advanced);

  // Match against the planner's current composition — not the cached passage's
  // own signature. Self-referential matching let stale evidence-only passages
  // reuse their cache key while the planner had moved on to discovery, producing
  // a 2-beat arc (Done at evidence) on first open and the full arc on reopen.
  const expectedCacheKey = buildPassageCacheKey(
    advanced.evidenceKey,
    advanced.lifecycle,
    planned.signature,
  );
  const cacheKeyMatches =
    cached !== null && cached.cacheKey === expectedCacheKey;

  const cacheUsable =
    cached !== null &&
    cacheKeyMatches &&
    cached.shapeId === planned.shapeId &&
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

  const staleOnlyReplan =
    cached !== null &&
    identityUnchanged &&
    isPassageShapeStale(cached, advanced.lifecycle, quoteCount);

  let { plan, state: plannedState } = createPlan(
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

  // Stale echo/bare must upgrade to discovery when eligible — not re-lottery
  // into echo again because discovery is in recentSignatures.
  const cachedIsStaleEvidenceOnly =
    cached !== null &&
    isDiscoveryEligible(advanced.lifecycle, discoveryQuotes) &&
    EVIDENCE_ONLY_SHAPES.has(cached.shapeId) &&
    isPassageShapeStale(cached, advanced.lifecycle, quoteCount);

  if (cachedIsStaleEvidenceOnly && EVIDENCE_ONLY_SHAPES.has(plan.shapeId)) {
    const upgraded = createDiscoveryPlan(planCtx, advanced);
    if (upgraded) {
      plan = upgraded.plan;
      plannedState = upgraded.state;
    }
  }

  // Last guard: never materialize evidence-only over an existing discovery.
  if (
    cached !== null &&
    identityUnchanged &&
    wouldDowngradeDiscovery(cached, plan.shapeId, advanced.evidenceKey)
  ) {
    return returnCached(cached, passageNeedsGeneration(cached));
  }

  const recordPlan =
    advanced.evidenceChanged ||
    advanced.lifecycleChanged ||
    staleOnlyReplan;

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
