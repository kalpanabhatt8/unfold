/**
 * Unfold - controlled vocabulary for semantic entry analysis (V1).
 *
 * Server-side catalog: definitions, disambiguation, and worked examples for
 * extraction prompts. Client-safe names/labels/hooks live in
 * vocabulary-public.ts — import that module from client components so the
 * full catalog never ships in the browser bundle.
 *
 * Do not value-import this file from client code. Use vocabulary-public.ts.
 * (No `server-only` marker — scripts/check-pattern-vocab must import it.)
 *
 * Run `npm run check:pattern-vocab` after edits.
 */

import {
  MAX_EVIDENCE_PER_PATTERN,
  MAX_PATTERNS_PER_ENTRY,
  MAX_TOPICS_PER_ENTRY,
  PATTERN_CONFIDENCE_FLOOR,
  PATTERN_FALLBACK_HOOKS,
  PATTERN_LABELS,
  PATTERN_NAMES,
  SURFACE_MIN_ENTRIES,
  SURFACE_MIN_PRIMARY_ENTRIES,
  SURFACE_VOTE_MIN_CONFIDENCE,
  isPatternName,
  type PatternName,
} from "@/lib/patterns/vocabulary-public";

export {
  MAX_EVIDENCE_PER_PATTERN,
  MAX_PATTERNS_PER_ENTRY,
  MAX_TOPICS_PER_ENTRY,
  PATTERN_CONFIDENCE_FLOOR,
  PATTERN_FALLBACK_HOOKS,
  PATTERN_LABELS,
  PATTERN_NAMES,
  SURFACE_MIN_ENTRIES,
  SURFACE_MIN_PRIMARY_ENTRIES,
  SURFACE_VOTE_MIN_CONFIDENCE,
  isPatternName,
  type PatternName,
};

/** Worked example for the extraction prompt (evidence must appear in entry). */
export type PatternExample = {
  /** Journal entry body. */
  entry: string;
  /** Optional contrast - usually vs overthinking. */
  wrong?: string;
  /** Topics in the Right JSON. */
  topics: string[];
  /** Confidence for the Right JSON. */
  confidence: number;
  /** Verbatim evidence quotes (must be substrings of entry). */
  evidence: string[];
  /** Why this pattern - must match definition/disambiguation behavioral test. */
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
   * Last-resort evidence-grounded title used when display-title generation
   * fails. A tension HOOK, never the behavioral test - must NOT echo the
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
    label: PATTERN_LABELS.comparison,
    fallbackHook: PATTERN_FALLBACK_HOOKS.comparison,
    definition:
      "explicitly placing their own standing relative to another person or peer group - making visible where they are (or feel they are) against someone else's progress, status, ability, or outcome.",
    disambiguation:
      "comparison requires the writing to make the writer's own position relative to others explicit - not fear_of_judgment (worry about being evaluated). Another person's milestone, lingering attention, admiration, inspiration, or checking their profile is NOT enough. An implied contrast that only says other people handle things more easily - used to criticize your own difficulty, discipline, or competence - is NOT comparison unless the writer also states their own standing relative to those people.",
    examples: [
      {
        entry: `Saw two people from college post about their promotions today. Felt weird about it. Remembered I'm building my own thing so it's not really comparable but still checked their LinkedIn anyway.`,
        wrong: "overthinking (the move is measuring against others).",
        topics: ["career", "social media"],
        confidence: 0.9,
        evidence: [
          "not really comparable but still checked their LinkedIn anyway",
        ],
        rationale:
          "explicit self-relative measuring against others' progress/status (checked LinkedIn despite saying it wasn't comparable).",
      },
    ],
  },

  self_doubt: {
    name: "self_doubt",
    label: PATTERN_LABELS.self_doubt,
    fallbackHook: PATTERN_FALLBACK_HOOKS.self_doubt,
    // Content fix: narrowed - ability/competence only; "worth" belongs with self_criticism.
    definition:
      "questioning their own ability or competence - uncertainty (\"can I?\").",
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
        rationale: "uncertainty about ability before any evidence - \"can I?\"",
      },
    ],
  },

  overthinking: {
    name: "overthinking",
    label: PATTERN_LABELS.overthinking,
    fallbackHook: PATTERN_FALLBACK_HOOKS.overthinking,
    definition:
      "looping on the same thought or decision without resolution, or replaying the past - only when a more specific pattern (catastrophizing, perfectionism, comparison, fear_of_judgment, avoidance, etc.) does not fit.",
    disambiguation:
      'overthinking = looping on the same thought or decision WITHOUT a clearer fit above. Prefer a specific pattern whenever one fits. If the loop is "assuming the worst" → catastrophizing. If it is "how this looks to others" → fear_of_judgment. If it is "redoing/rechecking finished work" → perfectionism. If it is measuring against someone else → comparison. If it is stalling on the real task → avoidance.',
    examples: [
      {
        // Residual bucket - positive example is "empty / prefer specific";
        // worked form is the Wrong path in other patterns' examples.
        entry: `Walked by the river after dinner. The air was cool and it smelled like rain. Felt good to just move for a while.`,
        topics: ["evening walk"],
        confidence: 0,
        evidence: [],
        rationale:
          "no specific pattern and no unresolved loop - empty patterns, not overthinking.",
      },
    ],
  },

  perfectionism: {
    name: "perfectionism",
    label: PATTERN_LABELS.perfectionism,
    fallbackHook: PATTERN_FALLBACK_HOOKS.perfectionism,
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
    label: PATTERN_LABELS.avoidance,
    fallbackHook: PATTERN_FALLBACK_HOOKS.avoidance,
    definition:
      "putting off, escaping, or stalling on a specific task or action the person intends to do - not starting, not continuing, or substituting busywork for that task.",
    disambiguation:
      "avoidance = retreating from a concrete task they mean to do (including stalling by rereading / busywork, or not taking a corrective action like calling back to decline because they imagine judgment). Repeated checking or monitoring to get reassurance about how something already landed - a message, a reaction, an outcome - is NOT avoidance; that belongs with fear_of_judgment or catastrophizing.",
    examples: [
      {
        entry: `Sat down to fix the bug. Reread the same file three times instead of changing anything. Still not started.`,
        wrong: "overthinking (rereading is stalling on the real task).",
        topics: ["a bug fix"],
        confidence: 0.88,
        evidence: [
          "Reread the same file three times instead of changing anything",
        ],
        rationale:
          "stalling on starting/continuing a concrete task via reread / busywork - not reassurance-checking.",
      },
    ],
  },

  catastrophizing: {
    name: "catastrophizing",
    label: PATTERN_LABELS.catastrophizing,
    fallbackHook: PATTERN_FALLBACK_HOOKS.catastrophizing,
    definition: "jumping to or escalating toward the worst-case outcome.",
    disambiguation:
      'catastrophizing escalates to a worst-case outcome ("they\'re unhappy", "it\'ll blow up").',
    examples: [
      {
        entry: `Client hasn't replied to the invoice email in 3 days. Thought maybe they're unhappy with the work - or just busy. Started planning how I'd redo the whole project for free if they asked.`,
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
    label: PATTERN_LABELS.people_pleasing,
    fallbackHook: PATTERN_FALLBACK_HOOKS.people_pleasing,
    definition:
      "prioritizing others' approval or comfort over their own needs.",
    disambiguation:
      "people_pleasing = yielding or softening the truth to keep someone else comfortable - not fear_of_judgment (worry about evaluation without yielding), not avoidance (escaping the task rather than prioritizing the other person).",
    examples: [
      {
        entry: `didn't want to tell riya the design feedback was actually bad. said "it's good, just maybe tweak spacing" instead. he seemed happy. i still think it needs a full redo`,
        wrong:
          "fear_of_judgment (the move is not just worry - they changed what they said to protect his comfort).",
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
    label: PATTERN_LABELS.fear_of_judgment,
    fallbackHook: PATTERN_FALLBACK_HOOKS.fear_of_judgment,
    definition: "worrying about how others perceive or evaluate them.",
    disambiguation:
      "fear_of_judgment worries about being evaluated - not comparison (ranking self against others).",
    examples: [
      {
        entry: `Posted the Unfold screenshot on Twitter. Immediately regretted the caption - thought it sounded try-hard. Refreshed three times in ten minutes. No replies yet so now thinking it looks bad.`,
        wrong: "overthinking (the worry is how others perceive it).",
        topics: ["a social post"],
        confidence: 0.9,
        evidence: [
          "Immediately regretted the caption - thought it sounded try-hard",
        ],
        rationale: "worry about how others perceive / evaluate them.",
      },
    ],
  },

  self_criticism: {
    name: "self_criticism",
    label: PATTERN_LABELS.self_criticism,
    fallbackHook: PATTERN_FALLBACK_HOOKS.self_criticism,
    definition: "harsh self-talk or blaming themselves.",
    disambiguation:
      'self_criticism = harsh judgment ("I\'m terrible") - not self_doubt uncertainty ("can I?").',
    examples: [
      {
        entry: `Missed one deadline by half a day because of a family thing, and instead of just noting that and moving on, I spent the evening calling myself unreliable, like one missed half-day erases every deadline I've hit before it without issue.`,
        topics: ["a missed deadline"],
        confidence: 0.94,
        evidence: ["spent the evening calling myself unreliable"],
        rationale: "harsh self-label - \"I'm unreliable\" - not mere uncertainty.",
      },
    ],
  },

  all_or_nothing: {
    name: "all_or_nothing",
    label: PATTERN_LABELS.all_or_nothing,
    fallbackHook: PATTERN_FALLBACK_HOOKS.all_or_nothing,
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
        rationale: "one miss zeros everything - black-and-white, no middle.",
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
  {
    kind: "none",
    heading:
      "EXAMPLE 3 (no patterns - peer milestone + lingering attention is NOT comparison)",
    entry: `My classmate's startup got funded today. I kept thinking about it on the way home. Not sure why.`,
    topics: ["a classmate's startup"],
  },
  {
    kind: "none",
    heading:
      "EXAMPLE 4 (no patterns - inspiration after someone else's success is NOT comparison)",
    entry: `My classmate's startup got funded today. It made me want to work harder on my own idea.`,
    topics: ["a classmate's startup", "own idea"],
  },
  {
    kind: "none",
    heading:
      "EXAMPLE 5 (no patterns - admiration of someone else's work is NOT comparison)",
    entry: `My classmate's startup got funded today. Honestly, I'm just impressed by how much she's built.`,
    topics: ["a classmate's startup"],
  },
  {
    kind: "none",
    heading:
      "EXAMPLE 6 (no patterns - explicit rejection of comparing is NOT comparison)",
    entry: `It made me think about my own year for a while, but I wasn't really comparing myself to her.`,
    topics: ["reflection on the year"],
  },
  {
    kind: "multi",
    heading:
      "EXAMPLE 7 (self_criticism only - 'other people do it easier' without stating your own standing is NOT comparison)",
    entry: `I missed the deadline today. Other people manage to get their work done without making everything so difficult. I should have been more disciplined.`,
    topics: ["a missed deadline"],
    patterns: [
      {
        name: "self_criticism",
        confidence: 0.9,
        evidence: ["I should have been more disciplined"],
      },
    ],
  },
  {
    kind: "multi",
    heading:
      "EXAMPLE 8 (fear_of_judgment + catastrophizing - repeated phone-checking for reassurance is NOT avoidance)",
    entry: `I sent a message yesterday and they still haven't replied. I keep checking my phone anyway. Maybe I said too much. Maybe they were annoyed with me. I keep telling myself not to check, and then two minutes later I'm looking at the screen again.`,
    topics: ["a message", "waiting for a reply"],
    patterns: [
      {
        name: "catastrophizing",
        confidence: 0.88,
        evidence: ["Maybe they were annoyed with me"],
      },
      {
        name: "fear_of_judgment",
        confidence: 0.86,
        evidence: ["Maybe I said too much"],
      },
    ],
  },
  {
    kind: "multi",
    heading:
      "EXAMPLE 9 (people_pleasing + avoidance - not calling back to decline because of imagined judgment IS avoidance; that is not the same as phone-checking for reassurance)",
    entry: `My cousin asked me to help this weekend and I immediately said yes. Afterward I considered calling back and saying I couldn't do it, but then I imagined them thinking I was selfish. So I kept the commitment and rearranged my Saturday.`,
    topics: ["a weekend ask", "saying yes"],
    patterns: [
      {
        name: "people_pleasing",
        confidence: 0.94,
        evidence: [
          "My cousin asked me to help this weekend and I immediately said yes",
        ],
      },
      {
        name: "avoidance",
        confidence: 0.86,
        evidence: [
          "I considered calling back and saying I couldn't do it, but then I imagined them thinking I was selfish",
        ],
      },
    ],
  },
];

/** Definitions injected into prompts / APIs (derived from server catalog only). */
export const PATTERN_DEFINITIONS: Record<PatternName, string> =
  Object.fromEntries(
    PATTERN_NAMES.map((name) => [name, PATTERN_CATALOG[name].definition]),
  ) as Record<PatternName, string>;
