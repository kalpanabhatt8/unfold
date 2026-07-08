"use client";

import { dayPartLabel } from "@/lib/patterns/time-hint";
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

export type JournalSnippetProps = {
  quote: QuoteRef;
  onOpenEntry: (entryId: string) => void;
  compact?: boolean;
};

/** A single journal excerpt — soft paper chip, not a card. */
export function JournalSnippet({
  quote,
  onOpenEntry,
  compact = false,
}: JournalSnippetProps) {
  const dayPart = dayPartLabel(quote.anchorTs);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => onOpenEntry(quote.entryId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenEntry(quote.entryId);
        }
      }}
      className={`journal-snippet ${compact ? "journal-snippet--compact" : ""}`}
    >
      <p className="reflection-body">&ldquo;{quote.text}&rdquo;</p>
      <p className="reflection-meta mt-3 tabular-nums">
        {formatDay(quote.anchorTs)}
        {dayPart ? ` · ${dayPart}` : ""}
        <span className="text-(--sidebar-ink-soft)/80"> · {quote.entryTitle}</span>
      </p>
    </div>
  );
}
