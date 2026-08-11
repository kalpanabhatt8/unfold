"use client";

import { Info } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useJournalInsights } from "@/hooks/use-journal-insights";
import {
  formatCount,
  formatTopicLabel,
  formatTopicPeriodDelta,
  formatTopicPeriodDeltaExplanation,
  type JournalSummary,
  type TopicFrequency,
} from "@/lib/journal-insights/stats";

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[0.6875rem] font-medium tracking-[0.01em] text-tertiary uppercase">
      {children}
    </p>
  );
}

function InsightsDivider() {
  return (
    <div className="py-6" role="separator" aria-hidden>
      <div className="border-t border-(--sidebar-border)" />
    </div>
  );
}

const METRIC_CARD_TINT = {
  days: "bg-[#f9eef1]",
  entries: "bg-[#f4eef5]",
  words: "bg-[#f8f0ec]",
} as const;

function MetricCard({
  tint,
  label,
  value,
}: {
  tint: keyof typeof METRIC_CARD_TINT;
  label: string;
  value: number;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 rounded-xl px-3 py-3.5 ${METRIC_CARD_TINT[tint]}`}
    >
      <span className="header-md tabular-nums leading-none">
        {formatCount(value)}
      </span>
      <span className="text-sm leading-none text-tertiary">{label}</span>
    </div>
  );
}

function JournalSummaryFooter({ summary }: { summary: JournalSummary }) {
  if (!summary.mostActiveWeekday) return null;

  return (
    <p className="text-xs leading-snug text-tertiary">
      Most active:{" "}
      <span className="uppercase">{summary.mostActiveWeekday}</span>
    </p>
  );
}

function YourJournal({ summary }: { summary: JournalSummary }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <SectionLabel>Summary</SectionLabel>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <MetricCard tint="days" value={summary.dayCount} label="Days" />
          <MetricCard
            tint="entries"
            value={summary.entryCount}
            label="Entries"
          />
          <MetricCard tint="words" value={summary.wordCount} label="Words" />
        </div>
      </div>
      <JournalSummaryFooter summary={summary} />
    </section>
  );
}

function TopicPeriodDeltaInfo({
  delta,
  unit,
  topic,
}: {
  delta: number;
  unit: NonNullable<TopicFrequency["periodUnit"]>;
  topic: string;
}) {
  const explanation = formatTopicPeriodDeltaExplanation(
    delta,
    unit,
    formatTopicLabel(topic),
  );

  return (
    <Tooltip
      content={explanation}
      side="top"
      align="center"
      bubbleClassName="tooltip-bubble [background:color-mix(in_srgb,var(--accent-active)_28%,black)]"
    >
      <button
        type="button"
        aria-label={explanation}
        className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-tertiary transition-colors hover:text-tertiary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--sidebar-border)"
      >
        <Info size={11} strokeWidth={1.75} aria-hidden className="block" />
      </button>
    </Tooltip>
  );
}

function WhatsShowingUp({
  topics,
  totalEntryCount,
}: {
  topics: TopicFrequency[];
  totalEntryCount: number;
}) {
  if (topics.length === 0) return null;

  return (
    <section className="flex flex-col">
      <InsightsDivider />
      <div className="flex flex-col gap-2">
        <SectionLabel>What&apos;s showing up</SectionLabel>
        <ul className="flex flex-col gap-2" role="list">
          {topics.map((row) => (
            <li
              key={row.topic}
              className="flex items-center justify-between gap-3 rounded-xl bg-linear-to-br from-(--surface-raised) to-(--sidebar-hover-bg) px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm leading-snug text-secondary">
                  {formatTopicLabel(row.topic)}
                </p>
                <p className="mt-0.5 leading-none">
                  <span className="text-lg font-medium tabular-nums text-primary">
                    {formatCount(row.entryCount)}
                  </span>
                  <span className="ml-1 text-xs tabular-nums text-tertiary">
                    of {formatCount(totalEntryCount)} entries
                  </span>
                </p>
              </div>
              {row.periodDelta !== null && row.periodUnit ? (
                <div className="inline-flex shrink-0 items-center gap-1">
                  <span className="rounded-lg bg-(--sidebar-active-bg) px-2 py-1 text-sm tabular-nums text-primary">
                    {formatTopicPeriodDelta(row.periodDelta)}
                  </span>
                  <TopicPeriodDeltaInfo
                    delta={row.periodDelta}
                    unit={row.periodUnit}
                    topic={row.topic}
                  />
                </div>
              ) : (
                <span className="shrink-0 text-xs text-tertiary">—</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Patterns-route sidebar body: factual journal picture only.
 * Never lists patterns — those stay in the main Patterns view.
 */
export function JournalInsightsPanel() {
  const { summary, topics } = useJournalInsights();

  if (summary.entryCount === 0) {
    return (
      <p className="py-6 text-sm text-tertiary">
        No journal yet. Write an entry to see your insights here.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col pb-6">
      <YourJournal summary={summary} />
      <WhatsShowingUp
        topics={topics}
        totalEntryCount={summary.entryCount}
      />
    </div>
  );
}
