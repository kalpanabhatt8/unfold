"use client";

import Link from "next/link";
import clsx from "clsx";
import { Waypoints } from "lucide-react";
import { iconFixed } from "@/components/ui/button-system";

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
        "group relative rounded-[0.875rem] transition-colors duration-150",
        active
          ? "bg-(--sidebar-active-bg)"
          : "hover:bg-(--sidebar-hover-bg)",
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
        className="flex items-center gap-2.5 rounded-[0.875rem] px-2.75 py-2.5"
      >
        <Waypoints
          size={16}
          strokeWidth={1.85}
          aria-hidden
          className={clsx(iconFixed, "shrink-0 text-sealed")}
        />
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-sealed">
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
