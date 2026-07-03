"use client";

import { ChevronRight } from "lucide-react";
import { iconFixed } from "@/components/ui/button-system";
import { PATTERN_ICONS } from "@/components/patterns/pattern-icon";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary";
import type { SurfacedPattern } from "@/lib/patterns/types";

export type PatternCardProps = {
  pattern: SurfacedPattern;
  onOpen: (pattern: SurfacedPattern) => void;
};

/**
 * A surfaced pattern: specific observation, entry count, timing, co-patterns.
 * The whole card opens the evidence drawer.
 */
export function PatternCard({ pattern, onOpen }: PatternCardProps) {
  const Icon = PATTERN_ICONS[pattern.name];
  const observation = pattern.insight?.observation;
  const loadingInsight = !observation;

  return (
    <button
      type="button"
      onClick={() => onOpen(pattern)}
      aria-label={`View entries behind ${PATTERN_LABELS[pattern.name]}`}
      className="group flex w-full items-start gap-3 rounded-2xl border border-black/[0.07] bg-white/70 p-4 text-left transition-colors duration-150 hover:border-black/[0.12] hover:bg-white sm:p-5"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-black/[0.04] text-(--canvas-title-ink)"
        aria-hidden
      >
        <Icon size={18} strokeWidth={1.85} className={iconFixed} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-tertiary">
          {PATTERN_LABELS[pattern.name]}
        </p>

        {loadingInsight ? (
          <div
            className="mt-1 h-[2.75rem] animate-pulse rounded-md bg-black/[0.05]"
            aria-hidden
          />
        ) : (
          <h3
            className="mt-0.5 text-[0.95rem] font-semibold leading-snug tracking-tight text-(--canvas-title-ink)"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {observation}
          </h3>
        )}

        <div className="mt-2 flex flex-col gap-0.5 text-xs text-secondary">
          <span className="font-medium">
            Seen in {pattern.entryCount} entries
          </span>
          {pattern.timeHint ? (
            <span className="capitalize">{pattern.timeHint}</span>
          ) : null}
          {pattern.coPatterns.length > 0 ? (
            <span>
              Often alongside:{" "}
              <span className="text-active">{pattern.coPatterns.join(", ")}</span>
            </span>
          ) : null}
        </div>

        <p className="mt-2 text-xs font-medium text-tertiary transition-colors group-hover:text-secondary">
          Tap to see entries
        </p>
      </div>

      <ChevronRight
        size={18}
        strokeWidth={1.85}
        aria-hidden
        className="mt-1 shrink-0 text-tertiary transition-transform duration-150 group-hover:translate-x-0.5"
      />
    </button>
  );
}
