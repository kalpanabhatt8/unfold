"use client";

import { Info } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { Tooltip } from "@/components/ui/tooltip";
import { SidebarEmptyState } from "@/components/sidebar/sidebar-empty-state";
import { JournalInsightsSkeleton } from "@/components/journal-insights/journal-insights-skeleton";
import { useJournalInsights } from "@/hooks/use-journal-insights";
import { useInitialSyncReady } from "@/lib/sync/use-initial-sync-ready";
import {
  formatCount,
  formatTopicLabel,
  formatTopicPeriodDelta,
  formatTopicPeriodDeltaExplanation,
  type JournalSummary,
  type TopicFrequency,
} from "@/lib/journal-insights/stats";

function InsightsDivider() {
  return (
    <div className="py-6" role="separator" aria-hidden>
      <div className="border-t border-(--border)" />
    </div>
  );
}

const METRIC_TONE_BG = {
  days: "bg-(--journal-metric-days)",
  entries: "bg-(--journal-metric-entries)",
  words: "bg-(--journal-metric-words)",
} as const;

function MetricCard({
  label,
  value,
  approximate = false,
  tone,
}: {
  label: string;
  value: number;
  approximate?: boolean;
  tone: keyof typeof METRIC_TONE_BG;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 rounded-xl px-3 py-3.5 ${METRIC_TONE_BG[tone]}`}
    >
      <span className="header-md tabular-nums leading-none">
        {approximate ? "~" : ""}
        {formatCount(value)}
      </span>
      <span className="text-sm leading-none text-secondary">
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </span>
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

function wordsPerEntry(summary: JournalSummary): number {
  if (summary.entryCount <= 0) return 0;
  return Math.round(summary.wordCount / summary.entryCount);
}

function YourJournal({ summary }: { summary: JournalSummary }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,7.5rem),1fr))] gap-2">
          <MetricCard value={summary.dayCount} label="Days" tone="days" />
          <MetricCard value={summary.entryCount} label="Entries" tone="entries" />
          <MetricCard
            value={wordsPerEntry(summary)}
            label="words/entry"
            approximate
            tone="words"
          />
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
        className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-tertiary transition-colors hover:text-tertiary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--border)"
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
              className="flex items-center justify-between gap-3 rounded-xl bg-(--sidebar-entry-hover-bg) px-3 py-3"
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
  const initialSyncReady = useInitialSyncReady();
  const { summary, topics, ready } = useJournalInsights();

  // Local read pending, or empty local cache while cloud sync still filling in.
  if (!ready || (!initialSyncReady && summary.entryCount === 0)) {
    return <JournalInsightsSkeleton />;
  }

  if (summary.entryCount === 0) {
    return (
      <SidebarEmptyState
        title="Start with a page"
        body="Write something down. Insights will appear as you keep writing."
      />
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
