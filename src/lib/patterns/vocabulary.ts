/**
 * Unfold — controlled vocabulary for semantic entry analysis (V1).
 *
 * Single source of truth shared by the Claude prompt (server route) and the
 * client aggregation/UI. These are MENTAL PATTERNS — the *how* of thinking —
 * kept deliberately small (10) for classification consistency. Topics (the
 * *what*) are a separate dimension.
 *
 * Each pattern is one object: definition + disambiguation + worked example(s)
 * co-located. Extraction prompt.ts only renders this catalog — do not encode
 * pattern behavioral tests in the prompt file.
 *
 * Run `npm run check:pattern-vocab` after edits.
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

/** Worked example for the extraction prompt (evidence must appear in entry). */
export type PatternExample = {
  /** Journal entry body. */
  entry: string;
  /** Optional contrast — usually vs overthinking. */
  wrong?: string;
  /** Topics in the Right JSON. */
  topics: string[];
  /** Confidence for the Right JSON. */
  confidence: number;
  /** Verbatim evidence quotes (must be substrings of entry). */
  evidence: string[];
  /** Why this pattern — must match definition/disambiguation behavioral test. */
  rationale: string;
};

export type PatternSpec = {
  name: PatternName;
  label: string;
  /** One-line behavioral test injected into MENTAL PATTERNS. */
  definition: string;
  /** Contrast/rule line injected into DISAMBIGUATION. */
  disambiguation: string;
  /**
   * Last-resort curiosity/tension title used when display-title generation
   * fails. A tension HOOK, never the behavioral test — must NOT echo the
   * definition or label (guarded by `npm run check:pattern-vocab`). Consumed by
   * pattern-display/fallback.ts, which derives its map from this catalog.
   */
  fallbackHook: string;
  /** At least one worked example. */
  examples: PatternExample[];
};

/**
 * Multi-pattern / empty calibration examples rendered before per-pattern solos.
 * Kept outside PATTERN_CATALOG because they are not owned by a single pattern.
 */
export type SharedExtractionExample =
  | {
      kind: "multi";
      heading: string;
      entry: string;
      topics: string[];
      patterns: Array<{
        name: PatternName;
        confidence: number;
        evidence: string[];
      }>;
    }
  | {
      kind: "none";
      heading: string;
      entry: string;
      topics: string[];
    };

/** Order of solo (NOT overthinking) examples in the extraction prompt. */
export const EXTRACTION_SOLO_EXAMPLE_ORDER: PatternName[] = [
  "avoidance",
  "comparison",
  "catastrophizing",
  "perfectionism",
  "fear_of_judgment",
  "people_pleasing",
  "all_or_nothing",
  "self_criticism",
];

export const PATTERN_CATALOG: Record<PatternName, PatternSpec> = {
  comparison: {
    name: "comparison",
    label: "Comparison",
    fallbackHook: "Already Behind?",
    definition:
      "measuring themselves against others' progress, status, or ability.",
    disambiguation:
      "comparison ranks self against others — not fear_of_judgment (worry about being evaluated).",
    examples: [
      {
        entry: `Saw two people from college post about their promotions today. Felt weird about it. Remembered I'm building my own thing so it's not really comparable but still checked their LinkedIn anyway.`,
        wrong: "overthinking (the move is measuring against others).",
        topics: ["career", "social media"],
        confidence: 0.9,
        evidence: [
          "not really comparable but still checked their LinkedIn anyway",
        ],
        rationale: "measuring against others' progress / status.",
      },
    ],
  },

  self_doubt: {
    name: "self_doubt",
    label: "Self-doubt",
    fallbackHook: "Not Ready Yet?",
    // Content fix: narrowed — ability/competence only; "worth" belongs with self_criticism.
    definition:
      "questioning their own ability or competence — uncertainty (\"can I?\").",
    disambiguation:
      'self_doubt = uncertainty ("can I?"); self_criticism = harsh judgment ("I\'m terrible").',
    examples: [
      {
        entry: `Got asked to lead the onboarding redesign today and my first thought wasn't excitement, it was a flat certainty that they'd chosen wrong. Nothing has actually gone wrong yet. The doubt just arrived the second the ask did.`,
        topics: ["a work ask", "onboarding"],
        confidence: 0.92,
        evidence: [
          "flat certainty that they'd chosen wrong",
          "Nothing has actually gone wrong yet",
        ],
        rationale: "uncertainty about ability before any evidence — \"can I?\"",
      },
    ],
  },

  overthinking: {
    name: "overthinking",
    label: "Overthinking",
    fallbackHook: "Still Not Settled.",
    definition:
      "looping on the same thought or decision without resolution, or replaying the past — only when a more specific pattern (catastrophizing, perfectionism, comparison, fear_of_judgment, avoidance, etc.) does not fit.",
    disambiguation:
      'overthinking = looping on the same thought or decision WITHOUT a clearer fit above. Prefer a specific pattern whenever one fits. If the loop is "assuming the worst" → catastrophizing. If it is "how this looks to others" → fear_of_judgment. If it is "redoing/rechecking finished work" → perfectionism. If it is measuring against someone else → comparison. If it is stalling on the real task → avoidance.',
    examples: [
      {
        // Residual bucket — positive example is "empty / prefer specific";
        // worked form is the Wrong path in other patterns' examples.
        entry: `Walked by the river after dinner. The air was cool and it smelled like rain. Felt good to just move for a while.`,
        topics: ["evening walk"],
        confidence: 0,
        evidence: [],
        rationale:
          "no specific pattern and no unresolved loop — empty patterns, not overthinking.",
      },
    ],
  },

  perfectionism: {
    name: "perfectionism",
    label: "Perfectionism",
    fallbackHook: "Almost Finished.",
    definition:
      "holding standards so high that finished work still gets rechecked, redone, or never shipped.",
    disambiguation:
      "perfectionism = standards so high that finished work still gets rechecked, redone, or never shipped.",
    examples: [
      {
        entry: `Fixed the bug. Tested it once, then five more times. Started reading the surrounding code "to be sure" nothing else was broken. Two hours later realized I never actually shipped it.`,
        wrong: "overthinking (rechecking finished work / never shipping).",
        topics: ["a bug fix"],
        confidence: 0.91,
        evidence: [
          "Tested it once, then five more times",
          "never actually shipped it",
        ],
        rationale: "rechecking finished work / never shipping.",
      },
    ],
  },

  avoidance: {
    name: "avoidance",
    label: "Avoidance",
    fallbackHook: "Left Until Tomorrow.",
    definition:
      "putting off, escaping, or distracting from something that matters.",
    disambiguation:
      "avoidance = putting off, escaping, or distracting from the thing that matters (including stalling by rereading / busywork).",
    examples: [
      {
        entry: `Sat down to fix the bug. Reread the same file three times instead of changing anything. Still not started.`,
        wrong: "overthinking (rereading is stalling on the real task).",
        topics: ["a bug fix"],
        confidence: 0.88,
        evidence: [
          "Reread the same file three times instead of changing anything",
        ],
        rationale: "stalling on the real task via reread / busywork.",
      },
    ],
  },

  catastrophizing: {
    name: "catastrophizing",
    label: "Catastrophizing",
    fallbackHook: "What If Worst?",
    definition: "jumping to or escalating toward the worst-case outcome.",
    disambiguation:
      'catastrophizing escalates to a worst-case outcome ("they\'re unhappy", "it\'ll blow up").',
    examples: [
      {
        entry: `Client hasn't replied to the invoice email in 3 days. Thought maybe they're unhappy with the work — or just busy. Started planning how I'd redo the whole project for free if they asked.`,
        wrong:
          "overthinking (this escalates to a worst case and a rescue plan).",
        topics: ["a client", "an invoice"],
        confidence: 0.9,
        evidence: [
          "Thought maybe they're unhappy with the work",
          "how I'd redo the whole project for free if they asked",
        ],
        rationale: "escalates to a worst-case outcome and rescue plan.",
      },
    ],
  },

  people_pleasing: {
    name: "people_pleasing",
    label: "People-pleasing",
    fallbackHook: "Their Comfort First?",
    definition:
      "prioritizing others' approval or comfort over their own needs.",
    disambiguation:
      "people_pleasing = yielding or softening the truth to keep someone else comfortable — not fear_of_judgment (worry about evaluation without yielding), not avoidance (escaping the task rather than prioritizing the other person).",
    examples: [
      {
        entry: `didn't want to tell riya the design feedback was actually bad. said "it's good, just maybe tweak spacing" instead. he seemed happy. i still think it needs a full redo`,
        wrong:
          "fear_of_judgment (the move is not just worry — they changed what they said to protect his comfort).",
        topics: ["design feedback", "a teammate"],
        confidence: 0.9,
        evidence: [
          'said "it\'s good, just maybe tweak spacing" instead',
          "he seemed happy. i still think it needs a full redo",
        ],
        rationale:
          "softened the real take so the other person stayed comfortable.",
      },
    ],
  },

  fear_of_judgment: {
    name: "fear_of_judgment",
    label: "Fear of judgment",
    fallbackHook: "Who's Watching?",
    definition: "worrying about how others perceive or evaluate them.",
    disambiguation:
      "fear_of_judgment worries about being evaluated — not comparison (ranking self against others).",
    examples: [
      {
        entry: `Posted the Unfold screenshot on Twitter. Immediately regretted the caption — thought it sounded try-hard. Refreshed three times in ten minutes. No replies yet so now thinking it looks bad.`,
        wrong: "overthinking (the worry is how others perceive it).",
        topics: ["a social post"],
        confidence: 0.9,
        evidence: [
          "Immediately regretted the caption — thought it sounded try-hard",
        ],
        rationale: "worry about how others perceive / evaluate them.",
      },
    ],
  },

  self_criticism: {
    name: "self_criticism",
    label: "Self-criticism",
    fallbackHook: "My Fault Again?",
    definition: "harsh self-talk or blaming themselves.",
    disambiguation:
      'self_criticism = harsh judgment ("I\'m terrible") — not self_doubt uncertainty ("can I?").',
    examples: [
      {
        entry: `Missed one deadline by half a day because of a family thing, and instead of just noting that and moving on, I spent the evening calling myself unreliable, like one missed half-day erases every deadline I've hit before it without issue.`,
        topics: ["a missed deadline"],
        confidence: 0.94,
        evidence: ["spent the evening calling myself unreliable"],
        rationale: "harsh self-label — \"I'm unreliable\" — not mere uncertainty.",
      },
    ],
  },

  all_or_nothing: {
    name: "all_or_nothing",
    label: "All-or-nothing",
    fallbackHook: "No Middle Ground?",
    definition: "black-and-white thinking with no middle ground.",
    disambiguation:
      "all_or_nothing = one miss or trait zeros the rest (no middle ground). Can co-occur with self_criticism; all_or_nothing is the totalizing math, self_criticism is the harsh identity label.",
    examples: [
      {
        entry: `Skipped a workout because of a headache and told myself I have no discipline at all, like the entire month of consistent training before this doesn't count for anything once one day gets missed.`,
        wrong:
          "self_criticism alone (the distinctive move is totalizing: one miss zeros the streak).",
        topics: ["a workout", "discipline"],
        confidence: 0.94,
        evidence: [
          "I have no discipline at all",
          "doesn't count for anything once one day gets missed",
        ],
        rationale: "one miss zeros everything — black-and-white, no middle.",
      },
    ],
  },
};

export const EXTRACTION_SHARED_EXAMPLES: SharedExtractionExample[] = [
  {
    kind: "multi",
    heading: "EXAMPLE 1",
    entry: `Another rejection. People my age are already leading teams and I'm still here. Maybe I'm just not good enough for this. I keep rewriting my resume but never actually send it.`,
    topics: ["career", "job search"],
    patterns: [
      {
        name: "comparison",
        confidence: 0.92,
        evidence: [
          "People my age are already leading teams and I'm still here",
        ],
      },
      {
        name: "self_doubt",
        confidence: 0.86,
        evidence: ["Maybe I'm just not good enough for this"],
      },
      {
        name: "avoidance",
        confidence: 0.7,
        evidence: [
          "I keep rewriting my resume but never actually send it",
        ],
      },
    ],
  },
  {
    kind: "none",
    heading: "EXAMPLE 2 (no patterns)",
    entry: `Walked by the river after dinner. The air was cool and it smelled like rain. Felt good to just move for a while.`,
    topics: ["evening walk"],
  },
];

/** Human-facing labels (derived). */
export const PATTERN_LABELS: Record<PatternName, string> = Object.fromEntries(
  PATTERN_NAMES.map((name) => [name, PATTERN_CATALOG[name].label]),
) as Record<PatternName, string>;

/** Definitions injected into prompts / APIs (derived). */
export const PATTERN_DEFINITIONS: Record<PatternName, string> =
  Object.fromEntries(
    PATTERN_NAMES.map((name) => [name, PATTERN_CATALOG[name].definition]),
  ) as Record<PatternName, string>;

/** Minimum confidence for a pattern to be emitted/kept. */
export const PATTERN_CONFIDENCE_FLOOR = 0.5;

/** Max patterns / topics / evidence quotes per entry. */
export const MAX_PATTERNS_PER_ENTRY = 3;
export const MAX_TOPICS_PER_ENTRY = 2;
export const MAX_EVIDENCE_PER_PATTERN = 2;

/** A pattern must appear in at least this many distinct entries to surface. */
export const SURFACE_MIN_ENTRIES = 3;
