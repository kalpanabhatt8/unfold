"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { passageStructureValid } from "@/lib/patterns/passage-fill";
import {
  beatAwaitingVoice,
  passageToBeats,
} from "@/lib/patterns/passage-beats";
import { passageNeedsGeneration } from "@/lib/patterns/passage-types";
import type { PatternName } from "@/lib/patterns/vocabulary";
import type { PatternEvidenceItem } from "@/lib/patterns/types";
import type { PatternPassage } from "@/lib/patterns/passage-types";
import { ReflectionSheet } from "@/components/patterns/reflection-sheet";
import { usePatternPassages } from "@/hooks/use-pattern-passages";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";
import "@/lib/patterns/passage-debug";

const formatRange = (evidence: PatternEvidenceItem[]): string => {
  const anchorTs = (item: PatternEvidenceItem) =>
    item.sealedAt ?? item.lastEditedAt ?? item.createdAt;
  const formatDay = (ts: number) => {
    const date = new Date(ts);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    });
  };
  const times = evidence.map(anchorTs);
  const first = formatDay(Math.min(...times));
  const last = formatDay(Math.max(...times));
  return first === last ? first : `${first} – ${last}`;
};

export type PatternDetailViewProps = {
  patternName: PatternName;
};

/**
 * Guided pattern reading — sheet centered in the canvas, one beat at a time.
 */
export function PatternDetailView({ patternName }: PatternDetailViewProps) {
  const router = useRouter();
  const aggregate = usePatternsAggregate();
  const patterns = usePatternPassages(aggregate);
  const [beatIndex, setBeatIndex] = useState(0);

  const pattern = patterns.find((p) => p.name === patternName);
  const passage: PatternPassage | null = pattern?.passage ?? null;
  const needsVoice = passage ? passageNeedsGeneration(passage) : false;

  const beats = useMemo(
    () => (passage ? passageToBeats(passage.slots, passage.shapeId) : []),
    [passage],
  );

  const currentBeat = beats[beatIndex] ?? null;

  const loading =
    !pattern ||
    (passage !== null &&
      needsVoice &&
      (beats.length === 0 ||
        (currentBeat !== null && beatAwaitingVoice(currentBeat))));

  const dateRange = pattern ? formatRange(pattern.evidence) : null;

  const cacheKey = passage?.cacheKey ?? "";

  useEffect(() => {
    setBeatIndex(0);
  }, [cacheKey]);

  useEffect(() => {
    if (!passage) return;
    const beatPlan = passageToBeats(passage.slots, passage.shapeId);
    console.group(`[patterns] ${patternName}`);
    console.log("PatternPassage", passage);
    console.log("slots", passage.slots.map((s, i) => ({ i, ...s })));
    console.log("beats", beatPlan);
    console.log({
      shapeId: passage.shapeId,
      needsGeneration: passageNeedsGeneration(passage),
      structureValid: passageStructureValid(passage),
      beatTypes: beatPlan.map((b) => b.type),
      uiLoading: needsVoice && beatPlan.length === 0,
    });
    console.groupEnd();
  }, [passage, patternName]);

  useEffect(() => {
    if (aggregate === null) return;
    if (!aggregate.surfaced.some((p) => p.name === patternName)) {
      router.replace("/dashboard/patterns");
    }
  }, [aggregate, patternName, router]);

  const handleOpenEntry = useCallback(
    (entryId: string) => {
      router.push(`/dashboard/journal/${entryId}`);
    },
    [router],
  );

  const handleContinue = useCallback(() => {
    if (beats.length === 0) return;
    if (beatIndex >= beats.length - 1) {
      router.push("/dashboard/patterns");
      return;
    }
    setBeatIndex((i) => i + 1);
  }, [beatIndex, beats.length, router]);

  if (aggregate === null || !pattern) {
    return null;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--sidebar-bg-lightest)">
      <div className="shrink-0 px-[max(1.25rem,env(safe-area-inset-left))] pt-8 sm:px-8 sm:pt-10">
        <Link
          href="/dashboard/patterns"
          className="inline-flex items-center gap-1 text-[0.8125rem] text-(--sidebar-ink-soft) transition-colors duration-150 hover:text-(--sidebar-ink)"
        >
          <ChevronLeft size={15} strokeWidth={1.75} aria-hidden />
          Patterns
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center px-4 py-12 sm:px-5 sm:py-16 lg:px-6 lg:py-20">
        <ReflectionSheet
          beat={currentBeat}
          beatIndex={beatIndex}
          totalBeats={beats.length}
          loading={loading}
          dateRange={dateRange}
          onContinue={handleContinue}
          onOpenEntry={handleOpenEntry}
        />
      </div>
    </main>
  );
}
