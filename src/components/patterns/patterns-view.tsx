"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary";
import { PatternListItem } from "@/components/patterns/pattern-list-item";
import { usePatternDisplay } from "@/hooks/use-pattern-display";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";
import { useViewportLayout } from "@/hooks/use-viewport-layout";
import "@/lib/patterns/passage-debug";

/** Patterns reading column — a bit wider than the journal writing column. */
const PATTERNS_COLUMN_MAX_WIDTH = "min(92vw, 780px)";

/**
 * Patterns index — choose a pattern to read at your own pace.
 */
export function PatternsView() {
  const router = useRouter();
  const viewport = useViewportLayout();
  const aggregate = usePatternsAggregate();
  const patterns = usePatternDisplay(aggregate);

  const hasSurfaced = (aggregate?.surfaced.length ?? 0) > 0;

  useEffect(() => {
    if (aggregate === null) return;
    if (!hasSurfaced) {
      router.replace("/dashboard");
    }
  }, [aggregate, hasSurfaced, router]);

  if (aggregate === null || !hasSurfaced) {
    return null;
  }

  const enriched = patterns.length > 0 ? patterns : aggregate.surfaced;
  // Only list patterns whose landing copy is ready — no skeleton tease.
  const listPatterns = enriched.filter((pattern) => pattern.display !== null);

  if (listPatterns.length === 0) {
    return null;
  }

  return (
    <main
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-(--sidebar-bg)"
      style={{
        paddingTop: viewport.pagePaddingYPx,
        paddingBottom: viewport.pagePaddingYPx,
      }}
    >
      <div
        className="mx-auto flex w-full flex-col px-4 sm:px-5 lg:px-6"
        style={{ maxWidth: PATTERNS_COLUMN_MAX_WIDTH }}
      >
        <header className="mb-12 sm:mb-14">
          <h1
            className="header-lg font-medium tracking-tight text-(--sidebar-active-ink)"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Patterns
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-(--sidebar-ink-soft)">
            A few thoughts have been returning lately.
          </p>
        </header>

        <div className="flex flex-col">
          {listPatterns.map((pattern) => (
            <PatternListItem
              key={pattern.name}
              label={PATTERN_LABELS[pattern.name]}
              href={`/dashboard/patterns/${pattern.name}`}
              entryCount={pattern.entryCount}
              evidence={pattern.evidence}
              timeHint={pattern.timeHint}
              display={pattern.display}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
