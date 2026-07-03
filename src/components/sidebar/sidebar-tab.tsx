"use client";

import React from "react";
import clsx from "clsx";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  btnIconTransparent,
  btnState,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";

export type SidebarNavItemProps = {
  /** Destination route. Omit for a non-navigating tab (pair with `onClick`). */
  href?: string;
  icon: LucideIcon;
  label: string;
  /** Highlighted / selected state. */
  active?: boolean;
  /** Non-interactive, faded state. */
  disabled?: boolean;
  /** Icon-only layout for collapsed sidebar. */
  iconOnly?: boolean;
  /** Optional element rendered at the end of the row (e.g. an action button). */
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

/**
 * Sidebar switcher tab (Home / Pattern). Every visual state lives here:
 *   - active:   filled pill + `text-active`
 *   - default:  `text-tertiary` with hover surface + ink
 *   - disabled: `text-disabled`, non-interactive
 * Renders as a `Link` when `href` is set, otherwise a `button`.
 */
export function SidebarNavItem({
  href,
  icon: Icon,
  label,
  active = false,
  disabled = false,
  iconOnly = false,
  trailing,
  onClick,
  className,
}: SidebarNavItemProps) {
  const iconSize = iconOnly ? "sm" : "xs";

  const classes = clsx(
    "flex items-center text-sm font-medium transition-colors duration-150",
    iconOnly
      ? btnIconTransparent("sm")
      : "gap-1.5 rounded-[7px] px-2.5 py-1.5",
    !iconOnly &&
      (disabled
        ? "text-disabled pointer-events-none"
        : active
          ? "text-active bg-(--sidebar-active-bg)"
          : "text-tertiary hover:bg-(--sidebar-hover-bg) hover:text-(--sidebar-ink)"),
    iconOnly &&
      (disabled
        ? btnState.disabled
        : active
          ? btnState.selected
          : null),
    className,
  );

  const content = (
    <>
      <Icon
        size={iconPx(iconSize)}
        strokeWidth={iconStroke(iconSize)}
        aria-hidden
        className={iconFixed}
      />
      {!iconOnly ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
      {!iconOnly && trailing ? (
        <span className="flex shrink-0 items-center">{trailing}</span>
      ) : null}
    </>
  );

  const a11yLabel = iconOnly ? label : undefined;

  if (href && !disabled) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={a11yLabel}
        title={a11yLabel}
        className={classes}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      aria-disabled={disabled || undefined}
      aria-label={a11yLabel}
      title={a11yLabel}
      className={classes}
    >
      {content}
    </button>
  );
}
