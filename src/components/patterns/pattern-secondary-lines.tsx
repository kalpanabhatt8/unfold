import type { SurfacedPattern } from "@/lib/patterns/types";

/** Oxford-comma list for pattern label strings. */
export const formatPatternLabelList = (labels: string[]): string => {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
};

export type PatternSecondaryLinesProps = {
  foldedLabels: SurfacedPattern["foldedLabels"];
  coPatterns: SurfacedPattern["coPatterns"];
  className?: string;
};

/**
 * Secondary pattern context on accordion rows — folded overlap vs moderate
 * co-occurrence use different copy (spec §6).
 */
export function PatternSecondaryLines({
  foldedLabels,
  coPatterns,
  className = "pattern-accordion__row-secondary",
}: PatternSecondaryLinesProps) {
  const folded =
    foldedLabels.length > 0
      ? `This often shows up as ${formatPatternLabelList(foldedLabels)} too.`
      : null;

  const alongside =
    coPatterns.length > 0
      ? coPatterns.length === 1
        ? `In some of the same entries, ${coPatterns[0]} comes up too.`
        : `In some of the same entries, ${formatPatternLabelList(coPatterns)} come up too.`
      : null;

  if (!folded && !alongside) return null;

  return (
    <>
      {folded ? (
        <span className={className} data-kind="folded">
          {folded}
        </span>
      ) : null}
      {alongside ? (
        <span className={className} data-kind="alongside">
          {alongside}
        </span>
      ) : null}
    </>
  );
}
