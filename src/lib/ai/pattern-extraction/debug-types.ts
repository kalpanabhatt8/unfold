/**
 * Client-safe shapes for extraction debug traces.
 * Builders that run validation/arbitration live in debug-trace.ts (server-only).
 */

import type { ArbitrationAction } from "@/lib/patterns/arbitration-types";
import type { AnalysisPayload, PatternMatch } from "@/lib/patterns/types";

export type PatternDecisionDebug = {
  name: unknown;
  confidence: unknown;
  evidence: unknown;
  validation: {
    accepted: boolean;
    rejectionReason: string | null;
    normalizedEvidence?: string[];
  };
};

export type ExtractionDebugTrace = {
  model: string;
  rawLLM: {
    available: true;
    response: string;
  };
  parsedExtraction: {
    available: boolean;
    topics?: unknown;
    patterns?: unknown;
    parseError?: string;
  };
  validation: {
    accepted: PatternMatch[];
    rejected: PatternDecisionDebug[];
    reasons: string[];
  };
  arbitration: {
    before: PatternMatch[];
    after: PatternMatch[];
    changes: ArbitrationAction[];
  };
  /** Same shape validateExtraction would return (pre-persist). */
  validatedPayload: AnalysisPayload | null;
};
