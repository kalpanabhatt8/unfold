"use client";

import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import {
  formatQuoteMeta,
  formatTimelineDate,
} from "@/lib/patterns/quote-meta";

export type EvidenceSectionProps = {
  visible: QuoteRef[];
  /** @deprecated Unused — top quotes are shown in full; kept for call-site compat. */
  overflow?: QuoteRef[];
  onOpenEntry: (entryId: string, quoteText?: string) => void;
};

/** Split card — faint timeline left, journal quotes right. */
export function EvidenceSection({
  visible,
  onOpenEntry,
}: EvidenceSectionProps) {
  if (visible.length === 0) return null;

  const timelineTs = Math.min(...visible.map((q) => q.anchorTs));

  return (
    <section className="evidence-section">
      <div className="evidence-card">
        <aside className="evidence-card__time" aria-hidden>
          <p className="evidence-card__date">{formatTimelineDate(timelineTs)}</p>
        </aside>

        <div className="evidence-card__quotes">
          {visible.map((quote, i) => (
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
              <p className="evidence-card__quote-text">
                &ldquo;{quote.text}&rdquo;
              </p>
              <p className="evidence-card__meta">{formatQuoteMeta(quote)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
