/**
 * Later occurrences of an already-discovered pattern.
 *
 * When a new matching moment arrives after discovery, we do NOT regenerate
 * the original reading. We record the new match and surface a Recurrence
 * Card (earlier vs newer + gap) below Moments.
 */

import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import type { PatternEvidenceItem } from "@/lib/patterns/types";
import type { PassageSlot, PatternPassage } from "@/lib/patterns/passage-types";

const DAY_MS = 86_400_000;

export type PatternOccurrence = {
  entryId: string;
  entryTitle: string;
  quote: string;
  anchorTs: number;
  /** Whole days since the first noticed occurrence (0 = discovery). */
  daysSinceFirst: number;
};

export type RecurrenceSide = {
  entryId: string;
  entryTitle: string;
  quote: string;
  anchorTs: number;
};

/** Two-sided recurrence: prior moment vs newest, with a plain gap. */
export type RecurrenceCardData = {
  earlier: RecurrenceSide;
  newer: RecurrenceSide;
  /** e.g. "11 days later" */
  gapLabel: string;
};

const anchorTs = (item: PatternEvidenceItem): number =>
  item.sealedAt ?? item.lastEditedAt ?? item.createdAt;

const daysBetween = (earlier: number, later: number): number =>
  Math.max(0, Math.round((later - earlier) / DAY_MS));

export const formatGapLater = (days: number): string => {
  if (days <= 0) return "same day";
  if (days === 1) return "1 day later";
  return `${days} days later`;
};

const quotesFromSlots = (slots: PassageSlot[]): QuoteRef[] => {
  const out: QuoteRef[] = [];
  for (const slot of slots) {
    if (slot.kind === "moments" || slot.kind === "pair") {
      out.push(...slot.quotes);
    }
    if (slot.kind === "echo") out.push(...slot.quotes);
    if (slot.kind === "close" && slot.quote) out.push(slot.quote);
  }
  return out;
};

export const entryIdsInPassage = (passage: PatternPassage): Set<string> => {
  const ids = new Set<string>();
  for (const q of quotesFromSlots(passage.slots)) ids.add(q.entryId);
  for (const o of passage.occurrences ?? []) ids.add(o.entryId);
  return ids;
};

export const firstNoticedTs = (passage: PatternPassage): number => {
  if (typeof passage.discoveredAt === "number" && passage.discoveredAt > 0) {
    const fromSlots = quotesFromSlots(passage.slots).map((q) => q.anchorTs);
    const minSlot =
      fromSlots.length > 0 ? Math.min(...fromSlots) : passage.discoveredAt;
    return Math.min(minSlot, passage.discoveredAt);
  }
  const fromSlots = quotesFromSlots(passage.slots).map((q) => q.anchorTs);
  if (fromSlots.length === 0) return passage.createdAt;
  return Math.min(...fromSlots);
};

/** Chronological unique-entry moments (discovery + later occurrences). */
export function chronologicalOccurrences(
  passage: PatternPassage,
): PatternOccurrence[] {
  const firstTs = firstNoticedTs(passage);
  const fromDiscovery = quotesFromSlots(passage.slots)
    .map((q) => ({
      entryId: q.entryId,
      entryTitle: q.entryTitle,
      quote: q.text,
      anchorTs: q.anchorTs,
      daysSinceFirst: daysBetween(firstTs, q.anchorTs),
    }))
    .reduce<PatternOccurrence[]>((acc, row) => {
      if (acc.some((a) => a.entryId === row.entryId)) return acc;
      acc.push(row);
      return acc;
    }, []);

  const byId = new Map<string, PatternOccurrence>();
  for (const row of fromDiscovery) byId.set(row.entryId, row);
  for (const row of passage.occurrences ?? []) byId.set(row.entryId, row);

  return [...byId.values()].sort((a, b) => {
    if (a.anchorTs !== b.anchorTs) return a.anchorTs - b.anchorTs;
    return a.entryId.localeCompare(b.entryId);
  });
}

/**
 * Recurrence Card data — only after birth, when at least one later match
 * exists (2nd occurrence onward). Compares the newest match to the prior one.
 */
export function buildRecurrenceCard(
  passage: PatternPassage,
): RecurrenceCardData | null {
  const later = passage.occurrences ?? [];
  if (later.length === 0) return null;

  const history = chronologicalOccurrences(passage);
  if (history.length < 2) return null;

  const newer = history[history.length - 1];
  const earlier = history[history.length - 2];
  const gapDays = daysBetween(earlier.anchorTs, newer.anchorTs);

  return {
    earlier: {
      entryId: earlier.entryId,
      entryTitle: earlier.entryTitle,
      quote: earlier.quote,
      anchorTs: earlier.anchorTs,
    },
    newer: {
      entryId: newer.entryId,
      entryTitle: newer.entryTitle,
      quote: newer.quote,
      anchorTs: newer.anchorTs,
    },
    gapLabel: formatGapLater(gapDays),
  };
}

/**
 * Whether new evidence only adds entries — original discovery material intact.
 * Removals force a full replan instead.
 */
export function discoveryEntriesIntact(
  passage: PatternPassage,
  evidence: PatternEvidenceItem[],
): boolean {
  const discoveryIds = new Set(
    quotesFromSlots(passage.slots).map((q) => q.entryId),
  );
  const live = new Set(evidence.map((e) => e.entryId));
  for (const id of discoveryIds) {
    if (!live.has(id)) return false;
  }
  return true;
}

export function isAdditiveEvidence(
  passage: PatternPassage,
  evidence: PatternEvidenceItem[],
): boolean {
  if (!discoveryEntriesIntact(passage, evidence)) return false;
  const known = entryIdsInPassage(passage);
  return evidence.some((item) => !known.has(item.entryId));
}

/**
 * Append new matching moments as later occurrences. Preserves original slots.
 * Returns null when there is nothing new to add.
 */
export function appendLaterOccurrences(
  passage: PatternPassage,
  evidence: PatternEvidenceItem[],
): PatternPassage | null {
  const known = entryIdsInPassage(passage);
  const firstTs = firstNoticedTs(passage);

  const fresh = [...evidence]
    .filter((item) => !known.has(item.entryId))
    .sort((a, b) => anchorTs(a) - anchorTs(b));

  if (fresh.length === 0) return null;

  const added: PatternOccurrence[] = fresh.map((item) => {
    const ts = anchorTs(item);
    const quote =
      item.quotes.find((q) => q.trim().length > 0)?.trim() ?? "";
    return {
      entryId: item.entryId,
      entryTitle: item.entryTitle,
      quote,
      anchorTs: ts,
      daysSinceFirst: daysBetween(firstTs, ts),
    };
  });

  return {
    ...passage,
    occurrences: [...(passage.occurrences ?? []), ...added],
  };
}

/** Newest later occurrence — for diagnostics / timing. */
export function latestLaterOccurrence(
  passage: PatternPassage,
): PatternOccurrence | null {
  const later = passage.occurrences ?? [];
  if (later.length === 0) return null;
  return later.reduce((best, row) =>
    row.anchorTs >= best.anchorTs ? row : best,
  );
}
