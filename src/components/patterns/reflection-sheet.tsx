"use client";

import type { ReflectionBeat } from "@/lib/patterns/passage-beats";
import { beatAwaitingVoice } from "@/lib/patterns/passage-beats";
import { ReflectionBeatContent } from "@/components/patterns/reflection-beat";

export type ReflectionSheetProps = {
  beat: ReflectionBeat | null;
  beatIndex: number;
  totalBeats: number;
  loading?: boolean;
  dateRange?: string | null;
  onContinue: () => void;
  onOpenEntry: (entryId: string, quoteText?: string) => void;
};

/**
 * Simple reading container — one beat at a time.
 */
export function ReflectionSheet({
  beat,
  beatIndex,
  totalBeats,
  loading = false,
  dateRange = null,
  onContinue,
  onOpenEntry,
}: ReflectionSheetProps) {
  const isLast = beatIndex >= totalBeats - 1;
  const hasBeats = totalBeats > 0 && beat !== null;
  const showContent = hasBeats && !(beatAwaitingVoice(beat) && loading);

  return (
    <article className="flex min-h-0 w-full max-w-[min(92vw,700px)] flex-1 flex-col">
      {dateRange ? (
        <p className="reflection-meta shrink-0 tabular-nums tracking-[0.04em]">
          {dateRange}
        </p>
      ) : null}

      <div className={`max-h-[min(50vh,24rem)] shrink-0 overflow-y-auto ${dateRange ? "mt-5" : ""}`}>
        {loading ? (
          <div className="flex flex-col gap-3" aria-hidden>
            <span className="h-4 w-28 animate-pulse rounded bg-(--sidebar-hover-bg)" />
            <span className="journal-snippet h-20 animate-pulse bg-(--sidebar-tab-track)" />
          </div>
        ) : showContent ? (
          <div key={beatIndex}>
            <ReflectionBeatContent beat={beat} onOpenEntry={onOpenEntry} />
          </div>
        ) : hasBeats ? (
          <div className="flex flex-col gap-3" aria-hidden>
            <span className="h-4 w-28 animate-pulse rounded bg-(--sidebar-hover-bg)" />
            <span className="journal-snippet h-20 animate-pulse bg-(--sidebar-tab-track)" />
          </div>
        ) : (
          <p className="reflection-meta">Nothing here yet.</p>
        )}
      </div>

      <footer className="mt-auto shrink-0 pt-12">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            disabled={loading || !hasBeats}
            className="text-[0.8125rem] tracking-[0.01em] text-(--sidebar-ink-soft) transition-colors duration-150 hover:text-(--sidebar-ink) disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isLast ? "Done →" : "Continue →"}
          </button>
        </div>
      </footer>
    </article>
  );
}
