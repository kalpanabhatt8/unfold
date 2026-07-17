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
    <div
      className={clsx(
        "group relative rounded-md transition-colors duration-150",
        active
          ? "bg-(--sidebar-active-bg)"
          : "hover:bg-(--sidebar-hover-bg)",
      )}
    >
      <Link
        href="/dashboard/patterns"
        onClick={onOpen}
        aria-current={active ? "page" : undefined}
        aria-label={`Patterns, ${count} reflections`}
        className="flex items-center gap-2.5 px-2.75 py-2.5"
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
        <span
          className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-(--sidebar-tab-track) px-1.5 text-xs font-medium tabular-nums text-sealed"
          aria-hidden
        >
          {count}
        </span>
      </Link>
    </div>
  );
}
