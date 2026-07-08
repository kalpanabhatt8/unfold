/**
 * Unfold — deterministic evidence signals for the planner.
 *
 * Extracts pair/echo candidates, builds the evidence fingerprint (regeneration
 * trigger), and selects quotes via a deterministic confidence + recency blend.
 * The highest-confidence quote is always pinned; remaining slots rank by score.
 */

import {
  PAIR_MIN_GAP_DAYS,
  QUOTE_CONFIDENCE_WEIGHT,
  QUOTE_RECENCY_WEIGHT,
  QUOTE_SELECTION_HALF_LIFE_DAYS,
} from "@/lib/patterns/lifecycle-config";
import type { Lifecycle } from "@/lib/patterns/pattern-state";
import type { PatternEvidenceItem } from "@/lib/patterns/types";

const DAY_MS = 86_400_000;

/** Max quotes surfaced in a passage. */
export const MAX_PASSAGE_QUOTES = 8;

const ECHO_MIN_TOKEN_LEN = 4;
const ECHO_MIN_ENTRIES = 2;

export type QuoteRef = {
  entryId: string;
  entryTitle: string;
  text: string;
  confidence: number;
  anchorTs: number;
};

export type EvidenceSignals = {
  selectedQuotes: QuoteRef[];
  hasPair: boolean;
  pair: [QuoteRef, QuoteRef] | null;
  hasEcho: boolean;
  echo: { phrase: string; quotes: QuoteRef[] } | null;
};

const anchorTs = (item: PatternEvidenceItem): number =>
  item.sealedAt ?? item.lastEditedAt ?? item.createdAt;

const daysBetween = (a: number, b: number): number => Math.abs(a - b) / DAY_MS;

const recencyWeight = (anchorTs: number, now: number): number =>
  0.5 ** (daysBetween(now, anchorTs) / QUOTE_SELECTION_HALF_LIFE_DAYS);

const quoteScore = (quote: QuoteRef, now: number): number =>
  QUOTE_CONFIDENCE_WEIGHT * quote.confidence +
  QUOTE_RECENCY_WEIGHT * recencyWeight(quote.anchorTs, now);

/** Fingerprint for regeneration — changes on new/deleted entry or confidence/quote change. */
export function buildEvidenceKey(evidence: PatternEvidenceItem[]): string {
  return [...evidence]
    .sort((a, b) => a.entryId.localeCompare(b.entryId))
    .map(
      (e) =>
        `${e.entryId}:${e.confidence}:${[...e.quotes].sort().join("\x1f")}`,
    )
    .join("|");
}

/**
 * Select quotes: pin the highest-confidence quote, fill remaining slots by
 * confidence + recency blend. Deterministic tiebreaks.
 */
export function selectQuotes(
  evidence: PatternEvidenceItem[],
  now: number,
): QuoteRef[] {
  const refs: QuoteRef[] = [];
  for (const item of evidence) {
    const ts = anchorTs(item);
    for (const text of item.quotes) {
      refs.push({
        entryId: item.entryId,
        entryTitle: item.entryTitle,
        text,
        confidence: item.confidence,
        anchorTs: ts,
      });
    }
  }

  if (refs.length === 0) return [];

  const pin = [...refs].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.anchorTs !== a.anchorTs) return b.anchorTs - a.anchorTs;
    if (a.entryId !== b.entryId) return a.entryId.localeCompare(b.entryId);
    return a.text.localeCompare(b.text);
  })[0];

  const rest = refs
    .filter(
      (q) =>
        !(
          q.entryId === pin.entryId &&
          q.text === pin.text &&
          q.anchorTs === pin.anchorTs
        ),
    )
    .sort((a, b) => {
      const scoreDiff = quoteScore(b, now) - quoteScore(a, now);
      if (scoreDiff !== 0) return scoreDiff;
      if (a.entryId !== b.entryId) return a.entryId.localeCompare(b.entryId);
      return a.text.localeCompare(b.text);
    });

  return [pin, ...rest].slice(0, MAX_PASSAGE_QUOTES);
}

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= ECHO_MIN_TOKEN_LEN);

function findEcho(
  quotes: QuoteRef[],
): { phrase: string; quotes: QuoteRef[] } | null {
  const byToken = new Map<string, Map<string, QuoteRef>>();

  for (const quote of quotes) {
    const seen = new Set<string>();
    for (const token of tokenize(quote.text)) {
      if (seen.has(token)) continue;
      seen.add(token);
      let entries = byToken.get(token);
      if (!entries) {
        entries = new Map();
        byToken.set(token, entries);
      }
      if (!entries.has(quote.entryId)) entries.set(quote.entryId, quote);
    }
  }

  let best: { phrase: string; quotes: QuoteRef[] } | null = null;
  for (const [phrase, entries] of byToken) {
    if (entries.size < ECHO_MIN_ENTRIES) continue;
    const group = [...entries.values()].sort(
      (a, b) => a.anchorTs - b.anchorTs,
    );
    if (!best || group.length > best.quotes.length) {
      best = { phrase, quotes: group };
    }
  }
  return best;
}

type PairCandidate = { pair: [QuoteRef, QuoteRef]; gapDays: number };

/**
 * Best pair above PAIR_MIN_GAP. Returning lifecycle prefers the largest gap;
 * otherwise the smallest gap above the floor (recent contrast).
 */
function findPair(
  quotes: QuoteRef[],
  lifecycle: Lifecycle,
): [QuoteRef, QuoteRef] | null {
  const byEntry = new Map<string, QuoteRef>();
  for (const q of quotes) {
    const existing = byEntry.get(q.entryId);
    if (!existing || q.confidence > existing.confidence) byEntry.set(q.entryId, q);
  }

  const perEntry = [...byEntry.values()].sort((a, b) => a.anchorTs - b.anchorTs);
  if (perEntry.length < 2) return null;

  const candidates: PairCandidate[] = [];
  for (let i = 0; i < perEntry.length; i += 1) {
    for (let j = i + 1; j < perEntry.length; j += 1) {
      const gapDays = daysBetween(perEntry[j].anchorTs, perEntry[i].anchorTs);
      if (gapDays >= PAIR_MIN_GAP_DAYS) {
        candidates.push({ pair: [perEntry[i], perEntry[j]], gapDays });
      }
    }
  }

  if (candidates.length === 0) return null;

  if (lifecycle === "returning") {
    return candidates.reduce((best, c) =>
      c.gapDays > best.gapDays ? c : best,
    ).pair;
  }

  return candidates.reduce((best, c) =>
    c.gapDays < best.gapDays ? c : best,
  ).pair;
}

export function deriveEvidenceSignals(
  evidence: PatternEvidenceItem[],
  lifecycle: Lifecycle,
  now: number,
): EvidenceSignals {
  const selectedQuotes = selectQuotes(evidence, now);
  const echo = findEcho(selectedQuotes);
  const pair = findPair(selectedQuotes, lifecycle);

  return {
    selectedQuotes,
    hasPair: pair !== null,
    pair,
    hasEcho: echo !== null,
    echo,
  };
}

/** Latest analyzed-entry anchor across all evidence-bearing entries. */
export function deriveGlobalActivityAt(
  evidenceLists: PatternEvidenceItem[][],
): number {
  let latest = 0;
  for (const evidence of evidenceLists) {
    for (const item of evidence) {
      const ts = anchorTs(item);
      if (ts > latest) latest = ts;
    }
  }
  return latest;
}
