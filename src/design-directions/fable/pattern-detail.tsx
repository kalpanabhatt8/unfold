"use client";

import { PatternDetailView } from "@/components/patterns/pattern-detail-view";
import type { PatternName } from "@/lib/patterns/vocabulary-public";

/** Placeholder - replaced by the Fable direction build. */
export function FablePatternDetail({
  patternName,
}: {
  patternName: PatternName;
}) {
  return <PatternDetailView patternName={patternName} />;
}
