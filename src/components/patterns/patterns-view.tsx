"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Menu } from "lucide-react";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary";
import type { PatternName } from "@/lib/patterns/vocabulary";
import { PatternDetailView } from "@/components/patterns/pattern-detail-view";
import { usePatternDisplay } from "@/hooks/use-pattern-display";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";
import { useViewportLayout } from "@/hooks/use-viewport-layout";
import {
  formatPatternTimeline,
  patternTimelineEnd,
} from "@/lib/patterns/time-hint";
import { isPatternFullyReady } from "@/lib/patterns/pattern-readiness";
import { PATTERN_DISPLAY_UPDATED_EVENT } from "@/lib/patterns/pattern-display-store";
import { PATTERN_PASSAGE_UPDATED_EVENT } from "@/lib/patterns/passage-store";
import {
  btnIconChrome,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import {
  openAppNav,
  PAGE_PADDING_X_CLASS,
  patternsColumnMaxWidth,
} from "@/lib/layout";
import "@/lib/patterns/passage-debug";

const formatEntryCount = (count: number): string =>
  count === 1 ? "1 entry" : `${count} entries`;

export type PatternsViewProps = {
  /** Prefill expansion (e.g. legacy `/patterns/[name]` deep link). */
  initialPattern?: PatternName;
};

/**
 * Patterns — collapsible list. Rows show title + date/entry meta; tapping
 * expands the detail view (quotes only inside the panel, not the header).
 * Only one pattern open at a time. The same header toggles collapse on click.
 */
export function PatternsView({ initialPattern }: PatternsViewProps = {}) {
  const router = useRouter();
  const viewport = useViewportLayout();
  const aggregate = usePatternsAggregate();
  const patterns = usePatternDisplay(aggregate);
  const itemRefs = useRef<Map<PatternName, HTMLLIElement>>(new Map());
  const [readinessTick, setReadinessTick] = useState(0);

  useEffect(() => {
    const bump = () => setReadinessTick((t) => t + 1);
    window.addEventListener(PATTERN_DISPLAY_UPDATED_EVENT, bump);
    window.addEventListener(PATTERN_PASSAGE_UPDATED_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(PATTERN_DISPLAY_UPDATED_EVENT, bump);
      window.removeEventListener(PATTERN_PASSAGE_UPDATED_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  const listPatterns = useMemo(() => {
    if (aggregate === null) return [];
    const enriched = patterns.length > 0 ? patterns : aggregate.surfaced;
    const ready = enriched.filter((pattern) => isPatternFullyReady(pattern));
    return [...ready].sort(
      (a, b) =>
        patternTimelineEnd(b.evidence) - patternTimelineEnd(a.evidence),
    );
  }, [aggregate, patterns, readinessTick]);

  const hasReadyPatterns = listPatterns.length > 0;

  useEffect(() => {
    if (aggregate === null) return;
    if (!hasReadyPatterns) {
      router.replace("/dashboard");
    }
  }, [aggregate, hasReadyPatterns, router]);

  /** null = all collapsed. */
  const [expanded, setExpanded] = useState<PatternName | null>(
    initialPattern ?? null,
  );

  // Drop expansion if that pattern leaves the list; honor deep-link once ready.
  useEffect(() => {
    if (listPatterns.length === 0) {
      setExpanded(null);
      return;
    }
    setExpanded((prev) => {
      if (prev && listPatterns.some((p) => p.name === prev)) return prev;
      if (
        initialPattern &&
        listPatterns.some((p) => p.name === initialPattern)
      ) {
        return initialPattern;
      }
      return null;
    });
  }, [listPatterns, initialPattern]);

  // After expand: pin the persistent header near the top of the viewport.
  useEffect(() => {
    if (!expanded) return;
    const el = itemRefs.current.get(expanded);
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const run = () => {
      const heading = el.querySelector<HTMLElement>(
        ".pattern-accordion__row",
      );
      (heading ?? el).scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    };
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(run);
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [expanded]);

  if (aggregate === null || !hasReadyPatterns) {
    return null;
  }

  return (
    <main
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-(--app-bg)"
      style={{
        paddingTop:
          viewport.isOverlayNav
            ? `max(${viewport.patternsPagePaddingYPx / 16}rem, env(safe-area-inset-top))`
            : `${viewport.patternsPagePaddingYPx / 16}rem`,
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        scrollPaddingTop: `${viewport.patternsPagePaddingYPx / 16}rem`,
      }}
    >
      <div
        className={`mx-auto flex w-full min-w-0 flex-col ${PAGE_PADDING_X_CLASS}`}
        style={{ maxWidth: patternsColumnMaxWidth(viewport.isOverlayNav) }}
      >
        <header className="mb-5 flex shrink-0 flex-col items-stretch sm:mb-6">
          {viewport.isOverlayNav ? (
            <button
              type="button"
              onClick={openAppNav}
              aria-label="Open menu"
              className="mb-1.5 flex h-11 w-11 shrink-0 items-center justify-center text-(--sidebar-ink) transition-colors duration-150 hover:text-(--sidebar-active-ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            >
              <Menu
                size={18}
                strokeWidth={1.85}
                aria-hidden
                className="shrink-0"
              />
            </button>
          ) : null}
          <h1
            className="header-lg font-medium tracking-tight text-(--sidebar-active-ink)"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Patterns
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-(--sidebar-ink-soft) sm:text-sm">
            A few thoughts have been returning lately.
          </p>
        </header>

        <ul className="pattern-accordion" aria-label="Patterns">
          {listPatterns.map((pattern) => {
            const title =
              pattern.display?.displayTitle?.trim() ||
              PATTERN_LABELS[pattern.name];
            const isOpen = expanded === pattern.name;
            const entryCount =
              pattern.entryCount > 0
                ? pattern.entryCount
                : pattern.evidence.length;
            const entryLabel = formatEntryCount(entryCount);
            const timeline = formatPatternTimeline(pattern.evidence);
            const factLine = [timeline, entryLabel].filter(Boolean).join(" · ");

            return (
              <li
                key={pattern.name}
                ref={(node) => {
                  if (node) itemRefs.current.set(pattern.name, node);
                  else itemRefs.current.delete(pattern.name);
                }}
                className="pattern-accordion__item"
                data-expanded={isOpen ? "true" : "false"}
              >
                <button
                  type="button"
                  className="pattern-accordion__row"
                  aria-expanded={isOpen}
                  aria-controls={
                    isOpen ? `pattern-expanded-panel-${pattern.name}` : undefined
                  }
                  aria-label={factLine ? `${title}, ${factLine}` : title}
                  id={`pattern-expanded-${pattern.name}`}
                  onClick={() =>
                    setExpanded((prev) =>
                      prev === pattern.name ? null : pattern.name,
                    )
                  }
                >
                  <span className="pattern-accordion__row-main">
                    <span className="pattern-accordion__row-title">
                      {title}
                    </span>
                    {factLine ? (
                      <span className="pattern-accordion__row-fact">
                        {factLine}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`pattern-accordion__row-chevron shrink-0 ${btnIconChrome("xs")}`}
                    aria-hidden
                  >
                    {isOpen ? (
                      <ChevronUp
                        size={iconPx("xs")}
                        strokeWidth={iconStroke("xs")}
                        className={iconFixed}
                      />
                    ) : (
                      <ChevronDown
                        size={iconPx("xs")}
                        strokeWidth={iconStroke("xs")}
                        className={iconFixed}
                      />
                    )}
                  </span>
                </button>

                {isOpen ? (
                  <div
                    id={`pattern-expanded-panel-${pattern.name}`}
                    className="pattern-accordion__panel"
                    role="region"
                    aria-labelledby={`pattern-expanded-${pattern.name}`}
                  >
                    <div className="pattern-accordion__panel-scroll">
                      <PatternDetailView
                        key={pattern.name}
                        patternName={pattern.name}
                        embedded
                        compactHeadline
                      />
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
