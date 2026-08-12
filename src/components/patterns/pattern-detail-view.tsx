"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  buildArcFromPassage,
  buildOrientingLine,
  explainArc,
  getInitialRevealIndex,
  isVoiceArcShape,
  phaseAtIndex,
  type DiscoveryArc,
} from "@/lib/patterns/discovery-arc";
import { passageStructureValid } from "@/lib/patterns/passage-fill";
import { passageToBeats } from "@/lib/patterns/passage-beats";
import { passageNeedsGeneration } from "@/lib/patterns/passage-types";
import type { PatternName } from "@/lib/patterns/vocabulary-public";
import type { PatternPassage } from "@/lib/patterns/passage-types";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary-public";
import { DiscoveryCanvas } from "@/components/patterns/discovery-canvas";
import { usePatternDisplay } from "@/hooks/use-pattern-display";
import { usePatternPassages } from "@/hooks/use-pattern-passages";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";
import { useViewportLayout } from "@/hooks/use-viewport-layout";
import { patternsColumnMaxWidth, openAppNav, OVERLAY_MENU_BUTTON_CLASS } from "@/lib/layout";
import { stashJournalQuoteFocus } from "@/lib/journal-quote-focus";
import {
  debugGroup,
  debugGroupEnd,
  debugLog,
  debugTable,
  isDebugLoggingEnabled,
} from "@/lib/debug-log";
import {
  getVote,
  putVote,
  type PatternVoteValue,
} from "@/lib/patterns/pattern-vote-store";
import {
  beginPatternSession,
  logCtaReady,
  logCtaWaiting,
  logStageAtIndex,
} from "@/lib/patterns/pattern-timing";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import { markPatternSeen } from "@/lib/patterns/pattern-view-store";
import { Menu } from "lucide-react";

export type PatternDetailViewProps = {
  patternName: PatternName;
  /** When true, render as the tab panel content (no page chrome). */
  embedded?: boolean;
  /** Hide the in-panel title (unused by the tabbed Patterns view). */
  compactHeadline?: boolean;
};

function CanvasSkeleton() {
  return (
    <div className="w-full" aria-hidden>
      <span className="block h-6 w-[55%] animate-pulse rounded bg-(--sidebar-tab-track)" />
      <span className="mt-3 block h-3.5 w-[30%] animate-pulse rounded bg-(--sidebar-hover-bg)" />
      <span className="mt-12 block h-24 w-full animate-pulse rounded bg-(--sidebar-tab-track)" />
      <span className="mt-4 block h-24 w-[85%] animate-pulse rounded bg-(--sidebar-hover-bg)" />
    </div>
  );
}

/**
 * Guided discovery - one evolving canvas, behavioral headline first.
 */
export function PatternDetailView({
  patternName,
  embedded = false,
  compactHeadline = false,
}: PatternDetailViewProps) {
  const router = useRouter();
  const viewport = useViewportLayout();
  const aggregate = usePatternsAggregate();
  const displayPatterns = usePatternDisplay(aggregate);
  const patterns = usePatternPassages(aggregate);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [readerReady, setReaderReady] = useState(false);
  const [closingVote, setClosingVote] = useState<PatternVoteValue | null>(null);
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

  // Headline + evidence need no AI, so the arc renders immediately. The CTA
  // is the only thing gated on full generation: the beat count isn't final
  // until every voice slot is filled, so the canvas hides the button (never
  // guessing between Continue/Done) until voice is ready.
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
    );
  }, [activePassage, pattern, headlineTitle]);

  const ctaReady = voiceReady && readerReady;

  useLayoutEffect(() => {
    initializedKeyRef.current = null;
    setReaderReady(false);
    timingStartedRef.current = false;
    setClosingVote(getVote(patternName)?.vote ?? null);
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
    const phase = phaseAtIndex(arc, phaseIndex);
    logStageAtIndex(phase, phaseIndex, arc.phases);
  }, [arc, phaseIndex]);

  useEffect(() => {
    if (!arc) return;
    if (ctaReady) {
      logCtaReady();
      return;
    }
    if (!readerReady) {
      logCtaWaiting("reader not ready");
    } else if (!voiceReady) {
      logCtaWaiting("voice pending");
    }
  }, [arc, ctaReady, readerReady, voiceReady]);

  useEffect(() => {
    if (!activePassage) return;
    if (!isDebugLoggingEnabled()) return;
    const beatPlan = passageToBeats(activePassage.slots, activePassage.shapeId);
    debugGroup(`[patterns] ${patternName}`);
    debugLog("PatternPassage", activePassage);
    debugLog("slots", activePassage.slots.map((s, i) => ({ i, ...s })));
    debugLog("beats (legacy)", beatPlan);
    debugLog("discovery arc", arc);
    debugLog("arc phases", arc?.phases);
    const { trace, route } = explainArc(activePassage.slots, activePassage.shapeId);
    debugLog("arc route", route);
    debugTable(trace);
    debugLog({
      shapeId: activePassage.shapeId,
      lifecycle: activePassage.lifecycle,
      needsGeneration: passageNeedsGeneration(activePassage),
      structureValid: passageStructureValid(activePassage),
      voiceTexts: activePassage.slots.flatMap((s) => {
        if (s.kind === "line") return [{ kind: "line", text: s.text }];
        if (s.kind === "close" && s.endingKind !== "quote")
          return [{ kind: "close", endingKind: s.endingKind, text: s.text }];
        return [];
      }),
    });
    debugGroupEnd();
  }, [activePassage, patternName, arc]);

  useEffect(() => {
    if (aggregate === null || embedded) return;
    if (!aggregate.surfaced.some((p) => p.name === patternName)) {
      router.replace("/dashboard/patterns");
    }
  }, [aggregate, patternName, router, embedded]);

  // Opening a pattern clears its unread state for the current evidence set.
  useEffect(() => {
    if (!pattern) return;
    markPatternSeen(pattern.name, buildEvidenceKey(pattern.evidence));
  }, [pattern]);

  // Warm journal routes for visible quotes so click → entry isn't a cold load.
  useEffect(() => {
    if (!arc) return;
    const entryIds = new Set<string>();
    for (const q of arc.evidence.visible) entryIds.add(q.entryId);
    if (arc.reflection.quote) entryIds.add(arc.reflection.quote.entryId);
    for (const id of entryIds) {
      router.prefetch(`/dashboard/journal/${id}`);
    }
  }, [arc, router]);

  const handleOpenEntry = useCallback(
    (entryId: string, quoteText?: string) => {
      if (quoteText) stashJournalQuoteFocus(entryId, quoteText);
      startTransition(() => {
        router.push(`/dashboard/journal/${entryId}`);
      });
    },
    [router],
  );

  const handleClosingVote = useCallback(
    (vote: PatternVoteValue) => {
      if (!pattern) return;
      const entryIds = pattern.evidence.map((e) => e.entryId);
      putVote(patternName, entryIds, vote);
      setClosingVote(vote);
    },
    [pattern, patternName],
  );

  const handleContinue = useCallback(() => {
    if (!arc || !ctaReady) return;
    if (phaseIndex >= arc.phases.length - 1) return;
    setPhaseIndex((i) => i + 1);
  }, [arc, ctaReady, phaseIndex]);

  if (aggregate === null || !pattern) {
    return null;
  }

  const canvas = arc ? (
    <DiscoveryCanvas
      arc={arc}
      phaseIndex={phaseIndex}
      revealKey={cacheKey}
      ctaReady={ctaReady}
      compactHeadline={compactHeadline}
      patternName={patternName}
      closingVote={closingVote}
      onClosingVote={handleClosingVote}
      onContinue={handleContinue}
      onOpenEntry={handleOpenEntry}
    />
  ) : (
    <CanvasSkeleton />
  );

  if (embedded) {
    return (
      <div
        id="pattern-tab-panel"
        role="tabpanel"
        aria-labelledby={`pattern-tab-${patternName}`}
        className="flex w-full flex-col"
      >
        {canvas}
      </div>
    );
  }

  return (
    <main
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      style={{ background: "var(--canvas-bg-gradient)" }}
    >
      <div
        className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-5 lg:px-6"
        style={{
          paddingTop: viewport.isOverlayNav
            ? `max(${viewport.patternsPagePaddingYPx / 16}rem, env(safe-area-inset-top))`
            : `${viewport.patternsPagePaddingYPx / 16}rem`,
          maxWidth: patternsColumnMaxWidth(viewport.isOverlayNav),
        }}
      >
        {viewport.isOverlayNav ? (
          <button
            type="button"
            onClick={openAppNav}
            aria-label="Open menu"
            className={OVERLAY_MENU_BUTTON_CLASS}
          >
            <Menu
              size={18}
              strokeWidth={1.85}
              aria-hidden
              className="shrink-0"
            />
          </button>
        ) : null}
        {canvas}
      </div>
    </main>
  );
}
