"use client";

import type { ReflectionBeat } from "@/lib/patterns/passage-beats";
import { EvidenceSection } from "@/components/patterns/evidence-section";
import { JournalSnippet } from "@/components/patterns/journal-snippet";

export type ReflectionBeatProps = {
  beat: ReflectionBeat;
  onOpenEntry: (entryId: string, quoteText?: string) => void;
};

/** Main reading content — uniform typography on every beat. */
export function ReflectionBeatContent({
  beat,
  onOpenEntry,
}: ReflectionBeatProps) {
  switch (beat.type) {
    case "thread":
      return <p className="reflection-body">&ldquo;{beat.phrase}&rdquo;</p>;

    case "moments":
      return (
        <EvidenceSection
          visible={beat.visible}
          overflow={beat.overflow}
          onOpenEntry={onOpenEntry}
        />
      );

    case "pair":
      return (
        <section className="flex flex-col gap-4">
          <p className="reflection-label">From your journal</p>
          <div className="flex flex-col gap-3">
            {beat.quotes.map((quote, i) => (
              <JournalSnippet
                key={`${quote.entryId}-${i}`}
                quote={quote}
                onOpenEntry={onOpenEntry}
              />
            ))}
          </div>
        </section>
      );

    case "observation":
      return <p className="reflection-body">{beat.text}</p>;

    case "ending":
      if (beat.endingKind === "quote" && beat.quote) {
        return (
          <JournalSnippet quote={beat.quote} onOpenEntry={onOpenEntry} />
        );
      }
      return (
        <p
          className={`reflection-body ${beat.endingKind === "question" ? "italic" : ""}`}
        >
          {beat.text}
        </p>
      );
  }
}

/** Whether this beat renders supporting metadata below the main reading. */
export function reflectionBeatHasMeta(_beat: ReflectionBeat): boolean {
  return false;
}

/** @deprecated Metadata is integrated into journal snippets. */
export function ReflectionBeatMeta(_props: ReflectionBeatProps) {
  return null;
}

/** @deprecated Use ReflectionBeatContent */
export function ReflectionBeatView({ beat, onOpenEntry }: ReflectionBeatProps) {
  return <ReflectionBeatContent beat={beat} onOpenEntry={onOpenEntry} />;
}
