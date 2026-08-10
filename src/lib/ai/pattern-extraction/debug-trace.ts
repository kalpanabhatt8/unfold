/**
 * TEMPORARY — pattern pipeline debug tracing.
 * Delete after the extraction/aggregation experiment.
 *
 * Rebuilds validation/arbitration steps for inspection without changing
 * validateExtraction's product behavior.
 */

import "server-only";

import { EXTRACTION_MODEL } from "@/lib/ai/pattern-extraction/constants";
import type {
  ExtractionDebugTrace,
  PatternDecisionDebug,
} from "@/lib/ai/pattern-extraction/debug-types";
import { collectNormalizedEvidence } from "@/lib/ai/pattern-extraction/validation";
import { reconcilePatterns } from "@/lib/patterns/arbitration";
import type { PatternMatch } from "@/lib/patterns/types";
import {
  isPatternName,
  MAX_PATTERNS_PER_ENTRY,
  MAX_TOPICS_PER_ENTRY,
  PATTERN_CONFIDENCE_FLOOR,
} from "@/lib/patterns/vocabulary";

export type {
  ExtractionDebugTrace,
  PatternDecisionDebug,
} from "@/lib/ai/pattern-extraction/debug-types";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/**
 * Walk parsed extraction the same way validateExtraction does, but keep
 * rejected candidates + arbitration actions for the debug UI.
 */
export function buildExtractionDebugTrace(args: {
  rawResponse: string;
  parsed: unknown | null;
  sourceText: string;
  model?: string;
}): ExtractionDebugTrace {
  const model = args.model ?? EXTRACTION_MODEL;
  const base: ExtractionDebugTrace = {
    model,
    rawLLM: { available: true, response: args.rawResponse },
    parsedExtraction: { available: false },
    validation: { accepted: [], rejected: [], reasons: [] },
    arbitration: { before: [], after: [], changes: [] },
    validatedPayload: null,
  };

  if (args.parsed === null) {
    base.parsedExtraction = {
      available: false,
      parseError: "parseExtractionResponse returned null",
    };
    base.validation.reasons.push("parsing_error");
    return base;
  }

  if (!isRecord(args.parsed) || !Array.isArray(args.parsed.patterns)) {
    base.parsedExtraction = {
      available: true,
      topics: isRecord(args.parsed) ? args.parsed.topics : undefined,
      patterns: isRecord(args.parsed) ? args.parsed.patterns : undefined,
      parseError: "missing patterns array",
    };
    base.validation.reasons.push("invalid_structure");
    return base;
  }

  base.parsedExtraction = {
    available: true,
    topics: args.parsed.topics,
    patterns: args.parsed.patterns,
  };

  const topics = Array.isArray(args.parsed.topics)
    ? args.parsed.topics
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, MAX_TOPICS_PER_ENTRY)
    : [];

  const seen = new Set<string>();
  const accepted: PatternMatch[] = [];
  const rejected: PatternDecisionDebug[] = [];
  const reasons: string[] = [];

  for (const item of args.parsed.patterns) {
    if (!isRecord(item)) {
      rejected.push({
        name: undefined,
        confidence: undefined,
        evidence: undefined,
        validation: { accepted: false, rejectionReason: "not_an_object" },
      });
      reasons.push("not_an_object");
      continue;
    }

    const decision: PatternDecisionDebug = {
      name: item.name,
      confidence: item.confidence,
      evidence: item.evidence,
      validation: { accepted: false, rejectionReason: null },
    };

    if (!isPatternName(item.name)) {
      decision.validation.rejectionReason = "unknown_pattern_name";
      rejected.push(decision);
      reasons.push("unknown_pattern_name");
      continue;
    }
    if (seen.has(item.name)) {
      decision.validation.rejectionReason = "duplicate_pattern_name";
      rejected.push(decision);
      reasons.push("duplicate_pattern_name");
      continue;
    }

    const confidence =
      typeof item.confidence === "number" && Number.isFinite(item.confidence)
        ? Math.min(1, Math.max(0, item.confidence))
        : 0;
    if (confidence < PATTERN_CONFIDENCE_FLOOR) {
      decision.validation.rejectionReason = `below_confidence_floor_${PATTERN_CONFIDENCE_FLOOR}`;
      rejected.push(decision);
      reasons.push("below_confidence_floor");
      continue;
    }

    const evidence = collectNormalizedEvidence(item.evidence, args.sourceText);

    if (evidence.length === 0) {
      decision.validation.rejectionReason = "no_verbatim_evidence";
      rejected.push(decision);
      reasons.push("no_verbatim_evidence");
      continue;
    }

    seen.add(item.name);
    decision.validation = {
      accepted: true,
      rejectionReason: null,
      normalizedEvidence: evidence,
    };
    accepted.push({ name: item.name, confidence, evidence });
  }

  accepted.sort((a, b) => b.confidence - a.confidence);
  const { patterns: reconciled, actions } = reconcilePatterns(accepted);
  const sliced = reconciled.slice(0, MAX_PATTERNS_PER_ENTRY);

  base.validation = { accepted, rejected, reasons: [...new Set(reasons)] };
  base.arbitration = {
    before: accepted,
    after: sliced,
    changes: actions,
  };
  base.validatedPayload = { topics, patterns: sliced };
  return base;
}
