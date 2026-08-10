/**
 * Client-safe pattern vocabulary surface.
 *
 * Labels, names, fallback hooks, and aggregation constants only — no
 * definitions, disambiguation, or worked examples (those stay in
 * vocabulary.ts for server-side extraction prompts).
 */

/** The 10 V1 mental patterns. `need_for_control` + `guilt` are deferred to V2. */
export const PATTERN_NAMES = [
  "comparison",
  "self_doubt",
  "overthinking",
  "perfectionism",
  "avoidance",
  "catastrophizing",
  "people_pleasing",
  "fear_of_judgment",
  "self_criticism",
  "all_or_nothing",
] as const;

export type PatternName = (typeof PATTERN_NAMES)[number];

const PATTERN_NAME_SET: ReadonlySet<string> = new Set(PATTERN_NAMES);

export const isPatternName = (value: unknown): value is PatternName =>
  typeof value === "string" && PATTERN_NAME_SET.has(value);

/** Human-facing labels for UI. */
export const PATTERN_LABELS: Record<PatternName, string> = {
  comparison: "Comparison",
  self_doubt: "Self-doubt",
  overthinking: "Overthinking",
  perfectionism: "Perfectionism",
  avoidance: "Avoidance",
  catastrophizing: "Catastrophizing",
  people_pleasing: "People-pleasing",
  fear_of_judgment: "Fear of judgment",
  self_criticism: "Self-criticism",
  all_or_nothing: "All-or-nothing",
};

/**
 * Last-resort curiosity/tension titles when display-title generation fails.
 * Must NOT echo the behavioral definition or label (guarded by check:pattern-vocab).
 */
export const PATTERN_FALLBACK_HOOKS: Record<PatternName, string> = {
  comparison: "Already Behind?",
  self_doubt: "Not Ready Yet?",
  overthinking: "Still Not Settled.",
  perfectionism: "Almost Finished.",
  avoidance: "Left Until Tomorrow.",
  catastrophizing: "What If Worst?",
  people_pleasing: "Their Comfort First?",
  fear_of_judgment: "Who's Watching?",
  self_criticism: "My Fault Again?",
  all_or_nothing: "No Middle Ground?",
};

/** Minimum confidence for a pattern to be emitted/kept. */
export const PATTERN_CONFIDENCE_FLOOR = 0.5;

/** Max patterns / topics / evidence quotes per entry. */
export const MAX_PATTERNS_PER_ENTRY = 3;
export const MAX_TOPICS_PER_ENTRY = 2;
export const MAX_EVIDENCE_PER_PATTERN = 2;

/** A pattern must appear in at least this many distinct entries to surface. */
export const SURFACE_MIN_ENTRIES = 3;

/** Min confidence for an entry tag to count as a recurrence vote. */
export const SURFACE_VOTE_MIN_CONFIDENCE = 0.75;
/** Min entries where the pattern was a primary (top-confidence) reading. */
export const SURFACE_MIN_PRIMARY_ENTRIES = 2;
