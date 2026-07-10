"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { readAllEntries } from "@/lib/journal-entries";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary";
import { PatternListItem } from "@/components/patterns/pattern-list-item";
import { usePatternDisplay } from "@/hooks/use-pattern-display";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";
import "@/lib/patterns/passage-debug";

/** Match the journal writing column — centered, not full-bleed. */
const PATTERNS_COLUMN_MAX_WIDTH = "min(92vw, 700px)";

/**
 * Patterns index — choose a pattern to read at your own pace.
 */
export function PatternsView() {
  const router = useRouter();
  const aggregate = usePatternsAggregate();
  const patterns = usePatternDisplay(aggregate);

  const hasSurfaced = (aggregate?.surfaced.length ?? 0) > 0;

  useEffect(() => {
    if (aggregate === null) return;
    if (!hasSurfaced) {
      router.replace("/dashboard");
    }
  }, [aggregate, hasSurfaced, router]);

  const entriesHref = useMemo(() => {
    const entries = readAllEntries();
    return entries[0] ? `/dashboard/journal/${entries[0].id}` : "/dashboard";
  }, []);

  if (aggregate === null || !hasSurfaced) {
    return null;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-(--sidebar-bg) py-10 sm:py-12 lg:py-14">
      <div
        className="mx-auto flex w-full flex-col px-4 sm:px-5 lg:px-6"
        style={{ maxWidth: PATTERNS_COLUMN_MAX_WIDTH }}
      >
        <Link
          href={entriesHref}
          className="mb-10 inline-flex items-center gap-1 text-sm text-(--sidebar-ink-soft) transition-colors duration-150 hover:text-(--sidebar-ink) sm:mb-12"
        >
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          Entries
        </Link>

        <header className="mb-12 sm:mb-14">
          <h1
            className="header-lg font-medium tracking-tight text-(--sidebar-active-ink) sm:text-2xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Patterns
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-(--sidebar-ink-soft)">
            A few thoughts have been returning lately.
          </p>
        </header>

        <div className="flex flex-col">
          {patterns.map((pattern) => (
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
