"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ENTRIES_UPDATED_EVENT, readAllEntries } from "@/lib/journal-entries";
import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import { reconcileAnalyses } from "@/lib/patterns/entry-completion";
import type { PatternsAggregate, SurfacedPattern } from "@/lib/patterns/types";
import { PatternPassage } from "@/components/patterns/pattern-passage";
import { usePatternInsights } from "@/hooks/use-pattern-insights";

/**
 * Patterns surface — a continuous page of folded passages, one per surfaced
 * pattern. Only reachable once at least one pattern has crossed the threshold.
 */
export function PatternsView() {
  const router = useRouter();
  const [aggregate, setAggregate] = useState<PatternsAggregate | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);

  const mergeInsights = useCallback((enriched: SurfacedPattern[]) => {
    setAggregate((prev) =>
      prev ? { ...prev, surfaced: enriched } : prev,
    );
  }, []);

  usePatternInsights(aggregate, mergeInsights);

  useEffect(() => {
    const refresh = () => {
      try {
        setAggregate(aggregateAnalyses());
      } catch (error) {
        console.error("Failed to aggregate patterns", error);
        setAggregate({ analyzedEntryCount: 0, surfaced: [] });
      }
    };

    refresh();
    void reconcileAnalyses();

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("keeps-")) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(ANALYSES_UPDATED_EVENT, refresh);
    window.addEventListener(ENTRIES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, refresh);
    };
  }, []);

  const surfaced = aggregate?.surfaced ?? [];
  const hasSurfaced = surfaced.length > 0;

  useEffect(() => {
    if (aggregate === null) return;
    if (!hasSurfaced) {
      router.replace("/dashboard");
    }
  }, [aggregate, hasSurfaced, router]);

  const handleOpenEntry = useCallback(
    (entryId: string) => {
      router.push(`/dashboard/journal/${entryId}`);
    },
    [router],
  );

  const entriesHref = useMemo(() => {
    const entries = readAllEntries();
    return entries[0] ? `/dashboard/journal/${entries[0].id}` : "/dashboard";
  }, []);

  if (aggregate === null || !hasSurfaced) {
    return null;
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-[max(1.25rem,env(safe-area-inset-left))] py-10 pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-14 lg:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href={entriesHref}
          className="mb-8 inline-flex items-center gap-1 text-sm text-(--sidebar-ink-soft) transition-colors duration-150 hover:text-(--sidebar-ink) sm:mb-10"
        >
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          Entries
        </Link>

        <header className="mb-10 sm:mb-14">
          <h1
            className="text-xl font-bold tracking-tight text-(--canvas-title-ink) sm:text-2xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Patterns
          </h1>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-secondary">
            A few thoughts have been returning lately.
          </p>
        </header>

        <div className="flex flex-col">
          {surfaced.map((pattern, index) => (
            <div key={pattern.name}>
              {index > 0 ? (
                <hr className="my-8 border-t border-black/[0.06] sm:my-10" />
              ) : null}
              <PatternPassage
                pattern={pattern}
                analyzedEntryCount={aggregate.analyzedEntryCount}
                open={openName === pattern.name}
                onToggle={() =>
                  setOpenName((prev) =>
                    prev === pattern.name ? null : pattern.name,
                  )
                }
                onOpenEntry={handleOpenEntry}
              />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
