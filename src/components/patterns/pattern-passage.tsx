"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { dayPartLabel } from "@/lib/patterns/time-hint";
import { PATTERN_LABELS } from "@/lib/patterns/vocabulary";
import type { PatternEvidenceItem, SurfacedPattern } from "@/lib/patterns/types";

const anchorTs = (item: PatternEvidenceItem): number =>
  item.sealedAt ?? item.lastEditedAt ?? item.createdAt;

/** "Jun 12" — with year only when it differs from today. */
function formatDay(ts: number): string {
  const date = new Date(ts);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "Jun 12 – Jul 3", collapsing to a single day when the span is one day. */
function formatRange(evidence: PatternEvidenceItem[]): string {
  const times = evidence.map(anchorTs);
  const first = formatDay(Math.min(...times));
  const last = formatDay(Math.max(...times));
  return first === last ? first : `${first} – ${last}`;
}

/** Joins "a", "b" as "a and b"; passes single items through. */
const joinGently = (items: string[]): string =>
  items.length > 1
    ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
    : items[0] ?? "";

/**
 * Plain-language transparency footnote: how this pattern earned its place on
 * the page. Composed entirely from local aggregation — nothing generated.
 */
function noticedBecause(
  pattern: SurfacedPattern,
  analyzedEntryCount: number,
): string {
  const label = PATTERN_LABELS[pattern.name].toLowerCase();
  const parts = [
    `Noticed because ${label} appeared in ${pattern.entryCount} of your ${analyzedEntryCount} signed entries`,
  ];
  if (pattern.timeHint) parts.push(pattern.timeHint);
  if (pattern.coPatterns.length > 0) {
    parts.push(
      `often alongside ${joinGently(
        pattern.coPatterns.map((p) => p.toLowerCase()),
      )}`,
    );
  }
  return `${parts.join(", ")}.`;
}

export type PatternPassageProps = {
  pattern: SurfacedPattern;
  analyzedEntryCount: number;
  open: boolean;
  onToggle: () => void;
  onOpenEntry: (entryId: string) => void;
};

/**
 * One pattern as a folded passage on a continuous page.
 *
 * At rest: date range in the margin + the observation sentence in the writing
 * serif — a line of ink, no card, no icon, no label. Unfolding reveals the
 * common thread, a chronological journey of dated verbatim quotes (each row
 * opens its entry), and a small footnote explaining why this was noticed.
 */
export function PatternPassage({
  pattern,
  analyzedEntryCount,
  open,
  onToggle,
  onOpenEntry,
}: PatternPassageProps) {
  const bodyId = useId();
  const observation = pattern.insight?.observation;
  const commonThread = pattern.insight?.commonThread;

  // Aggregation sorts newest-first for surfacing; the journey reads oldest-
  // first so the pattern's evolution unfolds in order.
  const journey = [...pattern.evidence].sort(
    (a, b) => anchorTs(a) - anchorTs(b),
  );

  return (
    <section className="sm:grid sm:grid-cols-[minmax(4.5rem,6.5rem)_minmax(0,1fr)] sm:gap-x-7">
      {/* ── Margin: date range (+ time note when unfolded) ── */}
      <div className="pt-[3px] sm:text-right">
        <p className="text-[0.7rem] font-medium tabular-nums tracking-[0.02em] text-tertiary">
          {formatRange(pattern.evidence)}
        </p>
        {open && pattern.timeHint ? (
          <p
            aria-hidden
            className="mt-1 hidden -rotate-2 text-[1.05rem] leading-tight text-tertiary sm:block"
          >
            {pattern.timeHint}
          </p>
        ) : null}
      </div>

      <div className="min-w-0">
        {/* ── The observation — a line of ink; the whole line unfolds ── */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="group flex w-full items-baseline gap-3 text-left"
        >
          {observation ? (
            <span
              className="min-w-0 flex-1 text-[1.08rem] leading-[1.6] text-(--canvas-title-ink)"
              style={{ fontFamily: "var(--font-lora)" }}
            >
              {observation}
            </span>
          ) : (
            <span
              className="h-[1.35rem] flex-1 animate-pulse self-center rounded bg-black/[0.05]"
              aria-hidden
            />
          )}
          <ChevronDown
            size={15}
            strokeWidth={1.8}
            aria-hidden
            className={`shrink-0 translate-y-[1px] text-tertiary opacity-50 transition-transform duration-300 ease-out group-hover:opacity-90 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* ── Unfolded body ── */}
        <div
          id={bodyId}
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div
              className={`transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
            >
              {commonThread ? (
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-secondary">
                  {commonThread}
                </p>
              ) : null}

              {/* Mobile fallback for the margin time note */}
              {pattern.timeHint ? (
                <p
                  aria-hidden
                  className="mt-2 -rotate-1 text-base leading-tight text-tertiary sm:hidden"
                >
                  {pattern.timeHint}
                </p>
              ) : null}

              {/* ── The journey — your own words, in order ── */}
              <ol className="mt-5 flex flex-col gap-5">
                {journey.map((item) => {
                  const ts = anchorTs(item);
                  const dayPart = dayPartLabel(ts);
                  return (
                    <li key={item.entryId}>
                      <button
                        type="button"
                        onClick={() => onOpenEntry(item.entryId)}
                        className="group/entry -mx-2 flex w-[calc(100%+1rem)] flex-col gap-1 rounded-lg px-2 py-1 text-left transition-colors duration-150 hover:bg-black/[0.03]"
                      >
                        <span className="text-[0.7rem] font-medium tabular-nums text-tertiary">
                          {formatDay(ts)}
                          {dayPart ? ` · ${dayPart}` : ""}
                        </span>
                        {item.quotes.map((quote, qi) => (
                          <span
                            key={qi}
                            className="max-w-prose text-[0.95rem] italic leading-relaxed text-active"
                            style={{ fontFamily: "var(--font-lora)" }}
                          >
                            &ldquo;{quote}&rdquo;
                          </span>
                        ))}
                        <span className="text-[0.7rem] text-tertiary underline-offset-2 transition-colors duration-150 group-hover/entry:text-secondary group-hover/entry:underline">
                          from {item.entryTitle}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {/* ── Why this surfaced — an honest footnote ── */}
              <p className="mt-5 max-w-prose text-xs leading-relaxed text-tertiary">
                {noticedBecause(pattern, analyzedEntryCount)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
