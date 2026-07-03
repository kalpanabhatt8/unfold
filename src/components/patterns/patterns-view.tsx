"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Waypoints } from "lucide-react";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";
import { aggregateAnalyses } from "@/lib/patterns/aggregate";
import {
  ANALYSES_UPDATED_EVENT,
} from "@/lib/patterns/analysis-store";
import { reconcileAnalyses } from "@/lib/patterns/entry-completion";
import { SURFACE_MIN_ENTRIES } from "@/lib/patterns/vocabulary";
import type { PatternsAggregate, SurfacedPattern } from "@/lib/patterns/types";
import { PatternCard } from "@/components/patterns/pattern-card";
import { EvidencePanel } from "@/components/patterns/evidence-panel";
import { usePatternInsights } from "@/hooks/use-pattern-insights";

/**
 * Patterns surface. Aggregates stored per-entry analyses (no LLM at read time),
 * kicks a rate-limited backfill for completed entries missing analysis (sealed
 * or 24h-idle drafts with 50+ words), and
 * wires the evidence side panel + entry navigation.
 */
export function PatternsView() {
  const router = useRouter();
  const [aggregate, setAggregate] = useState<PatternsAggregate | null>(null);
  const [selected, setSelected] = useState<SurfacedPattern | null>(null);

  const mergeInsights = useCallback((enriched: SurfacedPattern[]) => {
    setAggregate((prev) =>
      prev ? { ...prev, surfaced: enriched } : prev,
    );
    setSelected((prev) => {
      if (!prev) return prev;
      return enriched.find((p) => p.name === prev.name) ?? prev;
    });
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

    // Self-healing: analyze completed entries missing analysis, then refresh
    // once they land.
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

  const handleOpenEntry = useCallback(
    (entryId: string) => {
      setSelected(null);
      router.push(`/dashboard/journal/${entryId}`);
    },
    [router],
  );

  const surfaced = aggregate?.surfaced ?? [];
  const hasSurfaced = surfaced.length > 0;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 sm:mb-8">
          <h1
            className="text-xl font-bold tracking-tight text-(--canvas-title-ink) sm:text-2xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Patterns
          </h1>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-secondary sm:mt-1.5">
            What keeps returning across your sealed entries.
          </p>
        </header>

        {aggregate === null ? null : hasSurfaced ? (
          <div className="flex flex-col gap-3 sm:gap-4">
            {surfaced.map((pattern) => (
              <PatternCard
                key={pattern.name}
                pattern={pattern}
                onOpen={setSelected}
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      <EvidencePanel
        pattern={selected}
        onClose={() => setSelected(null)}
        onOpenEntry={handleOpenEntry}
      />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-black/[0.10] bg-white/40 px-4 py-12 text-center sm:px-6 sm:py-16">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.04] text-(--canvas-title-ink)"
        aria-hidden
      >
        <Waypoints size={20} strokeWidth={1.75} />
      </span>
      <p
        className="text-base font-medium text-(--canvas-title-ink)"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        No patterns yet
      </p>
      <p className="max-w-sm text-sm leading-relaxed text-secondary">
        A pattern appears once it shows up in {SURFACE_MIN_ENTRIES}+ sealed
        entries. Keep writing and sealing — the patterns will surface here.
      </p>
    </div>
  );
}
