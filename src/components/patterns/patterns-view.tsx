"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Menu, Sprout } from "lucide-react";
import { SidebarEmptyState } from "@/components/sidebar/sidebar-empty-state";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary-public";
import type { PatternName } from "@/lib/patterns/vocabulary-public";
import { PatternDetailView } from "@/components/patterns/pattern-detail-view";
import { usePatternDisplay } from "@/hooks/use-pattern-display";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";
import { useViewportLayout } from "@/hooks/use-viewport-layout";
import {
  formatPatternTimeline,
  patternTimelineEnd,
} from "@/lib/patterns/time-hint";
import { buildEvidenceKey } from "@/lib/patterns/evidence-signals";
import { isPatternFullyReady } from "@/lib/patterns/pattern-readiness";
import { PATTERN_DISPLAY_UPDATED_EVENT } from "@/lib/patterns/pattern-display-store";
import {
  isReadyPatternUnread,
  markPatternSeen,
  PATTERN_VIEWS_UPDATED_EVENT,
} from "@/lib/patterns/pattern-view-store";
import { PATTERN_PASSAGE_UPDATED_EVENT } from "@/lib/patterns/passage-store";
import {
  btnChromeNavLink,
  btnIconChrome,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import { resolveNewEntryTarget } from "@/lib/entry-draft";
import {
  openAppNav,
  OVERLAY_MENU_BUTTON_CLASS,
  PAGE_PADDING_X_CLASS,
  patternsColumnMaxWidth,
} from "@/lib/layout";
import { useInitialSyncReady } from "@/lib/sync/use-initial-sync-ready";

function PatternsListSkeleton() {
  return (
    <ul
      className="flex flex-col gap-2"
      aria-busy="true"
      aria-label="Loading patterns"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <li
          key={i}
          className="rounded-[0.625rem] border border-(--border)/60 px-4 py-4"
          aria-hidden
        >
          <span className="block h-4 w-[42%] animate-pulse rounded-sm bg-(--sidebar-ink)/12" />
          <span className="mt-2 block h-3 w-[58%] animate-pulse rounded-sm bg-(--sidebar-ink)/8" />
        </li>
      ))}
    </ul>
  );
}

const formatEntryCount = (count: number): string =>
  count === 1 ? "Spotted in 1 moment" : `Spotted in ${count} moments`;

export type PatternsViewProps = {
  /** Prefill expansion (e.g. legacy `/patterns/[name]` deep link). */
  initialPattern?: PatternName;
};

/**
 * Patterns - collapsible list. Rows show title + date/entry meta; tapping
 * expands the detail view inside the same card. Only one pattern open at a
 * time. "What's the pattern here?" advances phases in that panel.
 */
export function PatternsView({ initialPattern }: PatternsViewProps = {}) {
  const router = useRouter();
  const viewport = useViewportLayout();
  const initialSyncReady = useInitialSyncReady();
  const aggregate = usePatternsAggregate();
  const patterns = usePatternDisplay(aggregate);
  const itemRefs = useRef<Map<PatternName, HTMLLIElement>>(new Map());
  const [readinessTick, setReadinessTick] = useState(0);
  const [viewsTick, setViewsTick] = useState(0);

  useEffect(() => {
    const bump = () => setReadinessTick((t) => t + 1);
    const bumpViews = () => setViewsTick((t) => t + 1);
    const onStorage = () => {
      bump();
      bumpViews();
    };
    window.addEventListener(PATTERN_DISPLAY_UPDATED_EVENT, bump);
    window.addEventListener(PATTERN_PASSAGE_UPDATED_EVENT, bump);
    window.addEventListener(PATTERN_VIEWS_UPDATED_EVENT, bumpViews);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PATTERN_DISPLAY_UPDATED_EVENT, bump);
      window.removeEventListener(PATTERN_PASSAGE_UPDATED_EVENT, bump);
      window.removeEventListener(PATTERN_VIEWS_UPDATED_EVENT, bumpViews);
      window.removeEventListener("storage", onStorage);
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

  const unreadNames = useMemo(() => {
    const names = new Set<PatternName>();
    for (const pattern of listPatterns) {
      if (isReadyPatternUnread(pattern)) names.add(pattern.name);
    }
    return names;
  }, [listPatterns, viewsTick]);

  const hasReadyPatterns = listPatterns.length > 0;
  // Aggregate not read yet, or empty local cache while cloud sync still filling in.
  const showPatternsSkeleton =
    aggregate === null || (!initialSyncReady && !hasReadyPatterns);
  const showPatternsHeading = !showPatternsSkeleton && hasReadyPatterns;

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

  // Opening a pattern clears its unread state for the current evidence set.
  useEffect(() => {
    if (!expanded) return;
    const pattern = listPatterns.find((p) => p.name === expanded);
    if (!pattern) return;
    markPatternSeen(pattern.name, buildEvidenceKey(pattern.evidence));
  }, [expanded, listPatterns]);

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

  const handleStartEntry = () => {
    const { id } = resolveNewEntryTarget();
    router.push(`/dashboard/journal/${id}?new=1`);
  };

  if (aggregate === null) {
    return null;
  }

  return (
    <main
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      style={{
        // Match Entry writing canvas (`CANVAS_BACKGROUND`).
        background: "var(--canvas-bg-gradient)",
        paddingTop:
          viewport.isOverlayNav
            ? `max(${viewport.patternsPagePaddingYPx / 16}rem, env(safe-area-inset-top))`
            : `${viewport.patternsPagePaddingYPx / 16}rem`,
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        scrollPaddingTop: `${viewport.patternsPagePaddingYPx / 16}rem`,
      }}
    >
      <div
        className={`mx-auto flex w-full min-w-0 flex-1 flex-col ${PAGE_PADDING_X_CLASS}`}
        style={{ maxWidth: patternsColumnMaxWidth(viewport.isOverlayNav) }}
      >
        <header className="mb-5 flex shrink-0 flex-col items-stretch sm:mb-6">
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
          {showPatternsHeading ? (
            <>
              <div className="flex h-9 shrink-0 items-center">
                <h1 className="header-md tracking-tight">Patterns</h1>
              </div>
              <p className=" text-sm leading-relaxed text-(--sidebar-ink-soft) sm:text-sm">
              Here's what your writing keeps circling back to
              </p>
            </>
          ) : null}
        </header>

        {showPatternsSkeleton ? <PatternsListSkeleton /> : null}

        {!showPatternsSkeleton && !hasReadyPatterns ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16">
            <SidebarEmptyState
              icon={Sprout}
              title="No pattern yet"
              body="Keep writing, when a thought keeps returning, it will show up here."
              action={
                <button
                  type="button"
                  onClick={handleStartEntry}
                  className={btnChromeNavLink}
                >
                  Start a entry
                </button>
              }
            />
          </div>
        ) : null}

        {!showPatternsSkeleton && hasReadyPatterns ? (
        <ul className="pattern-accordion" aria-label="Patterns">
          {listPatterns.map((pattern) => {
            const title =
              pattern.display?.displayTitle?.trim() ||
              PATTERN_LABELS[pattern.name];
            const isOpen = expanded === pattern.name;
            const isUnread = unreadNames.has(pattern.name);
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
                data-unread={isUnread ? "true" : "false"}
              >
                <button
                  type="button"
                  className="pattern-accordion__row"
                  aria-expanded={isOpen}
                  aria-controls={
                    isOpen
                      ? `pattern-expanded-panel-${pattern.name}`
                      : undefined
                  }
                  aria-label={
                    [title, factLine, isUnread ? "updated" : null]
                      .filter(Boolean)
                      .join(", ")
                  }
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
        ) : null}
      </div>
    </main>
  );
}
