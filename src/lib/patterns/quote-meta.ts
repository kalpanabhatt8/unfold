/**
 * Quiet quote-card metadata — entry name · date · time, no shouty caps.
 */

import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import { dayPartLabel } from "@/lib/patterns/time-hint";

const formatQuietDate = (ts: number): string => {
  const date = new Date(ts);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date
    .toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    })
    .toLowerCase();
};

/** Faint timeline label on the left of an evidence card. */
export const formatTimelineDate = (ts: number): string => {
  const date = new Date(ts);
  return date
    .toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
    })
    .toLowerCase();
};

/**
 * Quiet provenance — entry name (source), then date · time context.
 * All lowercase so it sits behind the quote instead of competing with it.
 */
export const formatQuoteMeta = (quote: QuoteRef): string => {
  const parts: string[] = [];
  const name = quote.entryTitle.trim();
  if (name) parts.push(name.toLowerCase());
  parts.push(formatQuietDate(quote.anchorTs));
  const dayPart = dayPartLabel(quote.anchorTs);
  if (dayPart) parts.push(dayPart);
  return parts.join(" · ");
};
