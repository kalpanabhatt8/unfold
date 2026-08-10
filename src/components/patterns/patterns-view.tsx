"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Menu } from "lucide-react";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary-public";
import type { PatternName } from "@/lib/patterns/vocabulary-public";
import { usePatternDisplay } from "@/hooks/use-pattern-display";
import { usePatternsAggregate } from "@/hooks/use-patterns-aggregate";
import { useViewportLayout } from "@/hooks/use-viewport-layout";
import {
  formatPatternTimeline,
  patternTimelineEnd,
} from "@/lib/patterns/time-hint";
import { isPatternFullyReady } from "@/lib/patterns/pattern-readiness";
import { PATTERN_DISPLAY_UPDATED_EVENT } from "@/lib/patterns/pattern-display-store";
import {
  isReadyPatternUnread,
  PATTERN_VIEWS_UPDATED_EVENT,
} from "@/lib/patterns/pattern-view-store";
import { PATTERN_PASSAGE_UPDATED_EVENT } from "@/lib/patterns/passage-store";
import { iconFixed } from "@/components/ui/button-system";
import {
  openAppNav,
  PAGE_PADDING_X_CLASS,
  patternsColumnMaxWidth,
} from "@/lib/layout";

const formatEntryCount = (count: number): string =>
  count === 1 ? "Spotted in 1 moment" : `Spotted in ${count} moments`;

/**
 * Patterns index - navigable list into dedicated pattern detail pages.
 */
export function PatternsView() {
  const router = useRouter();
  const viewport = useViewportLayout();
  const aggregate = usePatternsAggregate();
  const patterns = usePatternDisplay(aggregate);
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

  useEffect(() => {
    if (aggregate === null) return;
    if (!hasReadyPatterns) {
      router.replace("/dashboard");
    }
  }, [aggregate, hasReadyPatterns, router]);

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
          <h1 className="header-md tracking-tight">Patterns</h1>
          <p className="mt-1 text-xs leading-relaxed text-(--sidebar-ink-soft) sm:text-sm">
            A few thoughts have been returning lately.
          </p>
        </header>

        <ul className="pattern-accordion" aria-label="Patterns">
          {listPatterns.map((pattern) => {
            const title =
              pattern.display?.displayTitle?.trim() ||
              PATTERN_LABELS[pattern.name];
            const isUnread = unreadNames.has(pattern.name);
            const entryCount =
              pattern.entryCount > 0
                ? pattern.entryCount
                : pattern.evidence.length;
            const entryLabel = formatEntryCount(entryCount);
            const timeline = formatPatternTimeline(pattern.evidence);
            const factLine = [timeline, entryLabel].filter(Boolean).join(" · ");
            const href = `/dashboard/patterns/${encodeURIComponent(pattern.name)}`;

            return (
              <li
                key={pattern.name}
                className="pattern-accordion__item group"
                data-unread={isUnread ? "true" : "false"}
              >
                <Link
                  href={href}
                  className="pattern-accordion__row"
                  aria-label={
                    [title, factLine, isUnread ? "updated" : null]
                      .filter(Boolean)
                      .join(", ")
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
                    className="flex h-7 w-7 shrink-0 items-center justify-center text-(--sidebar-ink-soft) opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-hidden
                  >
                    <ChevronRight
                      size={16}
                      strokeWidth={1.75}
                      className={iconFixed}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
