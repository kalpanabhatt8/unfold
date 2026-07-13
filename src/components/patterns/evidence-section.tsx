"use client";

import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import { JournalSnippet } from "@/components/patterns/journal-snippet";
import { MoreMomentsPopover } from "@/components/patterns/more-moments-popover";

export const EVIDENCE_SECTION_LABEL = "From your journal";

export type EvidenceSectionProps = {
  visible: QuoteRef[];
  overflow: QuoteRef[];
  onOpenEntry: (entryId: string, quoteText?: string) => void;
  label?: string;
};

/** Collected journal excerpts that surfaced this pattern. */
export function EvidenceSection({
  visible,
  overflow,
  onOpenEntry,
  label = EVIDENCE_SECTION_LABEL,
}: EvidenceSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <p className="reflection-label">{label}</p>

      <div className="flex flex-col gap-3">
        {visible.map((quote, i) => (
          <JournalSnippet
            key={`${quote.entryId}-${i}`}
            quote={quote}
            onOpenEntry={onOpenEntry}
          />
        ))}
      </div>

      {overflow.length > 0 ? (
        <MoreMomentsPopover
          quotes={overflow}
          onOpenEntry={onOpenEntry}
          count={overflow.length}
        />
      ) : null}
    </section>
  );
}
