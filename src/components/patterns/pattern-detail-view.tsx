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
  discoveryAwaitingVoice,
  getInitialRevealIndex,
  isVoiceArcShape,
  phaseAtIndex,
  type DiscoveryArc,
} from "@/lib/patterns/discovery-arc";
import { passageNeedsGeneration } from "@/lib/patterns/passage-types";
import type { PatternName } from "@/lib/patterns/vocabulary";
import type { PatternPassage } from "@/lib/patterns/passage-types";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary";
import { DiscoveryCanvas } from "@/components/patterns/discovery-canvas";
import { usePatternDisplay } from "@/hooks/use-pattern-display";
import { usePatternPassages } from "@/hooks/use-pattern-passages";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";
import { stashJournalQuoteFocus } from "@/lib/journal-quote-focus";
import {
  beginPatternSession,
  logCtaReady,
  logCtaWaiting,
  logStageAtIndex,
} from "@/lib/patterns/pattern-timing";

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

/** True when advancing past currentIndex would reveal an unfilled voice beat. */
const nextStepNeedsVoice = (
  arc: DiscoveryArc,
  currentIndex: number,
): boolean => {
  const next = arc.phases[currentIndex + 1];
  if (!next) return false;
  if (next === "closing") {
    return (
      arc.closing?.kind === "mechanism" &&
      (arc.closing.text.trim().length ?? 0) === 0
    );
  }
  if (next === "reflection") {
    return (
      arc.reflection.quote === null &&
      arc.reflection.question.trim().length === 0
    );
  }
  return false;
};

/**
 * Guided discovery — one evolving canvas, behavioral headline first.
 */
export function PatternDetailView({ patternName }: PatternDetailViewProps) {
  const router = useRouter();
  const aggregate = usePatternsAggregate();
  const displayPatterns = usePatternDisplay(aggregate);
  const patterns = usePatternPassages(aggregate, patternName);
  const [phaseIndexState, setPhaseIndex] = useState(0);
  const [readerReady, setReaderReady] = useState(false);
  const initializedKeyRef = useRef<string | null>(null);
  const stablePassageRef = useRef<PatternPassage | null>(null);
  const timingStartedRef = useRef(false);

  const pattern = patterns.find((p) => p.name === patternName);
  const displayPattern = displayPatterns.find((p) => p.name === patternName);
  const passage: PatternPassage | null = pattern?.passage ?? null;

  useLayoutEffect(() => {
    stablePassageRef.current = null;
  }, [patternName, passage?.cacheKey ?? ""]);

  if (passage && isVoiceArcShape(passage.shapeId)) {
    stablePassageRef.current = passage;
  }

  const activePassage = stablePassageRef.current ?? passage;
  const cacheKey = activePassage?.cacheKey ?? "";

  const headlineTitle = useMemo(() => {
    const behavioral = displayPattern?.display?.displayTitle?.trim();
    if (behavioral) return behavioral;
    return PATTERN_LABELS[patternName];
  }, [displayPattern?.display?.displayTitle, patternName]);

  // Headline + evidence need no AI, so the arc renders immediately. Continue
  // stays available through cached beats; it only waits when the *next* beat
  // still needs voice text.
  const voiceReady =
    activePassage !== null && !passageNeedsGeneration(activePassage);

  const arc: DiscoveryArc | null = useMemo(() => {
    if (!activePassage || !pattern) return null;
    const momentCount = pattern.evidence.length;
    return buildArcFromPassage(
      activePassage.slots,
      activePassage.shapeId,
      headlineTitle,
      buildOrientingLine(momentCount),
      activePassage,
    );
  }, [activePassage, pattern, headlineTitle]);

  const ctaReady =
    readerReady &&
    (voiceReady ||
      (arc !== null &&
        !nextStepNeedsVoice(arc, phaseIndexState) &&
        !discoveryAwaitingVoice(
          arc,
          phaseAtIndex(arc, phaseIndexState),
        )));

  useLayoutEffect(() => {
    initializedKeyRef.current = null;
    setReaderReady(false);
    timingStartedRef.current = false;
  }, [patternName]);

  useLayoutEffect(() => {
    if (!pattern || timingStartedRef.current) return;
    timingStartedRef.current = true;
    beginPatternSession(patternName);
  }, [pattern, patternName]);

  // Initialize reading position whenever the passage identity changes.
  useLayoutEffect(() => {
    if (!arc || !cacheKey) {
      setReaderReady(false);
      return;
    }
    if (initializedKeyRef.current === cacheKey) return;
    initializedKeyRef.current = cacheKey;
    setPhaseIndex(getInitialRevealIndex(arc));
    setReaderReady(true);
  }, [arc, cacheKey]);

  useEffect(() => {
    if (!arc) return;
    const phase = phaseAtIndex(arc, phaseIndexState);
    logStageAtIndex(phase, phaseIndexState, arc.phases);
  }, [arc, phaseIndexState]);

  useEffect(() => {
    if (!arc) return;
    if (ctaReady) {
      logCtaReady();
      return;
    }
    if (!readerReady) {
      logCtaWaiting("reader not ready");
    } else if (!voiceReady) {
      logCtaWaiting("voice pending for next beat");
    }
  }, [arc, ctaReady, readerReady, voiceReady]);

  useEffect(() => {
    if (aggregate === null) return;
    if (!aggregate.surfaced.some((p) => p.name === patternName)) {
      router.replace("/dashboard/patterns");
    }
  }, [aggregate, patternName, router]);

  const handleOpenEntry = useCallback(
    (entryId: string, quoteText?: string) => {
      if (quoteText) stashJournalQuoteFocus(entryId, quoteText);
      router.push(`/dashboard/journal/${entryId}`);
    },
    [router],
  );

  const handleContinue = useCallback(() => {
    if (!arc || !ctaReady) return;
    if (phaseIndexState >= arc.phases.length - 1) {
      router.push("/dashboard/patterns");
      return;
    }
    setPhaseIndex((i) => i + 1);
  }, [arc, ctaReady, phaseIndexState, router]);

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
            phaseIndex={phaseIndexState}
            revealKey={cacheKey}
            ctaReady={ctaReady}
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
