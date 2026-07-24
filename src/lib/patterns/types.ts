/**
 * Unfold — entry analysis + aggregation types (V1, minimal).
 */

import type { PatternName } from "@/lib/patterns/vocabulary";

/** A single detected pattern within one entry. */
export type PatternMatch = {
  name: PatternName;
  confidence: number; // 0..1
  evidence: string[]; // 1–2 verbatim quotes from the entry
};

/** The semantic payload returned by the analysis route. */
export type AnalysisPayload = {
  topics: string[]; // 1–2
  patterns: PatternMatch[]; // 0–3
};

/** What we persist per completed entry (minimal V1 shape). */
export type EntryAnalysis = {
  entryId: string;
  /** Fingerprint of the text this analysis was generated from — when the
   * entry's current hash drifts, the analysis is stale and may re-run. */
  sourceContentHash?: string;
} & AnalysisPayload;

/** What fired the completion trigger. Wiring-only; not persisted. */
export type CompletionSource = "seal" | "inactivity";

/** Analysis route response — success carries a payload, failure carries a reason. */
export type EntryAnalysisFailureReason =
  | "no_api_key"
  | "upstream_error"
  | "empty_response"
  | "invalid_output";

export type EntryAnalysisResult =
  | { analysis: AnalysisPayload }
  | { analysis: null; reason: EntryAnalysisFailureReason };

/** One entry's contribution to a surfaced pattern. */
export type PatternEvidenceItem = {
  entryId: string;
  /** Canvas stamp title — gives drawer quotes context. */
  entryTitle: string;
  createdAt: number;
  sealedAt?: number;
  /** Last content edit — used as the date anchor when the entry is not sealed. */
  lastEditedAt?: number;
  quotes: string[];
  confidence: number;
};

/** Landing-page identity for a surfaced pattern — independent of guided passage. */
export type PatternDisplay = {
  displayTitle: string;
  summary: string | null;
  sourceEvidenceKey: string;
  createdAt: number;
};

/** Folded secondary — retained on the survivor, not deleted from the model. */
export type RelatedPatternRef = {
  name: PatternName;
  label: string;
};

/** A pattern that crossed the surfacing threshold, with its evidence. */
export type SurfacedPattern = {
  name: PatternName;
  /** Distinct entries exhibiting the pattern. */
  entryCount: number;
  evidence: PatternEvidenceItem[];
  /** e.g. "usually late evening" — null when timing is mixed. */
  timeHint: string | null;
  /** Human labels — moderate co-occurrence, pattern still distinct. */
  coPatterns: string[];
  /** Human labels — overlap-folded secondaries (mirrors relatedPatterns labels). */
  foldedLabels: string[];
  /** Overlap-suppressed slugs — retained for debug / generation survivors-only. */
  suppressedPatterns: PatternName[];
  /**
   * Folded secondaries kept as references on the survivor card
   * ("also shows up in: …"). Empty when nothing was folded.
   */
  relatedPatterns: RelatedPatternRef[];
  /** Landing card copy — populated async; independent of PatternPassage. */
  display: PatternDisplay | null;
};

/** The full aggregate the Patterns page renders. */
export type PatternsAggregate = {
  analyzedEntryCount: number;
  surfaced: SurfacedPattern[];
};
