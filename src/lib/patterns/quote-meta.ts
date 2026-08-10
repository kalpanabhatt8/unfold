/**
 * Quote-card metadata helpers - quiet date labels.
 */

/** Compact date for card provenance - e.g. "12 Jul". */
export const formatQuoteDatePill = (ts: number): string => {
  const date = new Date(ts);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  if (sameYear) {
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  }
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/**
 * Short stem from a quote for moment cards - first few words, no ellipsis noise
 * when the quote is already short.
 */
export const formatQuoteStem = (text: string, maxWords = 5): string => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}…`;
};

/** Moment card header: date · short quote stem (not the entry seal title). */
export const formatMomentLabel = (anchorTs: number, quoteText: string): string => {
  const date = formatQuoteDatePill(anchorTs);
  const stem = formatQuoteStem(quoteText);
  return stem ? `${date} · ${stem}` : date;
};
