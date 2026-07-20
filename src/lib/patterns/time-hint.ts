/**
 * Quiet timing helpers for patterns — day-part hints and compact timeline labels.
 */

import type { PatternEvidenceItem } from "@/lib/patterns/types";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const evidenceAnchorTs = (item: PatternEvidenceItem): number =>
  item.sealedAt ?? item.lastEditedAt ?? item.createdAt;

const startOfLocalDay = (ts: number): number => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * Compact timeline label for a pattern tab — e.g. "12–14 Jul", "28 Jun–2 Jul",
 * or "12 Jul" when all evidence falls on one day.
 */
export function formatPatternTimeline(
  evidence: PatternEvidenceItem[],
): string {
  if (evidence.length === 0) return "";

  let minTs = Infinity;
  let maxTs = -Infinity;
  for (const item of evidence) {
    const ts = evidenceAnchorTs(item);
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }

  const start = new Date(startOfLocalDay(minTs));
  const end = new Date(startOfLocalDay(maxTs));
  const sameDay = start.getTime() === end.getTime();
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();
  const nowYear = new Date().getFullYear();

  const day = (d: Date) => d.getDate();
  const mon = (d: Date) => MONTHS_SHORT[d.getMonth()];
  const yearSuffix = (d: Date) =>
    d.getFullYear() !== nowYear || !sameYear ? ` ${d.getFullYear()}` : "";

  if (sameDay) {
    return `${day(start)} ${mon(start)}${yearSuffix(start)}`;
  }

  if (sameMonth) {
    return `${day(start)}–${day(end)} ${mon(end)}${yearSuffix(end)}`;
  }

  if (sameYear) {
    return `${day(start)} ${mon(start)}–${day(end)} ${mon(end)}${yearSuffix(end)}`;
  }

  return `${day(start)} ${mon(start)} ${start.getFullYear()}–${day(end)} ${mon(end)} ${end.getFullYear()}`;
}

/** Earliest evidence day — for sorting chronologically. */
export function patternTimelineStart(evidence: PatternEvidenceItem[]): number {
  if (evidence.length === 0) return 0;
  let minTs = Infinity;
  for (const item of evidence) {
    const ts = evidenceAnchorTs(item);
    if (ts < minTs) minTs = ts;
  }
  return startOfLocalDay(minTs);
}

/** Latest evidence timestamp — most-recent patterns sort first. */
export function patternTimelineEnd(evidence: PatternEvidenceItem[]): number {
  if (evidence.length === 0) return 0;
  let maxTs = -Infinity;
  for (const item of evidence) {
    const ts = evidenceAnchorTs(item);
    if (ts > maxTs) maxTs = ts;
  }
  return maxTs;
}

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

/** Human day-part for a timestamp, e.g. "late evening" — for journey rows. */
export function dayPartLabel(timestamp: number): string | null {
  return bucketForHour(new Date(timestamp).getHours())?.label ?? null;
}

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
