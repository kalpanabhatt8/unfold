"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { DiscoveryArc, DiscoveryPhase } from "@/lib/patterns/discovery-arc";
import {
  discoveryContinueLabel,
  hasReachedPhase,
  phaseAtIndex,
  phaseIndex,
} from "@/lib/patterns/discovery-arc";
import { EvidenceSection } from "@/components/patterns/evidence-section";
import { JournalSnippet } from "@/components/patterns/journal-snippet";
import { MechanismChain } from "@/components/patterns/mechanism-chain";
import { RecurrenceCard } from "@/components/patterns/recurrence-card";
import {
  discoveryQuestionIsReading,
  discoveryQuestionTypographyStyle,
} from "@/lib/patterns/display-typography";
import {
  logMechanismRendered,
  logPopoverReady,
  logQuestionRendered,
  logQuotesRendered,
} from "@/lib/patterns/pattern-timing";

export type DiscoveryCanvasProps = {
  arc: DiscoveryArc;
  phaseIndex: number;
  /** Resets scroll behavior when the passage changes. */
  revealKey?: string;
  /** When false, the CTA waits (voice text still arriving). */
  ctaReady?: boolean;
  onContinue: () => void;
  onOpenEntry: (entryId: string, quoteText?: string) => void;
};

/** How long one reveal takes — Continue is locked for this window. */
const REVEAL_MS = 550;

/**
 * Gap between the pinned heading and the repositioned focus beat. Must be
 * larger than the scroll container's top fade mask (1.5rem = 24px) so the
 * focus beat settles fully below the fade, never dimmed by it.
 */
const FOCUS_SCROLL_OFFSET_PX = 36;

const layerAge = (
  arc: DiscoveryArc,
  phase: DiscoveryPhase,
  currentIndex: number,
): number => {
  const idx = arc.phases.indexOf(phase);
  if (idx < 0 || currentIndex < idx) return -1;
  return currentIndex - idx;
};

const layerState = (age: number): "focus" | "past" | "distant" => {
  if (age === 0) return "focus";
  if (age === 1) return "past";
  return "distant";
};

type LayerProps = {
  phase: DiscoveryPhase;
  age: number;
  isFocus: boolean;
  focusRef: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
};

function Layer({
  phase,
  age,
  isFocus,
  focusRef,
  className = "",
  children,
}: LayerProps) {
  if (age < 0) return null;
  return (
    <section
      ref={isFocus ? focusRef : undefined}
      className={`discovery-layer ${className}`}
      data-phase={phase}
      data-state={layerState(age)}
      data-age={age}
    >
      {children}
    </section>
  );
}

function ClosingLayer({
  closing,
  animate,
  onOpenEntry,
}: {
  closing: NonNullable<DiscoveryArc["closing"]>;
  animate: boolean;
  onOpenEntry: (entryId: string, quoteText?: string) => void;
}) {
  if (closing.kind === "silence") {
    return (
      <p className="discovery-silence text-[1.05rem] leading-relaxed text-(--sidebar-ink)">
        {closing.text}
      </p>
    );
  }

  if (closing.kind === "drift") {
    return (
      <div className="discovery-drift grid gap-5 sm:grid-cols-2 sm:gap-8">
        <JournalSnippet quote={closing.early} onOpenEntry={onOpenEntry} />
        <JournalSnippet quote={closing.recent} onOpenEntry={onOpenEntry} />
      </div>
    );
  }

  if (closing.kind === "phrase") {
    return (
      <p
        className="discovery-phrase text-[1.25rem] font-medium leading-snug tracking-tight text-(--sidebar-ink)"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {closing.phrase}
      </p>
    );
  }

  return (
    <MechanismChain
      text={closing.text}
      steps={closing.steps}
      animate={animate}
      onOpenEntry={onOpenEntry}
    />
  );
}

/**
 * One evolving reflection canvas.
 * Beat order: Headline → Moments → Recurrence → Loop → reflection.
 */
export function DiscoveryCanvas({
  arc,
  phaseIndex: currentIndex,
  revealKey = "",
  ctaReady = true,
  onContinue,
  onOpenEntry,
}: DiscoveryCanvasProps) {
  const lockedUntilRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const focusRef = useRef<HTMLElement | null>(null);
  const skipScrollRef = useRef(true);
  const focusPhase = phaseAtIndex(arc, currentIndex);

  const evidenceIdx = phaseIndex(arc, "evidence");
  const headlineFaded =
    evidenceIdx >= 0 ? currentIndex >= evidenceIdx : currentIndex > 0;

  const evidenceVisible =
    hasReachedPhase(arc, currentIndex, "evidence") &&
    arc.evidence.visible.length > 0;
  const recurrenceVisible =
    hasReachedPhase(arc, currentIndex, "recurrence") &&
    arc.recurrence !== null;
  const closingVisible =
    hasReachedPhase(arc, currentIndex, "closing") && arc.closing !== null;
  const questionVisible =
    hasReachedPhase(arc, currentIndex, "reflection") &&
    (arc.reflection.quote !== null || arc.reflection.question.trim().length > 0);

  useEffect(() => {
    if (!evidenceVisible) return;
    logQuotesRendered(arc.evidence.visible.length);
    if (arc.evidence.overflow.length > 0) {
      logPopoverReady(arc.evidence.overflow.length);
    }
  }, [evidenceVisible, arc.evidence.visible.length, arc.evidence.overflow.length]);

  useEffect(() => {
    if (!closingVisible) return;
    if (arc.closing?.kind === "mechanism" && arc.closing.text.trim()) {
      logMechanismRendered();
    }
  }, [closingVisible, arc.closing]);

  useEffect(() => {
    if (!questionVisible) return;
    logQuestionRendered();
  }, [questionVisible]);

  const age = (phase: DiscoveryPhase) => layerAge(arc, phase, currentIndex);

  const handleContinue = useCallback(() => {
    const now = Date.now();
    if (now < lockedUntilRef.current) return;
    lockedUntilRef.current = now + REVEAL_MS;
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    skipScrollRef.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [revealKey]);

  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }

    const container = scrollRef.current;
    const layer = focusRef.current;
    if (!container || !layer) return;

    const timer = window.setTimeout(() => {
      const containerRect = container.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      const targetTop =
        container.scrollTop +
        (layerRect.top - containerRect.top) -
        FOCUS_SCROLL_OFFSET_PX;
      container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [currentIndex]);

  return (
    <article className="discovery-canvas flex h-full min-h-0 w-full max-w-[min(92vw,700px)] flex-col">
      <header
        className="discovery-headline shrink-0"
        data-faded={headlineFaded ? "true" : "false"}
      >
        <h1
          className="text-[1.25rem] font-semibold leading-snug tracking-tight text-(--sidebar-ink) sm:text-[1.375rem]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {arc.headline.title}
        </h1>
        <p className="reflection-meta mt-2">{arc.headline.orienting}</p>
      </header>

      <div
        ref={scrollRef}
        className="discovery-scroll min-h-0 flex-1 overscroll-y-contain"
      >
        <div className="discovery-stream">
          {evidenceVisible ? (
            <Layer
              phase="evidence"
              age={age("evidence")}
              isFocus={focusPhase === "evidence"}
              focusRef={focusRef}
            >
              <EvidenceSection
                visible={arc.evidence.visible}
                overflow={arc.evidence.overflow}
                onOpenEntry={onOpenEntry}
                label="These moments kept showing up"
              />
            </Layer>
          ) : null}

          {recurrenceVisible && arc.recurrence ? (
            <Layer
              phase="recurrence"
              age={age("recurrence")}
              isFocus={focusPhase === "recurrence"}
              focusRef={focusRef}
            >
              <RecurrenceCard
                card={arc.recurrence}
                onOpenEntry={onOpenEntry}
              />
            </Layer>
          ) : null}

          {closingVisible && arc.closing ? (
            <Layer
              phase="closing"
              age={age("closing")}
              isFocus={focusPhase === "closing"}
              focusRef={focusRef}
            >
              <ClosingLayer
                closing={arc.closing}
                animate={focusPhase === "closing"}
                onOpenEntry={onOpenEntry}
              />
            </Layer>
          ) : null}

          {questionVisible ? (
            <Layer
              phase="reflection"
              age={age("reflection")}
              isFocus={focusPhase === "reflection"}
              focusRef={focusRef}
            >
              {arc.reflection.quote ? (
                <JournalSnippet
                  quote={arc.reflection.quote}
                  onOpenEntry={onOpenEntry}
                />
              ) : (
                <p
                  className="discovery-question discovery-question--final"
                  style={discoveryQuestionTypographyStyle(
                    arc.reflection.question,
                  )}
                  data-reading={
                    discoveryQuestionIsReading(arc.reflection.question)
                      ? "true"
                      : undefined
                  }
                >
                  {arc.reflection.question}
                </p>
              )}
            </Layer>
          ) : null}

          <div className="discovery-tail" aria-hidden />
        </div>
      </div>

      <footer className="discovery-footer shrink-0">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!ctaReady}
            className="text-[0.8125rem] tracking-[0.01em] text-(--sidebar-ink-soft) transition-colors duration-150 hover:text-(--sidebar-ink) disabled:cursor-default disabled:opacity-40"
          >
            {ctaReady ? discoveryContinueLabel(arc, currentIndex) : "a moment…"}
          </button>
        </div>
      </footer>
    </article>
  );
}
