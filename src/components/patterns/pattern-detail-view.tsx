"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  buildArcFromPassage,
  buildOrientingLine,
  explainArc,
  getInitialRevealIndex,
  type DiscoveryArc,
} from "@/lib/patterns/discovery-arc";
import { passageStructureValid } from "@/lib/patterns/passage-fill";
import { passageToBeats } from "@/lib/patterns/passage-beats";
import { passageNeedsGeneration } from "@/lib/patterns/passage-types";
import type { PatternName } from "@/lib/patterns/vocabulary";
import type { PatternPassage } from "@/lib/patterns/passage-types";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary";
import { DiscoveryCanvas } from "@/components/patterns/discovery-canvas";
import { usePatternDisplay } from "@/hooks/use-pattern-display";
import { usePatternPassages } from "@/hooks/use-pattern-passages";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";
import "@/lib/patterns/passage-debug";

export type PatternDetailViewProps = {
  patternName: PatternName;
};

function CanvasSkeleton() {
  return (
    <div className="w-full max-w-[min(92vw,700px)]" aria-hidden>
      <span className="block h-6 w-[55%] animate-pulse rounded bg-(--sidebar-tab-track)" />
      <span className="mt-3 block h-3.5 w-[30%] animate-pulse rounded bg-(--sidebar-hover-bg)" />
      <span className="mt-12 block h-24 w-full animate-pulse rounded bg-(--sidebar-tab-track)" />
      <span className="mt-4 block h-24 w-[85%] animate-pulse rounded bg-(--sidebar-hover-bg)" />
    </div>
  );
}

/**
 * Guided discovery — one evolving canvas, behavioral headline first.
 */
export function PatternDetailView({ patternName }: PatternDetailViewProps) {
  const router = useRouter();
  const aggregate = usePatternsAggregate();
  const displayPatterns = usePatternDisplay(aggregate);
  const patterns = usePatternPassages(aggregate);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const initializedKeyRef = useRef<string | null>(null);

  const pattern = patterns.find((p) => p.name === patternName);
  const displayPattern = displayPatterns.find((p) => p.name === patternName);
  const passage: PatternPassage | null = pattern?.passage ?? null;

  const headlineTitle = useMemo(() => {
    const behavioral = displayPattern?.display?.displayTitle?.trim();
    if (behavioral) return behavioral;
    return PATTERN_LABELS[patternName];
  }, [displayPattern?.display?.displayTitle, patternName]);

  // Headline + evidence need no AI, so the arc renders immediately. The CTA
  // is the only thing gated on full generation: the beat count isn't final
  // until every voice slot is filled, so the canvas hides the button (never
  // guessing between Continue/Done) until flowReady.
  const flowReady = passage !== null && !passageNeedsGeneration(passage);

  const arc: DiscoveryArc | null = useMemo(() => {
    if (!passage || !pattern) return null;
    const momentCount = pattern.evidence.length;
    return buildArcFromPassage(
      passage.slots,
      passage.shapeId,
      headlineTitle,
      buildOrientingLine(momentCount),
    );
  }, [passage, pattern, headlineTitle]);

  const cacheKey = passage?.cacheKey ?? "";

  // Initialize the reading position exactly once per passage. Later arc
  // rebuilds (e.g. the display title arriving) must not reset progress.
  useLayoutEffect(() => {
    if (!arc) return;
    if (initializedKeyRef.current === cacheKey) return;
    initializedKeyRef.current = cacheKey;
    setPhaseIndex(getInitialRevealIndex(arc));
  }, [arc, cacheKey]);

  useEffect(() => {
    if (!passage) return;
    const beatPlan = passageToBeats(passage.slots, passage.shapeId);
    console.group(`[patterns] ${patternName}`);
    console.log("PatternPassage", passage);
    console.log("slots", passage.slots.map((s, i) => ({ i, ...s })));
    console.log("beats (legacy)", beatPlan);
    console.log("discovery arc", arc);
    console.log("arc phases", arc?.phases);
    const { trace, route } = explainArc(passage.slots, passage.shapeId);
    console.log("arc route", route);
    console.table(trace);
    console.log({
      shapeId: passage.shapeId,
      lifecycle: passage.lifecycle,
      needsGeneration: passageNeedsGeneration(passage),
      structureValid: passageStructureValid(passage),
      voiceTexts: passage.slots.flatMap((s) => {
        if (s.kind === "line") return [{ kind: "line", text: s.text }];
        if (s.kind === "close" && s.endingKind !== "quote")
          return [{ kind: "close", endingKind: s.endingKind, text: s.text }];
        return [];
      }),
    });
    console.groupEnd();
  }, [passage, patternName, arc]);

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
    if (!arc || !flowReady) return;
    if (phaseIndex >= arc.phases.length - 1) {
      router.push("/dashboard/patterns");
      return;
    }
    setPhaseIndex((i) => i + 1);
  }, [arc, flowReady, phaseIndex, router]);

  if (aggregate === null || !pattern) {
    return null;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--discovery-canvas-bg)">
      <div className="shrink-0 px-[max(1.25rem,env(safe-area-inset-left))] pt-8 sm:px-8 sm:pt-10">
        <Link
          href="/dashboard/patterns"
          aria-label="Back to patterns"
          className="inline-flex items-center text-(--sidebar-ink-soft) transition-colors duration-150 hover:text-(--sidebar-ink)"
        >
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-5 sm:pt-8 lg:px-6 lg:pt-10">
        {arc ? (
          <DiscoveryCanvas
            arc={arc}
            phaseIndex={phaseIndex}
            revealKey={cacheKey}
            ctaReady={flowReady}
            onContinue={handleContinue}
            onOpenEntry={handleOpenEntry}
          />
        ) : (
          <CanvasSkeleton />
        )}
      </div>
    </main>
  );
}
