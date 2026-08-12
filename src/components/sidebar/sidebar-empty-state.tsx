import type { ReactNode } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

type SidebarEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  /** Tighter padding + smaller medallion for secondary states (e.g. no search matches). */
  compact?: boolean;
};

/**
 * Calm empty state for sidebar panels: a layered tinted medallion (Entry
 * sidebar chrome tokens), short copy, optional CTA.
 * Vertically centers itself inside the sidebar scroll areas.
 */
export function SidebarEmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact = false,
}: SidebarEmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex min-h-full flex-col items-center justify-center text-center",
        "animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none",
        compact ? "gap-2.5 px-3 py-8" : "gap-3 px-3 py-10",
      )}
    >
      <div
        className={clsx(
          "relative flex items-center justify-center",
          compact ? "size-11" : "size-14",
        )}
      >
        <div
          aria-hidden
          className="absolute -inset-1.5 rounded-full border border-dashed border-(--border)"
        />
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-(--sidebar-hover-bg)"
        />
        <div
          aria-hidden
          className={clsx(
            "absolute rounded-full bg-(--sidebar-entry-pressed-bg)",
            compact ? "inset-1" : "inset-1.5",
          )}
        />
        <Icon
          size={compact ? 16 : 20}
          strokeWidth={1.6}
          aria-hidden
          className="relative text-(--accent) opacity-80"
        />
      </div>
      <div className="flex max-w-56 flex-col gap-1">
        <p className={compact ? "text-sm font-medium text-primary" : "header-sm"}>
          {title}
        </p>
        <p className="text-xs leading-relaxed text-tertiary">{body}</p>
      </div>
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}
