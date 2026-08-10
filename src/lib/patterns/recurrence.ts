/**
 * Cross-entry recurrence judgment for Phase 3 aggregation.
 *
 * Entry-level extraction may tag broadly ("this might be avoidance").
 * Surfacing requires a more conservative reading: enough independent,
 * sufficiently confident votes, with the pattern as a primary reading
 * often enough that the same recurring pattern is justified.
 *
 * Pure + local — no LLM. Fail closed on weak / secondary-only stacks.
 */

import type { PatternEvidenceItem } from "@/lib/patterns/types";
import {
  SURFACE_MIN_ENTRIES,
  SURFACE_MIN_PRIMARY_ENTRIES,
  SURFACE_VOTE_MIN_CONFIDENCE,
  type PatternName,
} from "@/lib/patterns/vocabulary-public";

/** One entry's contribution while deciding whether a pattern may surface. */
export type RecurrenceVote = {
  item: PatternEvidenceItem;
  /** True when this pattern tied for highest confidence on that entry. */
  isPrimary: boolean;
};

export type RecurrenceDecision = {
  name: PatternName;
  surfaced: boolean;
  reason:
    | "surfaced"
    | "insufficient_entry_tags"
    | "insufficient_strong_votes"
    | "insufficient_primary_votes";
  /** All entry tags collected for this pattern name (pre-gates). */
  totalTags: number;
  /** Tags with confidence ≥ SURFACE_VOTE_MIN_CONFIDENCE. */
  strongVotes: number;
  /** Strong votes that were primary on their entry. */
  primaryVotes: number;
  meanStrongConfidence: number;
  thresholds: {
    minEntries: number;
    minStrongConfidence: number;
    minPrimaryEntries: number;
  };
};

const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

/**
 * Decide whether a pattern's cross-entry votes justify surfacing.
 * Returns the evidence items that should appear on the card when surfaced
 * (strong votes only — weak tags stay at entry level).
 */
export function decidePatternRecurrence(
  name: PatternName,
  votes: RecurrenceVote[],
): { decision: RecurrenceDecision; evidence: PatternEvidenceItem[] } {
  const thresholds = {
    minEntries: SURFACE_MIN_ENTRIES,
    minStrongConfidence: SURFACE_VOTE_MIN_CONFIDENCE,
    minPrimaryEntries: SURFACE_MIN_PRIMARY_ENTRIES,
  };

  const strong = votes.filter(
    (vote) => vote.item.confidence >= SURFACE_VOTE_MIN_CONFIDENCE,
  );
  const primaryStrong = strong.filter((vote) => vote.isPrimary);
  const meanStrongConfidence = mean(strong.map((vote) => vote.item.confidence));

  const base = {
    name,
    totalTags: votes.length,
    strongVotes: strong.length,
    primaryVotes: primaryStrong.length,
    meanStrongConfidence,
    thresholds,
  };

  if (votes.length < SURFACE_MIN_ENTRIES) {
    return {
      decision: {
        ...base,
        surfaced: false,
        reason: "insufficient_entry_tags",
      },
      evidence: [],
    };
  }

  if (strong.length < SURFACE_MIN_ENTRIES) {
    return {
      decision: {
        ...base,
        surfaced: false,
        reason: "insufficient_strong_votes",
      },
      evidence: [],
    };
  }

  if (primaryStrong.length < SURFACE_MIN_PRIMARY_ENTRIES) {
    return {
      decision: {
        ...base,
        surfaced: false,
        reason: "insufficient_primary_votes",
      },
      evidence: [],
    };
  }

  const evidence = strong
    .map((vote) => vote.item)
    .sort(
      (a, b) =>
        (b.sealedAt ?? b.lastEditedAt ?? b.createdAt) -
        (a.sealedAt ?? a.lastEditedAt ?? a.createdAt),
    );

  return {
    decision: {
      ...base,
      surfaced: true,
      reason: "surfaced",
    },
    evidence,
  };
}

/** Concise console line for testing / debug. */
export function logRecurrenceDecision(decision: RecurrenceDecision): void {
  const {
    name,
    surfaced,
    reason,
    totalTags,
    strongVotes,
    primaryVotes,
    meanStrongConfidence,
    thresholds,
  } = decision;
  const summary = [
    `pattern=${name}`,
    `surfaced=${surfaced}`,
    `reason=${reason}`,
    `tags=${totalTags}`,
    `strong=${strongVotes}/${thresholds.minEntries}(≥${thresholds.minStrongConfidence})`,
    `primary=${primaryVotes}/${thresholds.minPrimaryEntries}`,
    `meanStrong=${meanStrongConfidence.toFixed(2)}`,
  ].join(" ");
  console.info(`[pattern-aggregate] ${summary}`);
}
