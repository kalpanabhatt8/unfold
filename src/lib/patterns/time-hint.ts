/**
 * Derive a quiet "when" hint from evidence timestamps — only when one part of
 * the day clearly dominates (≥60% of entries in the same bucket).
 */

import type { PatternEvidenceItem } from "@/lib/patterns/types";

type DayPart = {
  id: string;
  label: string;
  /** Hour ranges [start, end) — end may wrap past midnight. */
  ranges: Array<[number, number]>;
};

const DAY_PARTS: DayPart[] = [
  { id: "early_morning", label: "early morning", ranges: [[5, 9]] },
  { id: "morning", label: "morning", ranges: [[9, 12]] },
  { id: "afternoon", label: "afternoon", ranges: [[12, 17]] },
  { id: "evening", label: "evening", ranges: [[17, 21]] },
  { id: "late_evening", label: "late evening", ranges: [[21, 24]] },
  { id: "night", label: "late night", ranges: [[0, 5]] },
];

const anchorHour = (item: PatternEvidenceItem): number =>
  new Date(item.sealedAt ?? item.lastEditedAt ?? item.createdAt).getHours();

const inRange = (hour: number, [start, end]: [number, number]): boolean =>
  hour >= start && hour < end;

const bucketForHour = (hour: number): DayPart | null =>
  DAY_PARTS.find((part) => part.ranges.some((range) => inRange(hour, range))) ??
  null;

/** e.g. "usually late evening" — null when timing is mixed or too few entries. */
export function deriveTimeHint(
  evidence: PatternEvidenceItem[],
): string | null {
  if (evidence.length < 2) return null;

  const counts = new Map<string, { label: string; n: number }>();
  for (const item of evidence) {
    const part = bucketForHour(anchorHour(item));
    if (!part) continue;
    const existing = counts.get(part.id);
    if (existing) existing.n += 1;
    else counts.set(part.id, { label: part.label, n: 1 });
  }

  let best: { label: string; n: number } | null = null;
  for (const bucket of counts.values()) {
    if (!best || bucket.n > best.n) best = bucket;
  }

  if (!best || best.n / evidence.length < 0.6) return null;
  return `usually ${best.label}`;
}
