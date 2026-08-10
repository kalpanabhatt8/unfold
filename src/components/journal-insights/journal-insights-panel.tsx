"use client";

import { useJournalInsights } from "@/hooks/use-journal-insights";
import {
  formatCount,
  formatTopicLabel,
  type JournalSummary,
  type PeriodChange,
  type TopicFrequency,
} from "@/lib/journal-insights/stats";

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="text-[0.6875rem] font-medium tracking-[0.12em] text-secondary uppercase">
      {children}
    </h3>
  );
}

function YourJournal({ summary }: { summary: JournalSummary }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Your journal</SectionLabel>
      <div className="flex flex-col gap-1">
        <p className="text-[0.9375rem] leading-snug tracking-tight text-primary">
          <span className="font-medium tabular-nums">
            {formatCount(summary.entryCount)}
          </span>{" "}
          <span className="text-secondary">
            {summary.entryCount === 1 ? "entry" : "entries"}
          </span>
        </p>
        <p className="text-[0.9375rem] leading-snug tracking-tight text-primary">
          <span className="font-medium tabular-nums">
            {formatCount(summary.wordCount)}
          </span>{" "}
          <span className="text-secondary">
            {summary.wordCount === 1 ? "word" : "words"}
          </span>
        </p>
        <p className="text-[0.9375rem] leading-snug tracking-tight text-primary">
          <span className="font-medium tabular-nums">
            {formatCount(summary.dayCount)}
          </span>{" "}
          <span className="text-secondary">
            {summary.dayCount === 1 ? "day" : "days"}
          </span>
        </p>
      </div>
      {summary.mostActiveWeekday ? (
        <p className="text-xs text-secondary">
          Most active:{" "}
          <span className="font-medium text-primary">
            {summary.mostActiveWeekday}
          </span>
        </p>
      ) : null}
    </section>
  );
}

function periodNoun(unit: PeriodChange["unit"]): string {
  return unit === "month" ? "month" : "week";
}

function SomethingChanged({ change }: { change: PeriodChange }) {
  const noun = periodNoun(change.unit);

  if (change.kind === "topic") {
    const label = formatTopicLabel(change.topic);
    const headline =
      change.direction === "more"
        ? `${label} showed up more often`
        : `${label} showed up less often`;

    return (
      <section className="flex flex-col gap-3">
        <SectionLabel>Something changed</SectionLabel>
        <div className="flex flex-col gap-2">
          <p className="text-[0.9375rem] font-medium leading-snug tracking-tight text-primary">
            {headline}
          </p>
          <div className="flex flex-col gap-1 text-xs leading-snug text-secondary">
            <p>
              <span className="font-medium tabular-nums text-primary">
                {formatCount(change.currentCount)}
              </span>{" "}
              {change.currentCount === 1 ? "entry" : "entries"} this {noun}
            </p>
            <p>
              <span className="font-medium tabular-nums text-primary">
                {formatCount(change.previousCount)}
              </span>{" "}
              {change.previousCount === 1 ? "entry" : "entries"} last {noun}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const headline =
    change.direction === "more"
      ? `You wrote more this ${noun}`
      : `You wrote less this ${noun}`;

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Something changed</SectionLabel>
      <div className="flex flex-col gap-2">
        <p className="text-[0.9375rem] font-medium leading-snug tracking-tight text-primary">
          {headline}
        </p>
        <div className="flex flex-col gap-2 text-xs leading-snug text-secondary">
          <div>
            <p className="text-secondary">This {noun}</p>
            <p className="mt-0.5 text-primary">
              <span className="font-medium tabular-nums">
                {formatCount(change.current.entryCount)}
              </span>{" "}
              {change.current.entryCount === 1 ? "entry" : "entries"}
              {" · "}
              <span className="font-medium tabular-nums">
                {formatCount(change.current.wordCount)}
              </span>{" "}
              {change.current.wordCount === 1 ? "word" : "words"}
            </p>
          </div>
          <div>
            <p className="text-secondary">Last {noun}</p>
            <p className="mt-0.5 text-primary">
              <span className="font-medium tabular-nums">
                {formatCount(change.previous.entryCount)}
              </span>{" "}
              {change.previous.entryCount === 1 ? "entry" : "entries"}
              {" · "}
              <span className="font-medium tabular-nums">
                {formatCount(change.previous.wordCount)}
              </span>{" "}
              {change.previous.wordCount === 1 ? "word" : "words"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatShowedUp({ topics }: { topics: TopicFrequency[] }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>What showed up</SectionLabel>
      <ul className="flex flex-col gap-1.5">
        {topics.map((row) => (
          <li
            key={row.topic}
            className="text-sm leading-snug tracking-tight text-primary"
          >
            <span>{row.topic}</span>
            <span className="text-secondary">
              {" "}
              · {formatCount(row.entryCount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Patterns-route sidebar body: factual journal picture only.
 * Never lists patterns — those stay in the main Patterns view.
 *
 * Topic rows are not clickable yet: filtering the entry list by analysis
 * topic would require entry-list UI changes outside this sidebar scope.
 */
export function JournalInsightsPanel() {
  const { summary, change, topics } = useJournalInsights();

  if (summary.entryCount === 0) {
    return (
      <p className="px-2 py-6 text-sm text-secondary">No journal yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-9 px-2 pb-6">
      <YourJournal summary={summary} />
      {change ? <SomethingChanged change={change} /> : null}
      {topics.length > 0 ? <WhatShowedUp topics={topics} /> : null}
    </div>
  );
}
