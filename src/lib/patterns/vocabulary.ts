/**
 * Unfold — controlled vocabulary for semantic entry analysis (V1).
 *
 * Single source of truth shared by the Claude prompt (server route) and the
 * client aggregation/UI. These are MENTAL PATTERNS — the *how* of thinking —
 * kept deliberately small (10) for classification consistency. Topics (the
 * *what*) are a separate dimension.
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

/** Human-facing labels. */
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

/** Definitions injected into the Claude prompt (one line each). */
export const PATTERN_DEFINITIONS: Record<PatternName, string> = {
  comparison:
    "measuring themselves against others' progress, status, or ability.",
  self_doubt: "questioning their own ability, competence, or worth.",
  overthinking:
    "looping on the same thought or decision without resolution, or replaying the past.",
  perfectionism: "holding standards so high that nothing feels good enough.",
  avoidance:
    "putting off, escaping, or distracting from something that matters.",
  catastrophizing: "jumping to or escalating toward the worst-case outcome.",
  people_pleasing:
    "prioritizing others' approval or comfort over their own needs.",
  fear_of_judgment: "worrying about how others perceive or evaluate them.",
  self_criticism: "harsh self-talk or blaming themselves.",
  all_or_nothing: "black-and-white thinking with no middle ground.",
};

/** Minimum confidence for a pattern to be emitted/kept. */
export const PATTERN_CONFIDENCE_FLOOR = 0.5;

/** Max patterns / topics / evidence quotes per entry. */
export const MAX_PATTERNS_PER_ENTRY = 3;
export const MAX_TOPICS_PER_ENTRY = 2;
export const MAX_EVIDENCE_PER_PATTERN = 2;

/** A pattern must appear in at least this many distinct entries to surface. */
export const SURFACE_MIN_ENTRIES = 3;
