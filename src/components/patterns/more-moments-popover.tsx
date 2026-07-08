"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { QuoteRef } from "@/lib/patterns/evidence-signals";

const formatDay = (ts: number): string => {
  const date = new Date(ts);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

export type MoreMomentsPopoverProps = {
  quotes: QuoteRef[];
  count: number;
  onOpenEntry: (entryId: string) => void;
};

const HIDE_DELAY_MS = 150;

/** Hover-anchored peek into remaining journal moments — not a modal. */
export function MoreMomentsPopover({
  quotes,
  count,
  onOpenEntry,
}: MoreMomentsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const width = Math.min(352, window.innerWidth - 20);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPosition({ top: rect.top - gap, left });
  }, []);

  const show = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      setPosition(null);
    }, HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        className="reflection-meta inline-block cursor-default underline decoration-(--sidebar-border) decoration-1 underline-offset-[0.2em] transition-colors duration-150 hover:text-(--sidebar-ink)"
      >
        +{count} more moment{count === 1 ? "" : "s"}
      </span>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="more-moments-peek fixed z-50 w-[min(22rem,calc(100vw-2.5rem))]"
              style={{
                top: position.top,
                left: position.left,
                transform: "translateY(-100%)",
              }}
              onMouseEnter={show}
              onMouseLeave={scheduleHide}
            >
              <ul className="flex flex-col gap-1 p-2">
                {quotes.map((quote, i) => (
                  <li
                    key={`${quote.entryId}-${i}`}
                    className="group relative rounded-md transition-colors duration-150 hover:bg-(--sidebar-hover-bg)"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenEntry(quote.entryId)}
                      className="w-full rounded-md text-left"
                    >
                      <div className="flex flex-col gap-0.5 px-2.75 py-2.5">
                        <span className="flex items-start justify-between gap-3">
                          <span className="block min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-primary opacity-80">
                            {quote.entryTitle}
                          </span>
                          <span className="shrink-0 pt-0.5 text-xs leading-none text-secondary opacity-90 tabular-nums">
                            {formatDay(quote.anchorTs)}
                          </span>
                        </span>
                        <span className="line-clamp-2 min-w-0 text-sm font-normal leading-snug text-secondary opacity-90">
                          {quote.text}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
