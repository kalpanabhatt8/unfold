"use client";

import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import {
  formatQuoteMeta,
  formatTimelineDate,
} from "@/lib/patterns/quote-meta";

export type JournalSnippetProps = {
  quote: QuoteRef;
  onOpenEntry: (entryId: string, quoteText?: string) => void;
  /** Single closing quote — roomier than a list row. */
  featured?: boolean;
};

/**
 * One moment as a split card — faint date left, quote right.
 * Used for closing quotes; evidence lists use EvidenceSection.
 */
export function JournalSnippet({
  quote,
  onOpenEntry,
  featured = false,
}: JournalSnippetProps) {
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => onOpenEntry(quote.entryId, quote.text)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenEntry(quote.entryId, quote.text);
        }
      }}
      className={`evidence-card ${featured ? "evidence-card--featured" : "evidence-card--solo"}`}
    >
      <aside className="evidence-card__time" aria-hidden>
        <p className="evidence-card__date">
          {formatTimelineDate(quote.anchorTs)}
        </p>
      </aside>

      <div className="evidence-card__quotes">
        <div className="evidence-card__quote evidence-card__quote--solo">
          <p className="evidence-card__meta">{formatQuoteMeta(quote)}</p>
          <p
            className={`evidence-card__quote-text${featured ? "" : " evidence-card__quote-text--clamp"}`}
          >
            &ldquo;{quote.text}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
