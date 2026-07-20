/**
 * Quote-card metadata helpers — quiet date labels.
 */

/** Compact date for card provenance — e.g. "12 Jul". */
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
