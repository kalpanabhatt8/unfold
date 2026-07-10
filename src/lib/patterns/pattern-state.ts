/**
 * Unfold — longitudinal state for living patterns.
 *
 * One record per pattern name, in its own localStorage namespace
 * (`keeps-pattern-state`). This is the planner's *memory*: the lifecycle stage
 * (with dwell time for hysteresis), the recently used composition signatures
 * (repetition guard), the last ending kind, and an evidence fingerprint +
 * epoch that only advances when the evidence genuinely changes.
 *
 * It deliberately does NOT hold the rendered passage (chosen shape + generated
 * words). That is a disposable cache keyed by the evidence fingerprint; this
 * record must survive evidence changes, dormancy, and a pattern disappearing
 * and later returning, so we never delete it on disappearance.
 *
 * Persistence is thin; all state transitions are pure functions with an
 * injected `now`, so the classifier and planner can be unit-tested without a
 * DOM. This module is the only place that touches the store — swap it for a
 * server-backed repository later without changing callers.
 */

import { isPatternName, type PatternName } from "@/lib/patterns/vocabulary";
import { markPatternsDirty } from "@/lib/sync/local-flags";

export const PATTERN_STATE_STORAGE_KEY = "keeps-pattern-state";

/** How many recent composition signatures we remember per pattern. */
export const SIGNATURE_MEMORY = 3;

/**
 * A pattern's stage of life. `resting` means "no new evidence to judge by" —
 * we never imply the user changed without data; it is distinct from
 * `weakening`, which is a genuine, data-backed decline while journaling
 * continues.
 */
export type Lifecycle =
  | "emerging"
  | "strengthening"
  | "strong"
  | "weakening"
  | "resting"
  | "returning";

/** How a passage ends. Owned by the planner, not the model. */
export type EndingKind = "none" | "line" | "question" | "quote";

export type PatternState = {
  name: PatternName;
  lifecycle: Lifecycle;
  /** When we entered the current lifecycle (epoch ms) — powers hysteresis. */
  lifecycleSince: number;
  /** Most-recent-last, capped at SIGNATURE_MEMORY. */
  recentSignatures: string[];
  lastEndingKind: EndingKind;
  /** Advances only when `evidenceKey` changes — the regeneration trigger. */
  planEpoch: number;
  /** Fingerprint of the evidence set the current plan was built from. */
  evidenceKey: string;
  lastPlanAt: number;
};

const LIFECYCLES: ReadonlySet<string> = new Set<Lifecycle>([
  "emerging",
  "strengthening",
  "strong",
  "weakening",
  "resting",
  "returning",
]);

const ENDING_KINDS: ReadonlySet<string> = new Set<EndingKind>([
  "none",
  "line",
  "question",
  "quote",
]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isValidState = (v: unknown): v is PatternState => {
  if (!isRecord(v)) return false;
  return (
    isPatternName(v.name) &&
    typeof v.lifecycle === "string" &&
    LIFECYCLES.has(v.lifecycle) &&
    typeof v.lifecycleSince === "number" &&
    Array.isArray(v.recentSignatures) &&
    v.recentSignatures.every((s) => typeof s === "string") &&
    typeof v.lastEndingKind === "string" &&
    ENDING_KINDS.has(v.lastEndingKind) &&
    typeof v.planEpoch === "number" &&
    typeof v.evidenceKey === "string" &&
    typeof v.lastPlanAt === "number"
  );
};

// ── Pure transforms (no window, injected `now`) ────────────────────────────

/** A fresh state for a pattern seen for the first time. */
export const emptyState = (name: PatternName, now: number): PatternState => ({
  name,
  lifecycle: "emerging",
  lifecycleSince: now,
  recentSignatures: [],
  lastEndingKind: "none",
  planEpoch: 0,
  evidenceKey: "",
  lastPlanAt: 0,
});

/**
 * Move to a lifecycle stage. `lifecycleSince` only resets when the stage
 * actually changes, so dwell time (used for hysteresis) keeps accumulating
 * while the pattern holds a stage.
 */
export const withLifecycle = (
  state: PatternState,
  lifecycle: Lifecycle,
  now: number,
): PatternState =>
  state.lifecycle === lifecycle
    ? state
    : { ...state, lifecycle, lifecycleSince: now };

/**
 * Register the current evidence fingerprint. Advances `planEpoch` only when
 * the fingerprint changed — this is the "regenerate only when evidence
 * changes" trigger. Returns the (possibly unchanged) state plus a `changed`
 * flag callers use to decide whether to re-plan.
 */
export const withEvidence = (
  state: PatternState,
  evidenceKey: string,
): { state: PatternState; changed: boolean } => {
  if (state.evidenceKey === evidenceKey) return { state, changed: false };
  return {
    state: { ...state, evidenceKey, planEpoch: state.planEpoch + 1 },
    changed: true,
  };
};

/**
 * Record that a plan with `signature`/`endingKind` was chosen. Appends to the
 * capped signature memory (skipping an immediate duplicate) and stamps the
 * ending + time.
 */
export const withPlan = (
  state: PatternState,
  signature: string,
  endingKind: EndingKind,
  now: number,
): PatternState => {
  const last = state.recentSignatures.at(-1);
  const next =
    last === signature
      ? state.recentSignatures
      : [...state.recentSignatures, signature].slice(-SIGNATURE_MEMORY);
  return {
    ...state,
    recentSignatures: next,
    lastEndingKind: endingKind,
    lastPlanAt: now,
  };
};

// ── Persistence ────────────────────────────────────────────────────────────

const readAll = (): Record<string, PatternState> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PATTERN_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    // Defensively drop malformed / orphaned records rather than trusting the
    // blob — a bad PatternState would corrupt lifecycle and repetition logic.
    const clean: Record<string, PatternState> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isValidState(value) && value.name === key) clean[key] = value;
    }
    return clean;
  } catch (error) {
    console.error("Failed to read pattern state", error);
    return {};
  }
};

const writeAll = (map: Record<string, PatternState>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PATTERN_STATE_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch (error) {
    console.error("Failed to save pattern state", error);
  }
};

export const getState = (name: PatternName): PatternState | null =>
  readAll()[name] ?? null;

export const listStates = (): PatternState[] => Object.values(readAll());

export const putState = (state: PatternState): void => {
  if (!isValidState(state)) return;
  const map = readAll();
  map[state.name] = state;
  writeAll(map);
  markPatternsDirty();
};

/**
 * Remove a pattern's state. NOT used when a pattern merely disappears from the
 * surface — that history is what lets us detect a later return. Intended for
 * explicit resets / tests only.
 */
export const deleteState = (name: PatternName): void => {
  const map = readAll();
  if (!(name in map)) return;
  delete map[name];
  writeAll(map);
};
