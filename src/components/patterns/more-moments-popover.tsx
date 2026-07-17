"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import { formatQuoteMeta } from "@/lib/patterns/quote-meta";
import { logPopoverReady } from "@/lib/patterns/pattern-timing";

export type MoreMomentsPopoverProps = {
  quotes: QuoteRef[];
  count: number;
  onOpenEntry: (entryId: string, quoteText?: string) => void;
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
    if (quotes.length > 0) logPopoverReady(quotes.length);
  }, [quotes.length]);

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
              <div className="evidence-card evidence-card--peek">
                <div className="evidence-card__quotes">
                  {quotes.map((quote, i) => (
                    <div
                      key={`${quote.entryId}-${i}`}
                      role="link"
                      tabIndex={0}
                      onClick={() => onOpenEntry(quote.entryId, quote.text)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenEntry(quote.entryId, quote.text);
                        }
                      }}
                      className="evidence-card__quote"
                    >
                       <p className="evidence-card__quote-text evidence-card__quote-text--clamp">
                        &ldquo;{quote.text}&rdquo;
                      </p>
                      <p className="evidence-card__meta">
                        {formatQuoteMeta(quote)}
                      </p>
                     
                    </div>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
