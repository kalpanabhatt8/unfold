/**
 * Pick the single strongest closing signal for a pattern reading.
 *
 * Priority (first genuine hit wins):
 *   1. Silence — a thread that stopped (meaningful gap in the trail)
 *   2. Drift — early phrasing vs most recent, side by side
 *   3. Recurring phrase — the user's own repeated word/phrase
 *   4. Mechanism — sequential reconstruction of the loop
 *   5. None — moments only
 *
 * Reflection questions are separate and optional (see hasOpenQuestion).
 */

import type {
  EvidenceSignals,
  QuoteRef,
} from "@/lib/patterns/evidence-signals";
import { isDistinctiveEchoPhrase } from "@/lib/patterns/evidence-signals";
import { PAIR_MIN_GAP_DAYS } from "@/lib/patterns/lifecycle-config";

const DAY_MS = 86_400_000;

/** Minimum quiet span that reads as a stopped thread. */
export const SILENCE_MIN_DAYS = 5;

export type ClosingSignalKind =
  | "silence"
  | "drift"
  | "phrase"
  | "mechanism"
  | "none";

export type ClosingSignal =
  | {
      kind: "silence";
      /** Deterministic line, e.g. "then, for six days: nothing" */
      text: string;
      gapDays: number;
    }
  | {
      kind: "drift";
      early: QuoteRef;
      recent: QuoteRef;
    }
  | {
      kind: "phrase";
      phrase: string;
      quotes: QuoteRef[];
    }
  | { kind: "mechanism" }
  | { kind: "none" };

const daysBetween = (a: number, b: number): number =>
  Math.abs(a - b) / DAY_MS;

const sortChronological = (quotes: QuoteRef[]): QuoteRef[] =>
  [...quotes].sort((a, b) => {
    if (a.anchorTs !== b.anchorTs) return a.anchorTs - b.anchorTs;
    return a.entryId.localeCompare(b.entryId);
  });

/** Format an integer day gap into the silence line. */
export const formatSilenceLine = (gapDays: number): string => {
  const n = Math.max(1, Math.round(gapDays));
  if (n === 1) return "then, for a day: nothing";
  return `then, for ${n} days: nothing`;
};

/**
 * Largest chronological gap between consecutive selected quotes.
 * Returns null when no gap clears SILENCE_MIN_DAYS.
 */
export function findSilenceGap(
  quotes: QuoteRef[],
): { gapDays: number; after: QuoteRef; before: QuoteRef } | null {
  const sorted = sortChronological(quotes);
  if (sorted.length < 2) return null;

  let best: { gapDays: number; after: QuoteRef; before: QuoteRef } | null =
    null;
  for (let i = 1; i < sorted.length; i += 1) {
    const gapDays = daysBetween(sorted[i].anchorTs, sorted[i - 1].anchorTs);
    if (gapDays < SILENCE_MIN_DAYS) continue;
    if (!best || gapDays > best.gapDays) {
      best = {
        gapDays,
        after: sorted[i - 1],
        before: sorted[i],
      };
    }
  }
  return best;
}

/** Early vs most-recent phrasing with enough temporal distance. */
export function findDriftPair(
  quotes: QuoteRef[],
): { early: QuoteRef; recent: QuoteRef } | null {
  const sorted = sortChronological(quotes);
  if (sorted.length < 2) return null;

  const early = sorted[0];
  const recent = sorted[sorted.length - 1];
  if (early.entryId === recent.entryId) return null;
  if (daysBetween(early.anchorTs, recent.anchorTs) < PAIR_MIN_GAP_DAYS) {
    return null;
  }
  if (early.text.trim().toLowerCase() === recent.text.trim().toLowerCase()) {
    return null;
  }
  return { early, recent };
}

/**
 * A genuine open question already present in the user's writing —
 * not something we invent by default.
 */
export function hasOpenQuestion(quotes: QuoteRef[]): boolean {
  return quotes.some((q) => {
    const t = q.text.trim();
    if (/\?\s*$/.test(t)) return true;
    return /\b(i wonder|not sure|don't know|what if|why (?:do|am|can't|won't)|am i|is it)\b/i.test(
      t,
    );
  });
}

/**
 * Select the single closing signal for this evidence set.
 * Uses EvidenceSignals so echo/pair work already done by the planner.
 */
export function selectClosingSignal(
  signals: EvidenceSignals,
): ClosingSignal {
  const { selectedQuotes, echo, pair } = signals;

  const silence = findSilenceGap(selectedQuotes);
  if (silence) {
    return {
      kind: "silence",
      text: formatSilenceLine(silence.gapDays),
      gapDays: silence.gapDays,
    };
  }

  const drift = findDriftPair(selectedQuotes);
  if (drift) {
    return { kind: "drift", early: drift.early, recent: drift.recent };
  }

  // Prefer planner pair when findDriftPair missed but pair exists with gap.
  if (pair) {
    const [a, b] = pair;
    const [early, recent] =
      a.anchorTs <= b.anchorTs ? [a, b] : [b, a];
    if (daysBetween(early.anchorTs, recent.anchorTs) >= PAIR_MIN_GAP_DAYS) {
      return { kind: "drift", early, recent };
    }
  }

  if (echo && isDistinctiveEchoPhrase(echo.phrase)) {
    return { kind: "phrase", phrase: echo.phrase, quotes: echo.quotes };
  }

  if (selectedQuotes.length >= 3) {
    return { kind: "mechanism" };
  }

  return { kind: "none" };
}

export const closingSignalKind = (signal: ClosingSignal): ClosingSignalKind =>
  signal.kind;
