/**
 * Unfold — composition planner for living patterns.
 *
 * The application owns structure, pacing, and ending type. Given evidence +
 * lifecycle + shape memory, pick a composition from a fixed catalog, bind
 * quotes to evidence slots, and return a concrete plan for slot generation.
 *
 * Passage regeneration is gated upstream: re-plan only when evidence or
 * lifecycle changes, or when no cached passage exists.
 */

import {
  buildEvidenceKey,
  deriveEvidenceSignals,
  type EvidenceSignals,
  type QuoteRef,
} from "@/lib/patterns/evidence-signals";
import {
  classifyLifecycle,
  type LifecycleSignals,
} from "@/lib/patterns/lifecycle";
import {
  emptyState,
  withEvidence,
  withLifecycle,
  withPlan,
  type EndingKind,
  type Lifecycle,
  type PatternState,
} from "@/lib/patterns/pattern-state";
import type { PatternEvidenceItem } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

// ── Types ──────────────────────────────────────────────────────────────────

export type DepthTier = "evidence" | "partial" | "recognition";

export type SlotSpec =
  | { kind: "moments"; quotes: QuoteRef[] }
  | { kind: "pair"; quotes: [QuoteRef, QuoteRef] }
  | { kind: "echo"; phrase: string; quotes: QuoteRef[] }
  | { kind: "line" }
  | { kind: "close"; endingKind: Exclude<EndingKind, "none"> };

export type PatternPlan = {
  shapeId: string;
  signature: string;
  depthTier: DepthTier;
  endingKind: EndingKind;
  lifecycle: Lifecycle;
  slots: SlotSpec[];
  quotes: QuoteRef[];
};

export type NeighborShape = {
  depthTier: DepthTier;
  endingKind: EndingKind;
  shapeId: string;
};

export type PlanContext = {
  name: PatternName;
  evidence: PatternEvidenceItem[];
  globalActivityAt: number;
  prevState: PatternState | null;
  neighbors: NeighborShape[];
  now: number;
};

export type StateAdvanceResult = {
  state: PatternState;
  evidenceChanged: boolean;
  lifecycleChanged: boolean;
  lifecycle: Lifecycle;
  signals: LifecycleSignals;
  evidenceSignals: EvidenceSignals;
  evidenceKey: string;
};

export type PlanResult = {
  plan: PatternPlan;
  state: PatternState;
  evidenceChanged: boolean;
  lifecycleChanged: boolean;
};

type ShapeDef = {
  id: string;
  slotKinds: string[];
  depthTier: DepthTier;
  endingKind: EndingKind;
  eligible: (ctx: PlannerContext) => boolean;
};

type PlannerContext = {
  lifecycle: Lifecycle;
  signals: LifecycleSignals;
  evidenceSignals: EvidenceSignals;
};

// ── Depth tiers (strengthening ≡ strong for the user) ─────────────────────

const depthTierFor = (lifecycle: Lifecycle): DepthTier[] => {
  switch (lifecycle) {
    case "emerging":
      return ["evidence"];
    case "strengthening":
    case "strong":
      return ["partial", "recognition"];
    case "weakening":
      return ["evidence", "partial"];
    case "resting":
      return ["evidence"];
    case "returning":
      return ["evidence", "partial"];
  }
};

/** Material-driven shapes may appear at any lifecycle when evidence supports them. */
const MATERIAL_SHAPE_IDS = new Set(["echo", "pair", "pair_line", "discovery"]);

// ── Shape catalog ──────────────────────────────────────────────────────────

const SHAPES: ShapeDef[] = [
  {
    id: "bare",
    slotKinds: ["moments"],
    depthTier: "evidence",
    endingKind: "none",
    eligible: () => true,
  },
  {
    id: "bare_close",
    slotKinds: ["moments", "close:quote"],
    depthTier: "evidence",
    endingKind: "quote",
    eligible: ({ lifecycle }) => lifecycle === "emerging",
  },
  {
    id: "single",
    slotKinds: ["moments", "line"],
    depthTier: "partial",
    endingKind: "line",
    eligible: ({ lifecycle, evidenceSignals }) =>
      lifecycle !== "resting" &&
      !(
        isDeepLifecycle(lifecycle) && hasRecognitionDepth(evidenceSignals)
      ),
  },
  {
    id: "pair",
    slotKinds: ["pair"],
    depthTier: "evidence",
    endingKind: "none",
    eligible: ({ evidenceSignals }) => evidenceSignals.hasPair,
  },
  {
    id: "pair_line",
    slotKinds: ["pair", "line"],
    depthTier: "partial",
    endingKind: "line",
    eligible: ({ lifecycle, evidenceSignals }) =>
      evidenceSignals.hasPair &&
      (lifecycle === "returning" ||
        lifecycle === "strengthening" ||
        lifecycle === "strong"),
  },
  {
    id: "echo",
    slotKinds: ["echo", "moments"],
    depthTier: "evidence",
    endingKind: "none",
    eligible: ({ evidenceSignals }) => evidenceSignals.hasEcho,
  },
  {
    // Guided discovery: evidence pool, mechanism line (event chain), reflection question.
    id: "discovery",
    slotKinds: ["moments", "line", "close:question"],
    depthTier: "recognition",
    endingKind: "question",
    eligible: ({ lifecycle, evidenceSignals }) =>
      evidenceSignals.selectedQuotes.length >= 3 &&
      lifecycle !== "resting" &&
      lifecycle !== "emerging",
  },
  {
    // Legacy — kept for cached passages; discovery is preferred.
    id: "recognition",
    slotKinds: ["moments", "moments", "line", "close:line"],
    depthTier: "recognition",
    endingKind: "line",
    eligible: ({ lifecycle, evidenceSignals }) =>
      evidenceSignals.selectedQuotes.length >= 3 &&
      (lifecycle === "strengthening" || lifecycle === "strong"),
  },
  {
    id: "recognition_q",
    slotKinds: ["moments", "moments", "line", "close:question"],
    depthTier: "recognition",
    endingKind: "question",
    eligible: ({ lifecycle, evidenceSignals }) =>
      evidenceSignals.selectedQuotes.length >= 3 &&
      (lifecycle === "strengthening" || lifecycle === "strong"),
  },
  {
    // Legacy — kept for cached passages; discovery is preferred.
    id: "recognition_deep",
    slotKinds: ["moments", "moments", "line", "close:question"],
    depthTier: "recognition",
    endingKind: "question",
    eligible: ({ lifecycle, evidenceSignals }) =>
      evidenceSignals.selectedQuotes.length >= 5 &&
      (lifecycle === "strengthening" || lifecycle === "strong"),
  },
];

const BARE_SHAPE = SHAPES[0];

const isDeepLifecycle = (lifecycle: Lifecycle): boolean =>
  lifecycle === "strengthening" || lifecycle === "strong";

const hasRecognitionDepth = (signals: EvidenceSignals): boolean =>
  signals.selectedQuotes.length >= 3;

// ── Selection helpers ──────────────────────────────────────────────────────

const signatureFor = (shape: {
  slotKinds: string[];
  depthTier: DepthTier;
  endingKind: EndingKind;
}): string => `${shape.slotKinds.join(",")}|${shape.depthTier}|${shape.endingKind}`;

const rankCandidate = (shape: ShapeDef, ctx: PlannerContext): number => {
  if (ctx.lifecycle === "returning" && shape.id.startsWith("pair")) return 0;
  if (hasRecognitionDepth(ctx.evidenceSignals)) {
    if (shape.id === "discovery") return 0;
  }
  if (
    isDeepLifecycle(ctx.lifecycle) &&
    hasRecognitionDepth(ctx.evidenceSignals)
  ) {
    // Prefer the deep arc when there is enough evidence to earn a second layer.
    if (
      shape.id === "recognition_deep" &&
      ctx.evidenceSignals.selectedQuotes.length >= 5
    ) {
      return 1;
    }
    if (shape.id === "recognition" || shape.id === "recognition_q") return 2;
    if (shape.id === "echo") return 2;
    if (shape.id === "pair_line") return 3;
  } else if (ctx.evidenceSignals.hasEcho && shape.id === "echo") {
    return 0;
  }
  if (ctx.lifecycle === "weakening" && shape.id === "bare") return 1;
  if (shape.id === "single") return 5;
  if (shape.id === "bare") return 8;
  return 4;
};

const pickFromPool = (
  pool: ShapeDef[],
  ctx: PlannerContext,
  seed: string,
): ShapeDef => {
  if (pool.length === 0) return BARE_SHAPE;
  const bestRank = Math.min(...pool.map((s) => rankCandidate(s, ctx)));
  const tier = pool.filter((s) => rankCandidate(s, ctx) === bestRank);
  return tier[seededIndex(seed, tier.length)];
};

const seededIndex = (seed: string, count: number): number => {
  if (count <= 1) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % count;
};

const sortChronological = (quotes: QuoteRef[]): QuoteRef[] =>
  [...quotes].sort((a, b) => {
    if (a.anchorTs !== b.anchorTs) return a.anchorTs - b.anchorTs;
    return a.entryId.localeCompare(b.entryId);
  });

const splitMoments = (quotes: QuoteRef[], parts: number): QuoteRef[][] => {
  if (parts <= 1) return [sortChronological(quotes)];
  const chunk = Math.ceil(quotes.length / parts);
  const groups: QuoteRef[][] = [];
  for (let i = 0; i < parts; i += 1) {
    groups.push(sortChronological(quotes.slice(i * chunk, (i + 1) * chunk)));
  }
  return groups.filter((g) => g.length > 0);
};

/**
 * Recognition split: a single strong opening moment, then the remaining
 * moments (chronological) on the next evidence card. Keeps the journal —
 * not the AI — carrying the reflection, and avoids front-loading all
 * evidence into card one.
 */
const splitMomentsRecognition = (quotes: QuoteRef[]): QuoteRef[][] => {
  if (quotes.length <= 1) return [sortChronological(quotes)];
  const [opening, ...rest] = quotes;
  return [[opening], sortChronological(rest)];
};

const collidesWithNeighbor = (shape: ShapeDef, neighbors: NeighborShape[]): boolean =>
  neighbors.some((n) => {
    // Each surfaced pattern earns its own guided discovery arc — never block
    // discovery because a neighbor already used recognition depth / question.
    if (shape.id === "discovery") return false;
    return (
      (n.depthTier === shape.depthTier && n.endingKind === shape.endingKind) ||
      n.shapeId === shape.id
    );
  });

const filterCandidates = (
  ctx: PlannerContext,
  state: PatternState,
  neighbors: NeighborShape[],
): ShapeDef[] => {
  const allowed = new Set(depthTierFor(ctx.lifecycle));

  let candidates = SHAPES.filter((shape) => {
    const tierOk =
      allowed.has(shape.depthTier) ||
      (MATERIAL_SHAPE_IDS.has(shape.id) && shape.eligible(ctx));
    return tierOk && shape.eligible(ctx);
  });

  candidates = candidates.filter(
    (s) => !state.recentSignatures.includes(signatureFor(s)),
  );

  if (state.lastEndingKind !== "none") {
    candidates = candidates.filter(
      (s) => s.endingKind !== state.lastEndingKind,
    );
  }

  candidates = candidates.filter((s) => !collidesWithNeighbor(s, neighbors));

  return candidates;
};

const relaxAndPick = (
  ctx: PlannerContext,
  state: PatternState,
  neighbors: NeighborShape[],
  seed: string,
): ShapeDef => {
  const allowed = new Set(depthTierFor(ctx.lifecycle));

  const base = () =>
    SHAPES.filter((shape) => {
      const tierOk =
        allowed.has(shape.depthTier) ||
        (MATERIAL_SHAPE_IDS.has(shape.id) && shape.eligible(ctx));
      return tierOk && shape.eligible(ctx);
    });

  const guidedDiscoveryPool = (): ShapeDef[] => {
    if (
      !hasRecognitionDepth(ctx.evidenceSignals) ||
      ctx.lifecycle === "resting" ||
      ctx.lifecycle === "emerging"
    ) {
      return [];
    }
    return base().filter((s) => s.id === "discovery");
  };

  // Discovery first when eligible. Stage-0 filterCandidates used to win with
  // bare/echo/pair whenever discovery was rotated out (recentSignatures /
  // lastEndingKind) — a 2-beat arc that hides Continue at evidence. With
  // multiple surfaced patterns that lottery fired often, so tabbed Patterns
  // looked like it had "lost" the CTA.
  const stages: Array<() => ShapeDef[]> = [
    guidedDiscoveryPool,
    () => filterCandidates(ctx, state, neighbors),
    () => {
      const c = base().filter(
        (s) => !state.recentSignatures.includes(signatureFor(s)),
      );
      return c.length > 0 ? c : base();
    },
    () => base(),
    () => [BARE_SHAPE],
  ];

  for (const stage of stages) {
    const pool = stage();
    if (pool.length > 0) {
      return pickFromPool(pool, ctx, seed);
    }
  }

  return BARE_SHAPE;
};

// ── Slot materialization (plan specs) ────────────────────────────────────

const tokenFrom = (text: string): string => {
  const match = text.match(/\b[\w']{4,}\b/);
  return match?.[0] ?? text.slice(0, 12);
};

export const materializePlanSlots = (
  shape: ShapeDef,
  evidenceSignals: EvidenceSignals,
): SlotSpec[] => {
  const { selectedQuotes, pair, echo } = evidenceSignals;
  const momentsCount = shape.slotKinds.filter((k) => k === "moments").length;
  const momentsGroups =
    momentsCount === 2
      ? splitMomentsRecognition(selectedQuotes)
      : splitMoments(selectedQuotes, momentsCount);
  let momentsIdx = 0;

  return shape.slotKinds.map((kind) => {
    if (kind === "moments") {
      const quotes = momentsGroups[momentsIdx] ?? selectedQuotes;
      momentsIdx += 1;
      return { kind: "moments", quotes: sortChronological(quotes) };
    }
    if (kind === "pair") {
      const quotes = pair ?? ([selectedQuotes[0], selectedQuotes[1]] as [
        QuoteRef,
        QuoteRef,
      ]);
      return { kind: "pair", quotes };
    }
    if (kind === "echo") {
      const e = echo ?? {
        phrase: tokenFrom(selectedQuotes[0]?.text ?? ""),
        quotes: selectedQuotes.slice(0, 2),
      };
      return { kind: "echo", phrase: e.phrase, quotes: e.quotes };
    }
    if (kind === "line") return { kind: "line" };
    if (kind === "close:quote") return { kind: "close", endingKind: "quote" };
    if (kind === "close:question")
      return { kind: "close", endingKind: "question" };
    return { kind: "close", endingKind: "line" };
  });
};

// ── Public API ─────────────────────────────────────────────────────────────

/** Advance persisted state: evidence fingerprint + lifecycle classification. */
export function advancePatternState(ctx: PlanContext): StateAdvanceResult {
  const base = ctx.prevState ?? emptyState(ctx.name, ctx.now);
  const evidenceKey = buildEvidenceKey(ctx.evidence);
  const { state: withKey, changed: evidenceChanged } = withEvidence(
    base,
    evidenceKey,
  );

  const isFirstAttach = base.evidenceKey === "";
  const prevLifecycle = withKey.lifecycle;
  const { lifecycle, signals } = classifyLifecycle(
    ctx.evidence,
    ctx.globalActivityAt,
    withKey,
    ctx.now,
    { skipHysteresis: isFirstAttach },
  );

  const state = withLifecycle(withKey, lifecycle, ctx.now);
  const lifecycleChanged = prevLifecycle !== state.lifecycle;
  const evidenceSignals = deriveEvidenceSignals(
    ctx.evidence,
    lifecycle,
    ctx.now,
  );

  return {
    state,
    evidenceChanged,
    lifecycleChanged,
    lifecycle,
    signals,
    evidenceSignals,
    evidenceKey,
  };
}

/** Pick shape + signature without mutating plan memory (for cache validation). */
export function pickPlannedShape(
  ctx: PlanContext,
  advanced: StateAdvanceResult,
): Pick<PatternPlan, "shapeId" | "signature" | "depthTier" | "endingKind"> {
  const plannerCtx: PlannerContext = {
    lifecycle: advanced.lifecycle,
    signals: advanced.signals,
    evidenceSignals: advanced.evidenceSignals,
  };

  const seed = `${ctx.name}:${advanced.state.planEpoch}:${advanced.evidenceKey}`;
  const shape = relaxAndPick(
    plannerCtx,
    advanced.state,
    ctx.neighbors,
    seed,
  );

  return {
    shapeId: shape.id,
    signature: signatureFor(shape),
    depthTier: shape.depthTier,
    endingKind: shape.endingKind,
  };
}

/** Pick a composition shape and bind evidence to slots. */
export function createPlan(
  ctx: PlanContext,
  advanced: StateAdvanceResult,
): { plan: PatternPlan; state: PatternState } {
  const plannerCtx: PlannerContext = {
    lifecycle: advanced.lifecycle,
    signals: advanced.signals,
    evidenceSignals: advanced.evidenceSignals,
  };

  const seed = `${ctx.name}:${advanced.state.planEpoch}:${advanced.evidenceKey}`;
  const shape = relaxAndPick(
    plannerCtx,
    advanced.state,
    ctx.neighbors,
    seed,
  );
  const signature = signatureFor(shape);

  const plan: PatternPlan = {
    shapeId: shape.id,
    signature,
    depthTier: shape.depthTier,
    endingKind: shape.endingKind,
    lifecycle: advanced.lifecycle,
    slots: materializePlanSlots(shape, advanced.evidenceSignals),
    quotes: advanced.evidenceSignals.selectedQuotes,
  };

  const state = withPlan(
    advanced.state,
    signature,
    shape.endingKind,
    ctx.now,
  );

  return { plan, state };
}

/**
 * Deterministic discovery composition — used when upgrading a stale
 * evidence-only cache without running the full shape lottery.
 */
export function createDiscoveryPlan(
  ctx: PlanContext,
  advanced: StateAdvanceResult,
): { plan: PatternPlan; state: PatternState } | null {
  const shape = SHAPES.find((s) => s.id === "discovery");
  if (!shape) return null;

  const plannerCtx: PlannerContext = {
    lifecycle: advanced.lifecycle,
    signals: advanced.signals,
    evidenceSignals: advanced.evidenceSignals,
  };
  if (!shape.eligible(plannerCtx)) return null;

  const signature = signatureFor(shape);
  const plan: PatternPlan = {
    shapeId: shape.id,
    signature,
    depthTier: shape.depthTier,
    endingKind: shape.endingKind,
    lifecycle: advanced.lifecycle,
    slots: materializePlanSlots(shape, advanced.evidenceSignals),
    quotes: advanced.evidenceSignals.selectedQuotes,
  };

  const state = withPlan(
    advanced.state,
    signature,
    shape.endingKind,
    ctx.now,
  );

  return { plan, state };
}

/** Full plan in one call — convenience wrapper. */
export function planPattern(ctx: PlanContext): PlanResult {
  const advanced = advancePatternState(ctx);
  const { plan, state } = createPlan(ctx, advanced);
  return {
    plan,
    state,
    evidenceChanged: advanced.evidenceChanged,
    lifecycleChanged: advanced.lifecycleChanged,
  };
}

/** Plan all surfaced patterns — neighbor diversity enforced in order. */
export function planAllPatterns(
  patterns: Array<{ name: PatternName; evidence: PatternEvidenceItem[] }>,
  globalActivityAt: number,
  states: Map<PatternName, PatternState | null>,
  now: number,
): Map<PatternName, PlanResult> {
  const results = new Map<PatternName, PlanResult>();
  const neighbors: NeighborShape[] = [];

  for (const { name, evidence } of patterns) {
    const result = planPattern({
      name,
      evidence,
      globalActivityAt,
      prevState: states.get(name) ?? null,
      neighbors,
      now,
    });
    results.set(name, result);
    neighbors.push({
      depthTier: result.plan.depthTier,
      endingKind: result.plan.endingKind,
      shapeId: result.plan.shapeId,
    });
  }

  return results;
}
