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
} & AnalysisPayload;

/** What fired the completion trigger. Wiring-only; not persisted. */
export type CompletionSource =
  | "seal"
  | "inactivity"
  | "leave"
  | "open_other"
  | "manual";

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

/** LLM-generated cross-entry insight for a surfaced pattern. */
export type PatternInsight = {
  /** Specific second-person observation for the card headline. */
  observation: string;
  /** One sentence explaining what the evidence entries share. */
  commonThread: string;
};

/** A pattern that crossed the surfacing threshold, with its evidence. */
export type SurfacedPattern = {
  name: PatternName;
  /** Distinct entries exhibiting the pattern. */
  entryCount: number;
  evidence: PatternEvidenceItem[];
  /** e.g. "usually late evening" — null when timing is mixed. */
  timeHint: string | null;
  /** Human labels for patterns that often appear in the same entries. */
  coPatterns: string[];
  /** Populated async after aggregation; null while loading or unavailable. */
  insight: PatternInsight | null;
};

/** The full aggregate the Patterns page renders. */
export type PatternsAggregate = {
  analyzedEntryCount: number;
  surfaced: SurfacedPattern[];
};
