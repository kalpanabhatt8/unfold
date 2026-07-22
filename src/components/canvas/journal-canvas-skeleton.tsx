"use client";

/**
 * Canvas placeholder that mirrors CanvasBoard layout — same gradient, column
 * width, header grid, and journal-block spacing — while entry data loads.
 */

import { useViewportLayout } from "@/hooks/use-viewport-layout";
import {
  CONTENT_COLUMN_MAX_WIDTH,
  PAGE_PADDING_X_CLASS,
} from "@/lib/layout";

const CANVAS_BACKGROUND = "var(--canvas-bg-gradient)";

const BODY_LINES: ReadonlyArray<{ width: string; lastInPara?: boolean }> = [
  { width: "w-[94%]" },
  { width: "w-[88%]" },
  { width: "w-[72%]", lastInPara: true },
  { width: "w-[90%]" },
  { width: "w-[84%]" },
  { width: "w-[60%]", lastInPara: true },
  { width: "w-[86%]" },
  { width: "w-[48%]" },
];

export function JournalCanvasSkeleton() {
  const viewport = useViewportLayout();
  const pagePaddingY = viewport.pagePaddingYPx;

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      style={{ background: CANVAS_BACKGROUND }}
      aria-busy="true"
      aria-label="Loading journal"
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
          style={{
            paddingTop: `${pagePaddingY / 16}rem`,
            paddingBottom: `${pagePaddingY / 16}rem`,
          }}
        >
          <div
            className={`mx-auto flex w-full min-h-0 min-w-0 flex-1 flex-col ${PAGE_PADDING_X_CLASS}`}
            style={{ maxWidth: CONTENT_COLUMN_MAX_WIDTH }}
          >
            <header
              className="mb-8 grid w-full grid-cols-1 items-end gap-y-1.5 sm:mb-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4 sm:gap-y-0 md:gap-x-6 lg:mb-14 lg:gap-x-8 xl:gap-x-12"
              aria-hidden
            >
              <span className="col-start-1 row-start-1 block h-[1.3em] w-[42%] max-w-[16rem] animate-pulse self-end rounded-sm bg-(--canvas-title-ink)/12 sm:w-[38%]" />
              <span className="col-start-1 row-start-2 mt-0.5 block h-3 w-38 animate-pulse rounded-sm bg-(--canvas-date-time)/35 sm:col-start-2 sm:row-start-1 sm:mt-0 sm:mb-1 sm:justify-self-end sm:w-40" />
            </header>

            <div className="relative flex w-full min-h-0 flex-1 flex-col" aria-hidden>
              <div className="journal-tiptap flex w-full min-h-0 flex-1 flex-col">
                <div className="flex flex-col">
                  {BODY_LINES.map((line, i) => (
                    <span
                      key={i}
                      className={`block h-[1.15em] animate-pulse rounded-sm bg-(--canvas-ink)/10 ${line.width} ${
                        line.lastInPara
                          ? "mb-[1.35em] sm:mb-[1.75em]"
                          : "mb-[0.45em]"
                      }`}
                      style={{
                        fontSize: "var(--text-md)",
                        lineHeight: 1.85,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
