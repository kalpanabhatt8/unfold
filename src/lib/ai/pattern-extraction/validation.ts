import { EXTRACTION_MAX_EVIDENCE_CHARS } from "@/lib/ai/pattern-extraction/constants";
import {
  isPatternName,
  MAX_EVIDENCE_PER_PATTERN,
  MAX_PATTERNS_PER_ENTRY,
  MAX_TOPICS_PER_ENTRY,
  PATTERN_CONFIDENCE_FLOOR,
} from "@/lib/patterns/vocabulary";
import type { AnalysisPayload, PatternMatch } from "@/lib/patterns/types";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/**
 * Validate and normalize extraction output — schema + verbatim evidence only.
 * Returns null when structurally unusable (caller retries later).
 */
export function validateExtraction(
  raw: unknown,
  sourceText: string,
): AnalysisPayload | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.patterns)) return null;

  const topics = Array.isArray(raw.topics)
    ? raw.topics
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, MAX_TOPICS_PER_ENTRY)
    : [];

  const lowerSource = sourceText.toLowerCase();
  const seen = new Set<string>();
  const patterns: PatternMatch[] = [];

  for (const item of raw.patterns) {
    if (!isRecord(item)) continue;
    if (!isPatternName(item.name) || seen.has(item.name)) continue;

    const confidence =
      typeof item.confidence === "number" && Number.isFinite(item.confidence)
        ? Math.min(1, Math.max(0, item.confidence))
        : 0;
    if (confidence < PATTERN_CONFIDENCE_FLOOR) continue;

    const evidence = Array.isArray(item.evidence)
      ? item.evidence
          .filter((q): q is string => typeof q === "string")
          .map((q) => q.trim())
          .filter((q) => q && lowerSource.includes(q.toLowerCase()))
          .map((q) =>
            q.length > EXTRACTION_MAX_EVIDENCE_CHARS
              ? q.slice(0, EXTRACTION_MAX_EVIDENCE_CHARS).trim()
              : q,
          )
          .slice(0, MAX_EVIDENCE_PER_PATTERN)
      : [];

    if (evidence.length === 0) continue;

    seen.add(item.name);
    patterns.push({ name: item.name, confidence, evidence });
  }

  patterns.sort((a, b) => b.confidence - a.confidence);

  return {
    topics,
    patterns: patterns.slice(0, MAX_PATTERNS_PER_ENTRY),
  };
}
