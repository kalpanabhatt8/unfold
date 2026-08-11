"use client";

import { PatternDetailView } from "@/components/patterns/pattern-detail-view";
import type { PatternName } from "@/lib/patterns/vocabulary-public";

/** Placeholder - replaced by the Spatial direction build. */
export function SpatialPatternDetail({
  patternName,
}: {
  patternName: PatternName;
}) {
  return <PatternDetailView patternName={patternName} />;
}
