"use client";

import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import { formatQuoteDatePill } from "@/lib/patterns/quote-meta";

export type EvidenceSectionProps = {
  visible: QuoteRef[];
  /** @deprecated Unused — top quotes are shown in full; kept for call-site compat. */
  overflow?: QuoteRef[];
  onOpenEntry: (entryId: string, quoteText?: string) => void;
};

/** Grid of journal quote cards — shared dusty-rose theme. */
export function EvidenceSection({
  visible,
  onOpenEntry,
}: EvidenceSectionProps) {
  if (visible.length === 0) return null;

  return (
    <section className="evidence-section">
      {visible.map((quote, i) => {
        const entryLabel = quote.entryTitle.trim() || "journal";
        return (
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
            className="evidence-card"
          >
            <p className="evidence-card__top">
              <span className="evidence-card__label">{entryLabel}</span>
              <span className="evidence-card__sep" aria-hidden>
                ·
              </span>
              <span className="evidence-card__date">
                {formatQuoteDatePill(quote.anchorTs)}
              </span>
            </p>
            <p className="evidence-card__quote-text">
              &ldquo;{quote.text}&rdquo;
            </p>
          </div>
        );
      })}
    </section>
  );
}
