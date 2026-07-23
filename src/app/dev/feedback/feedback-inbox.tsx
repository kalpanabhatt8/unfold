"use client";

import { useMemo, useState } from "react";
import {
  FEEDBACK_CATEGORIES,
  feedbackCategoryLabel,
  feedbackChipClass,
  feedbackChipStyle,
  type FeedbackCategoryId,
} from "@/lib/feedback";
import { avatarInitial } from "@/lib/user-display";

export type FeedbackInboxItem = {
  id: string;
  userId: string;
  userName: string;
  userImageUrl: string | null;
  categories: string[];
  text: string;
  createdAt: string;
};

type FeedbackInboxProps = {
  items: FeedbackInboxItem[];
};

const FILTER_ALL = "all" as const;
type FilterId = typeof FILTER_ALL | FeedbackCategoryId;

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

export function FeedbackInbox({ items }: FeedbackInboxProps) {
  const [filter, setFilter] = useState<FilterId>(FILTER_ALL);

  const filtered = useMemo(() => {
    if (filter === FILTER_ALL) return items;
    return items.filter((item) => item.categories.includes(filter));
  }, [filter, items]);

  const counts = useMemo(() => {
    const map = new Map<FeedbackCategoryId, number>();
    for (const cat of FEEDBACK_CATEGORIES) map.set(cat.id, 0);
    for (const item of items) {
      for (const id of item.categories) {
        if (map.has(id as FeedbackCategoryId)) {
          map.set(id as FeedbackCategoryId, (map.get(id as FeedbackCategoryId) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [items]);

  return (
    <section className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Filter by category"
        className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto px-1 pb-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={filter === FILTER_ALL}
          onClick={() => setFilter(FILTER_ALL)}
          className={`${feedbackChipClass} shrink-0`}
          data-active={filter === FILTER_ALL ? "true" : "false"}
          style={feedbackChipStyle}
        >
          All ({items.length})
        </button>
        {FEEDBACK_CATEGORIES.map((cat) => {
          const count = counts.get(cat.id) ?? 0;
          const active = filter === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(cat.id)}
              className={`${feedbackChipClass} shrink-0`}
              data-active={active ? "true" : "false"}
              style={feedbackChipStyle}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-(--popover-border) px-4 py-10 text-center text-sm text-(--sidebar-ink-soft)">
          {filter === FILTER_ALL
            ? "No product feedback yet."
            : "No product feedback in this category yet."}
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
                  dateTime={item.createdAt}
                  className="shrink-0 text-xs text-(--sidebar-ink-soft)"
                >
                  {formatRelative(item.createdAt)}
                </time>
              </div>

              {item.categories.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {item.categories.map((id) => (
                    <span
                      key={id}
                      className={`${feedbackChipClass} pointer-events-none`}
                      style={feedbackChipStyle}
                    >
                      {feedbackCategoryLabel(id)}
                    </span>
                  ))}
                </div>
              ) : null}

              {item.text ? (
                <p
                  className={`whitespace-pre-wrap text-sm leading-relaxed text-primary ${
                    item.categories.length > 0 ? "mt-2" : "mt-5"
                  }`}
                >
                  {item.text}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
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
