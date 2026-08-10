"use client";

import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import { formatMomentLabel } from "@/lib/patterns/quote-meta";

export type JournalSnippetProps = {
  quote: QuoteRef;
  onOpenEntry: (entryId: string, quoteText?: string) => void;
  /** Single closing quote - roomier than a list row. */
  featured?: boolean;
};

/**
 * One journal moment as a themed card.
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
      <p className="evidence-card__top">
        <span className="evidence-card__date">
          {formatMomentLabel(quote.anchorTs, quote.text)}
        </span>
      </p>
      <p
        className={`evidence-card__quote-text${featured ? "" : " evidence-card__quote-text--clamp"}`}
      >
        &ldquo;{quote.text}&rdquo;
      </p>
    </div>
  );
}
