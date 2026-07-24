import { EXTRACTION_MAX_EVIDENCE_CHARS } from "@/lib/ai/pattern-extraction/constants";
import { reconcilePatterns } from "@/lib/patterns/arbitration";
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

type SentenceSpan = {
  /** Inclusive start index into sourceText. */
  start: number;
  /** Exclusive end index into sourceText. */
  end: number;
};

/**
 * Split on `.` / `!` / `?` followed by whitespace or end-of-string.
 * Keeps punctuation with the sentence; does not special-case abbreviations.
 */
export function splitSentences(sourceText: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  let i = 0;
  while (i < sourceText.length && /\s/.test(sourceText[i]!)) i += 1;
  let sentenceStart = i;

  while (i < sourceText.length) {
    const ch = sourceText[i]!;
    if (ch === "." || ch === "!" || ch === "?") {
      const next = sourceText[i + 1];
      if (next === undefined || /\s/.test(next)) {
        let end = i + 1;
        while (
          end < sourceText.length &&
          (sourceText[end] === "." ||
            sourceText[end] === "!" ||
            sourceText[end] === "?")
        ) {
          end += 1;
        }
        if (end > sentenceStart) {
          spans.push({ start: sentenceStart, end });
        }
        i = end;
        while (i < sourceText.length && /\s/.test(sourceText[i]!)) i += 1;
        sentenceStart = i;
        continue;
      }
    }
    i += 1;
  }

  if (sentenceStart < sourceText.length) {
    let end = sourceText.length;
    while (end > sentenceStart && /\s/.test(sourceText[end - 1]!)) end -= 1;
    if (end > sentenceStart) {
      spans.push({ start: sentenceStart, end });
    }
  }

  return spans;
}

/** Truncate at the last whitespace before `maxChars` — never mid-word. */
export function truncateAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const hard = text.slice(0, maxChars);
  const lastSpace = hard.lastIndexOf(" ");
  if (lastSpace > 0) return hard.slice(0, lastSpace).trimEnd();
  return hard.trimEnd();
}

/**
 * Prefer the first comma-separated clause when a sentence exceeds the cap;
 * otherwise word-boundary truncate.
 */
export function fitEvidenceQuote(expanded: string, maxChars: number): string {
  if (expanded.length <= maxChars) return expanded;

  const comma = expanded.indexOf(",");
  if (comma !== -1) {
    const firstClause = expanded.slice(0, comma).trim();
    if (firstClause.length > 0 && firstClause.length <= maxChars) {
      return firstClause;
    }
  }

  return truncateAtWordBoundary(expanded, maxChars);
}

/**
 * Expand an LLM evidence span to the full sentence(s) it falls in, then
 * apply the evidence char cap without mid-word cuts.
 * Returns null when the span is not a verbatim substring of the source.
 */
export function normalizeEvidenceQuote(
  quote: string,
  sourceText: string,
  maxChars: number = EXTRACTION_MAX_EVIDENCE_CHARS,
): string | null {
  const trimmed = quote.trim();
  if (!trimmed) return null;

  const lowerSource = sourceText.toLowerCase();
  const lowerQuote = trimmed.toLowerCase();
  const quoteStart = lowerSource.indexOf(lowerQuote);
  if (quoteStart === -1) return null;

  const quoteEnd = quoteStart + lowerQuote.length;
  const sentences = splitSentences(sourceText);
  const overlapping = sentences.filter(
    (span) => span.start < quoteEnd && span.end > quoteStart,
  );

  const expanded =
    overlapping.length > 0
      ? sourceText
          .slice(overlapping[0]!.start, overlapping[overlapping.length - 1]!.end)
          .trim()
      : sourceText.slice(quoteStart, quoteEnd);

  if (!expanded) return null;
  const fitted = fitEvidenceQuote(expanded, maxChars).trim();
  return fitted || null;
}

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
          .map((q) => normalizeEvidenceQuote(q, sourceText))
          .filter((q): q is string => q !== null)
          .slice(0, MAX_EVIDENCE_PER_PATTERN)
      : [];

    if (evidence.length === 0) continue;

    seen.add(item.name);
    patterns.push({ name: item.name, confidence, evidence });
  }

  patterns.sort((a, b) => b.confidence - a.confidence);

  // Pairwise arbitration re-ranks/drops by POLICY (see arbitration.ts) — must
  // run after the confidence sort and must NOT be followed by another sort.
  const { patterns: reconciled } = reconcilePatterns(patterns);

  return {
    topics,
    patterns: reconciled.slice(0, MAX_PATTERNS_PER_ENTRY),
  };
}
