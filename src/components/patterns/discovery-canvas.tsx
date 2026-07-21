"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronRight } from "lucide-react";
import type { DiscoveryArc, DiscoveryPhase } from "@/lib/patterns/discovery-arc";
import {
  discoveryContinueLabel,
  hasReachedPhase,
  phaseAtIndex,
} from "@/lib/patterns/discovery-arc";
import { ClosingVote } from "@/components/patterns/closing-vote";
import { EvidenceSection } from "@/components/patterns/evidence-section";
import { JournalSnippet } from "@/components/patterns/journal-snippet";
import { MechanismChain } from "@/components/patterns/mechanism-chain";
import type { PatternVoteValue } from "@/lib/patterns/pattern-vote-store";
import {
  logMechanismRendered,
  logQuestionRendered,
  logQuotesRendered,
} from "@/lib/patterns/pattern-timing";
import {
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";

export type DiscoveryCanvasProps = {
  arc: DiscoveryArc;
  phaseIndex: number;
  /** Resets when the passage changes (parent may remount on key). */
  revealKey?: string;
  /** When false, the CTA waits (voice text still arriving). */
  ctaReady?: boolean;
  /** When true, skip the in-panel pattern title. */
  compactHeadline?: boolean;
  /** Pattern id for downvote reason attribution. */
  patternName?: string;
  /** Current thumbs vote for this pattern closing, if any. */
  closingVote?: PatternVoteValue | null;
  onClosingVote?: (vote: PatternVoteValue) => void;
  onContinue: () => void;
  onOpenEntry: (entryId: string, quoteText?: string) => void;
};

/** How long one reveal takes — Continue is locked for this window. */
const REVEAL_MS = 550;

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
 * Guided reflection canvas. Beats reveal one at a time; Continue scrolls
 * the new beat into view on the page (no nested theater / fake height).
 */
export function DiscoveryCanvas({
  arc,
  phaseIndex: currentIndex,
  revealKey = "",
  ctaReady = true,
  compactHeadline = false,
  patternName,
  closingVote = null,
  onClosingVote,
  onContinue,
  onOpenEntry,
}: DiscoveryCanvasProps) {
  const lockedUntilRef = useRef(0);
  const focusRef = useRef<HTMLElement | null>(null);
  /** Only auto-scroll after Continue — never on first paint. */
  const allowAutoScrollRef = useRef(false);
  const focusPhase = phaseAtIndex(arc, currentIndex);

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
  }, [evidenceVisible, arc.evidence.visible.length]);

  useEffect(() => {
    if (!mechanismVisible || !arc.mechanism?.text.trim()) return;
    logMechanismRendered();
  }, [mechanismVisible, arc.mechanism?.text]);

  useEffect(() => {
    if (!questionVisible) return;
    logQuestionRendered();
  }, [questionVisible]);

  const age = (phase: DiscoveryPhase) => layerAge(arc, phase, currentIndex);
  const isFinalPhase = currentIndex >= arc.phases.length - 1;
  const showInlineTitle =
    !compactHeadline && arc.headline.title.trim().length > 0;

  const handleContinue = useCallback(() => {
    const now = Date.now();
    if (now < lockedUntilRef.current) return;
    if (isFinalPhase) return;
    lockedUntilRef.current = now + REVEAL_MS;
    allowAutoScrollRef.current = true;
    onContinue();
  }, [isFinalPhase, onContinue]);

  useEffect(() => {
    allowAutoScrollRef.current = false;
  }, [revealKey]);

  // After Continue: park the new beat near the top of the page scroll.
  // Previous beats stay in the document above — no nested scrollport.
  useEffect(() => {
    if (!allowAutoScrollRef.current) return;

    let cancelled = false;
    let attempts = 0;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const run = () => {
      if (cancelled) return;
      const layer = focusRef.current;
      if (!layer) {
        if (attempts < 20) {
          attempts += 1;
          window.requestAnimationFrame(run);
        }
        return;
      }
      layer.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    };

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(run);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [currentIndex]);

  return (
    <article
      className="discovery-canvas flex w-full flex-col"
      data-phase={focusPhase}
      data-settled={isFinalPhase ? "true" : "false"}
    >
      <div className="discovery-scroll">
        <div className="discovery-stream">
          {showInlineTitle ? (
            <header className="discovery-headline">
              <h2
                className="pattern-content-title font-medium tracking-tight text-(--sidebar-ink)"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {arc.headline.title}
              </h2>
            </header>
          ) : null}

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
                onOpenEntry={onOpenEntry}
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
                  featured
                />
              ) : (
                <p className="discovery-question discovery-question--final">
                  {arc.reflection.question}
                </p>
              )}
              {onClosingVote ? (
                <ClosingVote
                  patternName={patternName}
                  value={closingVote ?? null}
                  onVote={onClosingVote}
                />
              ) : null}
            </Layer>
          ) : null}
        </div>
      </div>

      <footer className="discovery-footer shrink-0">
        <div className="flex justify-end">
          {isFinalPhase ? null : (
            <button
              type="button"
              onClick={handleContinue}
              disabled={!ctaReady}
              className="inline-flex min-h-(--touch-target-min) items-center gap-0.5 px-1 text-sm tracking-[0.01em] text-(--sidebar-ink-soft) transition-colors duration-150 hover:text-(--sidebar-ink) disabled:cursor-default disabled:opacity-40"
            >
              {ctaReady ? (
                <>
                  <span>{discoveryContinueLabel(arc, currentIndex)}</span>
                  <ChevronRight
                    size={iconPx("xs")}
                    strokeWidth={iconStroke("xs")}
                    className={iconFixed}
                    aria-hidden
                  />
                </>
              ) : (
                "a moment…"
              )}
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}
