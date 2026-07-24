/**
 * Unfold — pairwise pattern arbitration (post-hoc, deterministic).
 *
 * SINGLE SOURCE OF TRUTH for the confirmed colliding pairs. Each rule carries
 * BOTH the structural test (`loserKeepsWhen`) that runs in code AND the
 * `promptLine` rendered into the extraction prompt's TIE-BREAKERS block — so the
 * prompt's wording and the code's enforcement can never drift apart (the class
 * of regression that produced the self_doubt/self_criticism/overthinking
 * confusions and the Loop-stitching 681f321 revert).
 *
 * Runs AFTER schema/floor/evidence validation and AFTER the confidence sort,
 * BEFORE the MAX_PATTERNS slice. It re-ranks by POLICY, not by score — so do not
 * re-sort by confidence afterwards.
 *
 * Scope: only the four pairs the stored corpus proved were colliding. Broader
 * arbitration (e.g. overthinking vs every specific pattern, comparison vs
 * self_doubt) is intentionally deferred until data justifies it.
 */

import type { PatternMatch } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

/**
 * An explicit escalation to a worse EXTERNAL / FUTURE outcome — the thing that
 * makes catastrophizing distinct from a bare negative appraisal. Deliberately
 * excludes trait-generalization ("I'm sloppy in general"), which is
 * self_criticism, not catastrophizing.
 */
const ESCALATED_OUTCOME =
  /\b(would|going to|end(?:s|ed)? up|turn(?:s|ed)? into|blow up|fall(?:ing)? apart|unravel(?:ing|ed)?|spiral(?:ing|ed|led)?|ruin(?:ed|ing)?|disaster|written off|tanking|the whole (?:thing|project|presentation|routine|deck|piece)|everyone (?:would|will|thinks?|noticed?|saw)|never (?:hear|again|work|recover|moved?)|los(?:e|ing)|cost me|they'?d|they will|decided against|compromised|falling out|quietly cool)\b/i;

const hasEscalatedOutcome = (evidence: string): boolean =>
  ESCALATED_OUTCOME.test(evidence);

/**
 * Finished work getting rechecked / redone / never shipped — the narrowed
 * perfectionism test. Distinct from "worrying how it lands", which is
 * fear_of_judgment. Coarse lexical proxy for the prompt-side rule.
 */
const FINISHED_WORK_RECHECK =
  /\b(re-?read|re-?test(?:ed|ing)?|re-?check(?:ed|ing)?|redo|redid|redone|another (?:pass|version)|alternate versions?|one more (?:pass|look|time)|already (?:done|sent|finished|tested|shipped|signed)|still (?:haven'?t|hasn'?t|not) (?:shipped|sent|finished|done)|never (?:shipped|sent|finished)|(?:fifteen|five|four|three) (?:more )?times|more times|deleting each)\b/i;

const hasFinishedWorkRecheck = (evidence: string): boolean =>
  FINISHED_WORK_RECHECK.test(evidence);

export type ArbitrationRule = {
  id: string;
  /** The pattern at risk of over-firing on the wrong evidence. */
  loser: PatternName;
  /** The pattern it collides with and should usually yield to. */
  winner: PatternName;
  /** Apply only when |conf(loser) − conf(winner)| ≤ within (1 = always). */
  within: number;
  /** `loser` keeps priority ONLY when its own evidence passes this test. */
  loserKeepsWhen: (loserEvidence: string) => boolean;
  /** demote `loser` below `winner`, or drop `loser` entirely. */
  onLose: "demote" | "drop";
  /** Prose rendered into the extraction prompt — the same rule, model-facing. */
  promptLine: string;
};

export const ARBITRATION_RULES: ArbitrationRule[] = [
  {
    id: "overthinking_yields_to_fear_of_judgment",
    loser: "overthinking",
    winner: "fear_of_judgment",
    within: 1,
    loserKeepsWhen: () => false,
    onLose: "drop",
    promptLine:
      "If the loop is about how a moment came across to others, tag fear_of_judgment ONLY — do NOT also add overthinking. Overthinking is the residual bucket, never a co-tag alongside a specific pattern.",
  },
  {
    id: "catastrophizing_yields_to_self_doubt",
    loser: "catastrophizing",
    winner: "self_doubt",
    within: 0.15,
    loserKeepsWhen: hasEscalatedOutcome,
    onLose: "demote",
    promptLine:
      'Tag catastrophizing over self_doubt ONLY when the entry names an escalated worse outcome ("the whole thing fails", "they\'ll walk away"). A bare negative guess about your own ability — or deciding a quote/number is "too high" before any reply — is self_doubt.',
  },
  {
    id: "catastrophizing_yields_to_self_criticism",
    loser: "catastrophizing",
    winner: "self_criticism",
    within: 0.15,
    loserKeepsWhen: hasEscalatedOutcome,
    onLose: "demote",
    promptLine:
      'Tag catastrophizing over self_criticism ONLY when the entry escalates to a worse external/future outcome. A harsh self-label ("I\'m sloppy", "careless", "can\'t be trusted") — even generalized ("in general") — is self_criticism.',
  },
  {
    id: "perfectionism_yields_to_fear_of_judgment",
    loser: "perfectionism",
    winner: "fear_of_judgment",
    within: 0.15,
    loserKeepsWhen: hasFinishedWorkRecheck,
    onLose: "demote",
    promptLine:
      "Tag perfectionism over fear_of_judgment ONLY when the driver is FINISHED work getting rechecked, redone, or never shipped for its own quality. If the rechecking is driven by how it will land with others, that's fear_of_judgment.",
  },
];

export type ArbitrationAction =
  | { ruleId: string; kind: "drop"; dropped: PatternName; winner: PatternName }
  | { ruleId: string; kind: "demote"; loser: PatternName; winner: PatternName };

/**
 * Apply the rule table to one entry's patterns. Returns the re-ranked list plus
 * the actions taken (for offline replay / debugging). Pure — no I/O.
 */
export function reconcilePatterns(input: PatternMatch[]): {
  patterns: PatternMatch[];
  actions: ArbitrationAction[];
} {
  const work = [...input].sort((a, b) => b.confidence - a.confidence);
  const actions: ArbitrationAction[] = [];

  const find = (name: PatternName): PatternMatch | undefined =>
    work.find((p) => p.name === name);
  const evidenceText = (p: PatternMatch): string => p.evidence.join(" ");

  const fires = (rule: ArbitrationRule): boolean => {
    const loser = find(rule.loser);
    const winner = find(rule.winner);
    if (!loser || !winner) return false;
    if (Math.abs(loser.confidence - winner.confidence) > rule.within) {
      return false;
    }
    return !rule.loserKeepsWhen(evidenceText(loser));
  };

  // Drops first — they can remove a pattern the demote pass would otherwise see.
  for (const rule of ARBITRATION_RULES) {
    if (rule.onLose !== "drop") continue;
    if (!fires(rule)) continue;
    const loser = find(rule.loser)!;
    work.splice(work.indexOf(loser), 1);
    actions.push({
      ruleId: rule.id,
      kind: "drop",
      dropped: rule.loser,
      winner: rule.winner,
    });
  }

  // Demotes — only reorder when the loser currently outranks the winner.
  for (const rule of ARBITRATION_RULES) {
    if (rule.onLose !== "demote") continue;
    if (!fires(rule)) continue;
    const loser = find(rule.loser)!;
    const winner = find(rule.winner)!;
    const li = work.indexOf(loser);
    const wi = work.indexOf(winner);
    if (li < wi) {
      work.splice(li, 1);
      work.splice(work.indexOf(winner) + 1, 0, loser);
      actions.push({
        ruleId: rule.id,
        kind: "demote",
        loser: rule.loser,
        winner: rule.winner,
      });
    }
  }

  return { patterns: work, actions };
}

/** TIE-BREAKERS block for the extraction prompt — rendered from the same table. */
export function renderArbitrationPromptBlock(): string {
  return ARBITRATION_RULES.map((rule) => `- ${rule.promptLine}`).join("\n");
}
