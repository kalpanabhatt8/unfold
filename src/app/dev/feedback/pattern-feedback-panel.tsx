"use client";

import { useMemo, useState } from "react";
import {
  feedbackChipClass,
  feedbackChipStyle,
} from "@/lib/feedback";
import { avatarInitial } from "@/lib/user-display";

export type PatternFeedbackItem = {
  id: string;
  userId: string;
  userName: string;
  userImageUrl: string | null;
  patternName: string;
  patternLabel: string;
  vote: "up" | "down";
  reason: string | null;
  updatedAt: string;
};

type PatternFeedbackPanelProps = {
  items: PatternFeedbackItem[];
};

const FILTER_ALL = "all" as const;
const FILTER_UP = "up" as const;
const FILTER_DOWN = "down" as const;
type VoteFilter = typeof FILTER_ALL | typeof FILTER_UP | typeof FILTER_DOWN;

const formatRelative = (iso: string): string => {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 14) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
};

export function PatternFeedbackPanel({ items }: PatternFeedbackPanelProps) {
  const [filter, setFilter] = useState<VoteFilter>(FILTER_ALL);

  const stats = useMemo(() => {
    const up = items.filter((item) => item.vote === "up").length;
    const down = items.filter((item) => item.vote === "down").length;
    return { up, down, total: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === FILTER_ALL) return items;
    return items.filter((item) => item.vote === filter);
  }, [filter, items]);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Filter pattern votes"
        className="-mx-1 flex flex-wrap gap-1.5 px-1"
      >
        {(
          [
            [FILTER_ALL, `All (${stats.total})`],
            [FILTER_UP, `👍 Helpful (${stats.up})`],
            [FILTER_DOWN, `👎 Not helpful (${stats.down})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`${feedbackChipClass} shrink-0`}
            data-active={filter === id ? "true" : "false"}
            style={feedbackChipStyle}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-(--popover-border) px-4 py-10 text-center text-sm text-(--sidebar-ink-soft)">
          No pattern votes yet.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="w-80 rounded-xl border border-(--popover-border) bg-(--surface-canvas) p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar
                    name={item.userName}
                    imageUrl={item.userImageUrl}
                  />
                  <span className="truncate text-sm font-medium text-primary">
                    {item.userName}
                  </span>
                </div>
                <time
                  dateTime={item.updatedAt}
                  className="shrink-0 text-xs text-(--sidebar-ink-soft)"
                >
                  {formatRelative(item.updatedAt)}
                </time>
              </div>

              <div className="mt-5 flex flex-wrap gap-1.5">
                <span
                  className={`${feedbackChipClass} pointer-events-none`}
                  style={feedbackChipStyle}
                >
                  {item.patternLabel}
                </span>
                <span
                  className={`${feedbackChipClass} pointer-events-none`}
                  style={feedbackChipStyle}
                >
                  {item.vote === "up" ? "👍 Helpful" : "👎 Not helpful"}
                </span>
              </div>

              {item.reason ? (
                <p className="mt-2 text-sm text-primary">{item.reason}</p>
              ) : item.vote === "down" ? (
                <p className="mt-2 text-xs text-(--sidebar-ink-soft)">
                  No reason submitted
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UserAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string | null;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-lg object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--surface-chrome) text-xs font-medium text-primary"
    >
      {avatarInitial(name)}
    </span>
  );
}
