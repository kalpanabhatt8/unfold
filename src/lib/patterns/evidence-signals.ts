/**
 * Unfold — deterministic evidence signals for the planner.
 *
 * Extracts pair/echo candidates, builds the evidence fingerprint (regeneration
 * trigger), and selects quotes by inner-experience strength — moments where
 * the user reveals what it felt like from the inside — not keyword confidence.
 * Entry diversity and near-duplicate filtering keep the 5–7 surfaced quotes
 * distinct and each revealing a different part of the pattern.
 */

import {
  PAIR_MIN_GAP_DAYS,
  QUOTE_SELECTION_HALF_LIFE_DAYS,
} from "@/lib/patterns/lifecycle-config";
import { voiceLinesEcho } from "@/lib/patterns/passage-fill";
import type { Lifecycle } from "@/lib/patterns/pattern-state";
import type { PatternEvidenceItem } from "@/lib/patterns/types";

const DAY_MS = 86_400_000;

/** Max quotes surfaced in a passage — only the strongest moments. */
export const MAX_PASSAGE_QUOTES = 7;

const ECHO_MIN_TOKEN_LEN = 4;
const ECHO_MIN_ENTRIES = 2;

/**
 * Common words that recur in journals without being a meaningful artifact.
 * A closing "phrase" beat must be distinctive — not "kept", "written", etc.
 */
const ECHO_STOPWORDS = new Set([
  "about", "after", "again", "being", "could", "doing", "every", "first",
  "going", "have", "just", "keep", "kept", "know", "like", "made", "make",
  "more", "much", "need", "never", "only", "other", "over", "same", "should",
  "something", "still", "than", "that", "their", "then", "there", "these",
  "they", "thing", "this", "those", "through", "very", "want", "was", "were",
  "what", "when", "where", "which", "while", "with", "would", "write",
  "writing", "written", "your", "really", "actually", "already", "always",
  "because", "before", "between", "around", "almost", "another", "anything",
]);

export const isDistinctiveEchoPhrase = (phrase: string): boolean => {
  const normalized = phrase.trim().toLowerCase();
  if (!normalized) return false;
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.some((p) => p.length >= ECHO_MIN_TOKEN_LEN && !ECHO_STOPWORDS.has(p));
  }
  if (normalized.length < 5) return false;
  return !ECHO_STOPWORDS.has(normalized);
};

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

/** Interior voice — felt experience, tension, self-reflection. */
const INTERIOR_MARKERS =
  /\b(felt|feeling|feel like|feels like|somehow|quietly|told myself|realized|meant to|supposed to|actually|still (?:waiting|there|stuck|sitting|un)?|never (?:moved|started|sent|finished|got)|nothing (?:actually|really)|even though|although|instead of|rather than|but nothing|learning something|good enough|not ready|too (?:big|much|hard|overwhelming)|easier|harder|stuck|relief|guilty|productive|empty|dread|anxious|overwhelm|restless|numb|avoiding|wondering|noticed|knew|thought)\b/i;

/** Surface activity without inner frame. */
const SURFACE_ACTIVITY =
  /\b(watched|opened|clicked|cleaned|organized|refreshed|scrolled|checked|went to|finished|made|sent|read|looked at|browsed|replied to|updated|fixed|renamed|deployed|committed|pushed|pulled|installed|downloaded|uploaded|videos?|emails?|tabs?)\b/i;

const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

/**
 * Rank how much a quote reveals inner experience vs surface activity.
 * Prefer "It felt productive but nothing changed" over "I watched three videos."
 */
export function innerExperienceScore(text: string): number {
  const t = text.trim();
  if (!t) return 0;

  let score = 0;
  const words = wordCount(t);
  const hasInterior =
    INTERIOR_MARKERS.test(t) ||
    /\bI (?:felt|feel|kept telling|told|realized|thought|knew|noticed|wondered)\b/i.test(
      t,
    );

  if (hasInterior) score += 1.2;

  if (/\bbut\b/i.test(t) && words >= 8) score += 0.45;
  if (/\b(yet|although|even though|instead)\b/i.test(t)) score += 0.35;

  if (
    /\b(?:productive|busy|active|progress|learning)\b/i.test(t) &&
    /\b(?:but|yet|nothing|never|still|didn't|without)\b/i.test(t)
  ) {
    score += 0.5;
  }

  if (SURFACE_ACTIVITY.test(t) && !hasInterior) score -= 0.7;

  if (
    /\b(?:one|two|three|four|five|six|\d+)\s+\w+/i.test(t) &&
    words <= 12 &&
    !hasInterior
  ) {
    score -= 0.55;
  }

  if (words <= 5 && !hasInterior) score -= 0.35;
  if (words >= 10 && hasInterior) score += 0.15;
  if (words >= 16 && hasInterior) score += 0.1;

  return score;
}

/** Experiential rank first; recency and entry confidence are tiebreakers only. */
const quoteRankScore = (quote: QuoteRef, now: number): number =>
  innerExperienceScore(quote.text) +
  recencyWeight(quote.anchorTs, now) * 0.2 +
  quote.confidence * 0.1;

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
 * Select quotes: pin the strongest inner-experience moment, then fill to
 * MAX_PASSAGE_QUOTES with:
 *
 *  1. Entry diversity — one quote per entry until every entry is represented.
 *  2. No near-duplicates — skip quotes that mostly repeat an already-selected one.
 *
 * Ranking prioritizes felt experience over keyword confidence or recency.
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

  const compareQuotes = (a: QuoteRef, b: QuoteRef): number => {
    const expDiff = innerExperienceScore(b.text) - innerExperienceScore(a.text);
    if (expDiff !== 0) return expDiff;
    const rankDiff = quoteRankScore(b, now) - quoteRankScore(a, now);
    if (rankDiff !== 0) return rankDiff;
    if (b.anchorTs !== a.anchorTs) return b.anchorTs - a.anchorTs;
    if (a.entryId !== b.entryId) return a.entryId.localeCompare(b.entryId);
    return a.text.localeCompare(b.text);
  };

  const pin = [...refs].sort(compareQuotes)[0];

  const ranked = refs
    .filter(
      (q) =>
        !(
          q.entryId === pin.entryId &&
          q.text === pin.text &&
          q.anchorTs === pin.anchorTs
        ),
    )
    .sort(compareQuotes);

  const selected: QuoteRef[] = [pin];
  const isNearDuplicate = (q: QuoteRef): boolean =>
    selected.some((s) => voiceLinesEcho(s.text, q.text));

  // Pass 1: strongest quote from each not-yet-represented entry.
  const seenEntries = new Set([pin.entryId]);
  for (const q of ranked) {
    if (selected.length >= MAX_PASSAGE_QUOTES) break;
    if (seenEntries.has(q.entryId)) continue;
    if (isNearDuplicate(q)) continue;
    selected.push(q);
    seenEntries.add(q.entryId);
  }

  // Pass 2: fill remaining slots with the next-strongest distinct quotes.
  for (const q of ranked) {
    if (selected.length >= MAX_PASSAGE_QUOTES) break;
    if (selected.includes(q)) continue;
    if (isNearDuplicate(q)) continue;
    selected.push(q);
  }

  return selected;
}

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= ECHO_MIN_TOKEN_LEN);

/** Prefer recurring multi-word phrases; fall back to distinctive single tokens. */
function findEcho(
  quotes: QuoteRef[],
): { phrase: string; quotes: QuoteRef[] } | null {
  const byPhrase = new Map<string, Map<string, QuoteRef>>();

  const add = (phrase: string, quote: QuoteRef) => {
    if (!isDistinctiveEchoPhrase(phrase)) return;
    let entries = byPhrase.get(phrase);
    if (!entries) {
      entries = new Map();
      byPhrase.set(phrase, entries);
    }
    if (!entries.has(quote.entryId)) entries.set(quote.entryId, quote);
  };

  for (const quote of quotes) {
    const tokens = tokenize(quote.text);
    const seen = new Set<string>();
    for (let i = 0; i < tokens.length; i += 1) {
      const unigram = tokens[i];
      if (!seen.has(unigram)) {
        seen.add(unigram);
        add(unigram, quote);
      }
      if (i + 1 < tokens.length) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        if (!seen.has(bigram)) {
          seen.add(bigram);
          add(bigram, quote);
        }
      }
    }
  }

  let best: { phrase: string; quotes: QuoteRef[]; score: number } | null = null;
  for (const [phrase, entries] of byPhrase) {
    if (entries.size < ECHO_MIN_ENTRIES) continue;
    const group = [...entries.values()].sort(
      (a, b) => a.anchorTs - b.anchorTs,
    );
    const words = phrase.split(/\s+/).length;
    // Prefer multi-word phrases, then wider entry coverage.
    const score = words * 10 + group.length;
    if (!best || score > best.score) {
      best = { phrase, quotes: group, score };
    }
  }
  return best ? { phrase: best.phrase, quotes: best.quotes } : null;
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
