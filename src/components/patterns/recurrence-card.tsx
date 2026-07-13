"use client";

import type { RecurrenceCardData } from "@/lib/patterns/occurrences";

export type RecurrenceCardProps = {
  card: RecurrenceCardData;
  onOpenEntry: (entryId: string, quoteText?: string) => void;
};

const formatDate = (ts: number): string => {
  const date = new Date(ts);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

type SideProps = {
  quote: string;
  anchorTs: number;
  entryId: string;
  onOpenEntry: (entryId: string, quoteText?: string) => void;
};

function RecurrenceSide({ quote, anchorTs, entryId, onOpenEntry }: SideProps) {
  return (
    <button
      type="button"
      onClick={() => onOpenEntry(entryId, quote)}
      className="recurrence-side min-w-0 text-left transition-opacity duration-150 hover:opacity-80"
    >
      <p className="text-[0.6875rem] tracking-[0.01em] text-(--sidebar-ink-soft) tabular-nums">
        {formatDate(anchorTs)}
      </p>
      <p
        className="mt-1.5 text-[0.9rem] leading-relaxed text-(--canvas-ink-secondary)"
        style={{ fontFamily: "var(--font-lora)" }}
      >
        &ldquo;{quote}&rdquo;
      </p>
    </button>
  );
}

/**
 * Two-sided recurrence: earlier moment | gap | newer moment.
 * Deterministic — no AI. Shown from the 2nd occurrence onward.
 */
export function RecurrenceCard({ card, onOpenEntry }: RecurrenceCardProps) {
  return (
    <div className="discovery-recurrence">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-5">
        <RecurrenceSide
          quote={card.earlier.quote}
          anchorTs={card.earlier.anchorTs}
          entryId={card.earlier.entryId}
          onOpenEntry={onOpenEntry}
        />
        <p className="shrink-0 self-center px-1 text-center text-[0.6875rem] tracking-[0.01em] text-(--sidebar-ink-soft)">
          {card.gapLabel}
        </p>
        <RecurrenceSide
          quote={card.newer.quote}
          anchorTs={card.newer.anchorTs}
          entryId={card.newer.entryId}
          onOpenEntry={onOpenEntry}
        />
      </div>
    </div>
  );
}
