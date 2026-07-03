"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, X } from "lucide-react";
import { btnIconTransparent, iconFixed } from "@/components/ui/button-system";
import { PATTERN_ICONS } from "@/components/patterns/pattern-icon";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary";
import type { PatternEvidenceItem, SurfacedPattern } from "@/lib/patterns/types";

/** Date + time anchor, e.g. "2 Jul · 7:44 PM". */
function formatAnchor(item: PatternEvidenceItem): string {
  const ts = item.sealedAt ?? item.lastEditedAt ?? item.createdAt;
  const date = new Date(ts);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

export type EvidencePanelProps = {
  pattern: SurfacedPattern | null;
  onClose: () => void;
  /** Closes the panel and opens the corresponding journal entry. */
  onOpenEntry: (entryId: string) => void;
};

/**
 * Side drawer: connecting sentence, then entry snippets with titles,
 * timestamps, and verbatim quotes. Tap a snippet to open the entry.
 */
export function EvidencePanel({ pattern, onClose, onOpenEntry }: EvidencePanelProps) {
  const open = pattern !== null;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const Icon = PATTERN_ICONS[pattern.name];
  const headingId = "evidence-panel-heading";
  const commonThread = pattern.insight?.commonThread;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/15 backdrop-blur-[1px]"
      role="presentation"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="flex h-full w-[min(420px,92vw)] flex-col border-l border-black/[0.08] bg-(--canvas-bg,#fffcf7) shadow-[-8px_0_28px_rgba(0,0,0,0.10)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-black/[0.06] px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-black/[0.04] text-(--canvas-title-ink)"
              aria-hidden
            >
              <Icon size={16} strokeWidth={1.85} className={iconFixed} />
            </span>
            <div className="min-w-0">
              <h2
                id={headingId}
                className="truncate text-sm font-semibold tracking-tight text-(--canvas-title-ink) sm:text-base"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {PATTERN_LABELS[pattern.name]}
              </h2>
              <p className="mt-0.5 text-xs text-tertiary">
                Seen in {pattern.entryCount} entries
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`shrink-0 ${btnIconTransparent("sm")}`}
          >
            <X size={16} strokeWidth={1.85} className={iconFixed} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5 sm:px-3 sm:py-3">
          {commonThread ? (
            <p className="mb-3 px-3 text-sm leading-relaxed text-secondary">
              These entries share a common thread:{" "}
              <span className="text-active">{commonThread}</span>
            </p>
          ) : (
            <div
              className="mx-3 mb-3 h-10 animate-pulse rounded-md bg-black/[0.05]"
              aria-hidden
            />
          )}

          <ol className="flex flex-col gap-1">
            {pattern.evidence.map((item, index) => (
              <li key={`${item.entryId}-${index}`}>
                <button
                  type="button"
                  onClick={() => onOpenEntry(item.entryId)}
                  className="group flex w-full flex-col gap-1 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-black/[0.04]"
                >
                  <span className="truncate text-xs font-medium text-tertiary">
                    {item.entryTitle}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium tabular-nums text-secondary">
                      {formatAnchor(item)}
                    </span>
                    <ArrowUpRight
                      size={13}
                      strokeWidth={1.9}
                      aria-hidden
                      className="shrink-0 text-tertiary opacity-0 transition-opacity duration-150 group-hover:opacity-70"
                    />
                  </span>
                  {item.quotes.map((quote, qi) => (
                    <span
                      key={qi}
                      className="text-sm leading-snug text-active"
                    >
                      &ldquo;{quote}&rdquo;
                    </span>
                  ))}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
