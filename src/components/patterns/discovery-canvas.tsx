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
  onOpenEntry: (entryId: string) => void;
};

/** How long one reveal takes — Continue is locked for this window. */
const REVEAL_MS = 550;

/**
 * Gap between the pinned heading and the repositioned focus beat. Must be
 * larger than the scroll container's top fade mask (1.5rem = 24px) so the
 * focus beat settles fully below the fade, never dimmed by it.
 */
const FOCUS_SCROLL_OFFSET_PX = 36;

/**
 * Distance of a layer from the current focus, in revealed beats.
 * 0 = focus, 1 = previous, 2+ = older history.
 */
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

/** One deposited layer of the unfolding page — never replaced, only recedes. */
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

/**
 * One evolving reflection canvas. The heading stays pinned at the top and
 * the CTA at the bottom; between them a single scrollable stream grows
 * downward. Each Continue deposits the next beat below the previous ones,
 * which recede upward but stay readable.
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
  const mechanismVisible =
    hasReachedPhase(arc, currentIndex, "mechanism") && arc.mechanism !== null;
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
    if (!mechanismVisible || !arc.mechanism?.text.trim()) return;
    logMechanismRendered();
  }, [mechanismVisible, arc.mechanism?.text]);

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

    // Let the reveal animation start before repositioning, then place the
    // new beat directly below the pinned heading.
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
          {hasReachedPhase(arc, currentIndex, "evidence") &&
          arc.evidence.visible.length > 0 ? (
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

          {hasReachedPhase(arc, currentIndex, "mechanism") &&
          arc.mechanism ? (
            <Layer
              phase="mechanism"
              age={age("mechanism")}
              isFocus={focusPhase === "mechanism"}
              focusRef={focusRef}
            >
              <MechanismChain
                text={arc.mechanism.text}
                animate={focusPhase === "mechanism"}
              />
            </Layer>
          ) : null}

          {hasReachedPhase(arc, currentIndex, "reflection") &&
          (arc.reflection.quote || arc.reflection.question.trim()) ? (
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
                <p className="discovery-question discovery-question--final">
                  {arc.reflection.question}
                </p>
              )}
            </Layer>
          ) : null}

          {/* Runway so even a short focus beat can scroll up under the heading. */}
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
