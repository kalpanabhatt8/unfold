"use client";

import Link from "next/link";
import clsx from "clsx";
import { Waypoints } from "lucide-react";

type PatternsSidebarLinkProps = {
  /** Unread ready patterns (new or updated since last open). */
  count: number;
  active?: boolean;
  onOpen: () => void;
};

export function PatternsSidebarLink({
  count,
  active = false,
  onOpen,
}: PatternsSidebarLinkProps) {
  const hasUnread = count > 0;

  return (
    <div
      className={clsx(
        "group relative rounded-[0.625rem] transition-colors duration-150",
        active
          ? "bg-(--sidebar-entry-pressed-bg)"
          : "hover:bg-(--sidebar-entry-hover-bg) active:bg-(--sidebar-entry-pressed-bg)",
      )}
    >
      <Link
        href="/dashboard/patterns"
        onClick={onOpen}
        aria-current={active ? "page" : undefined}
        aria-label={
          hasUnread
            ? `Patterns, ${count} new or updated`
            : "Patterns"
        }
        className="flex items-center gap-2.5 rounded-[0.625rem] px-2.75 py-2.5"
      >
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-sealed flex items-center gap-2">
          <Waypoints
            size={16}
            strokeWidth={1.8}
            aria-hidden
            // className="text-(--sidebar-icon)"
          />
          Patterns
        </span>
        {hasUnread ? (
          <span
            className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-(--surface-chrome-active) px-1.5 text-xs font-medium tabular-nums text-(--accent)"
            aria-hidden
          >
            {count}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
