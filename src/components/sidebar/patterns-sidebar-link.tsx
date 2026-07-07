"use client";

import Link from "next/link";
import clsx from "clsx";
import { Waypoints } from "lucide-react";
import { iconFixed } from "@/components/ui/button-system";

type PatternsSidebarLinkProps = {
  count: number;
  active?: boolean;
  onOpen: () => void;
};

export function PatternsSidebarLink({
  count,
  active = false,
  onOpen,
}: PatternsSidebarLinkProps) {
  return (
    <Link
      href="/dashboard/patterns"
      onClick={onOpen}
      aria-current={active ? "page" : undefined}
      aria-label={`Patterns, ${count} reflections`}
      className={clsx(
        "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors duration-150",
        active
          ? "bg-(--sidebar-tab-selected-bg) hover:bg-(--sidebar-active-bg)"
          : "bg-white/55 hover:bg-(--sidebar-hover-bg)",
      )}
    >
      <Waypoints
        size={16}
        strokeWidth={1.85}
        aria-hidden
        className={clsx(iconFixed, "shrink-0 text-(--sidebar-ink)")}
      />
      <span className="min-w-0 flex-1 text-sm font-medium text-(--sidebar-ink)">
        Patterns
      </span>
      <span
        className={clsx(
          "flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums text-(--sidebar-ink)",
          active
            ? "bg-(--sidebar-active-bg)"
            : "bg-(--sidebar-tab-selected-bg)",
        )}
        aria-hidden
      >
        {count}
      </span>
    </Link>
  );
}
