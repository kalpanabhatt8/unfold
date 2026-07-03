"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ChevronsLeft,
  Menu,
  Plus,
  Search,
  Trash2,
  Waypoints,
  X,
} from "lucide-react";
import {
  btnIcon,
  btnIconTransparent,
  btnState,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import { Tooltip } from "@/components/ui/tooltip";
import {
  createEntryId,
  deleteEntry,
  ENTRIES_UPDATED_EVENT,
  ENTRY_DRAFTS_STORAGE_KEY,
  readAllEntries,
  upsertEntry,
  type JournalEntry,
} from "@/lib/journal-entries";
import { useMediaQuery } from "@/hooks/use-media-query";

const UNTITLED_ENTRY = "Untitled";
const OVERLAY_NAV_QUERY = "(max-width: 1023px)";
const SIDEBAR_COLLAPSED_KEY = "keeps-sidebar-collapsed";
const SIDEBAR_TOGGLE_SIZE = "xs" as const;
const SIDEBAR_ACTION_SIZE = "xs" as const;
const sidebarToggleFilledClass = `${btnIcon(SIDEBAR_TOGGLE_SIZE, "soft")} ${btnState.default} ${btnState.hover} ${btnState.active}`;
const OVERLAY_OPACITY_TRANSITION =
  "transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
const OVERLAY_TRANSFORM_TRANSITION =
  "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

function resolveEntryTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : UNTITLED_ENTRY;
}

/** "1s" / "5m" / "2h" / "1d" shorthand relative time. */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${Math.max(1, diffSec)}s`;

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 24) return `${diffHours}h`;

  const date = new Date(timestamp);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(new Date(now));
  const entryDay = startOfDay(date);
  const diffDays = Math.max(1, Math.round((today - entryDay) / 86_400_000));

  return `${diffDays}d`;
}

function entryPreview(entry: JournalEntry): string {
  const text = (entry.searchText ?? "").replace(/\s+/g, " ").trim();
  return text;
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const activeEntryId = params?.id;
  const { user, isLoaded } = useUser();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const isOverlayNav = useMediaQuery(OVERLAY_NAV_QUERY);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia(OVERLAY_NAV_QUERY).matches) return true;
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOverlayNav) {
      setCollapsed(true);
      return;
    }
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // ignore storage read errors
    }
  }, [isOverlayNav]);

  useEffect(() => {
    const load = () => {
      try {
        setEntries(readAllEntries());
      } catch (error) {
        console.error("Failed to read journal entries", error);
      }
    };

    load();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === ENTRY_DRAFTS_STORAGE_KEY) load();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(ENTRIES_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, load);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const titleMatch = resolveEntryTitle(entry.title).toLowerCase().includes(q);
      const contentMatch = (entry.searchText ?? "").toLowerCase().includes(q);
      return titleMatch || contentMatch;
    });
  }, [entries, query]);

  const isPatternsActive = pathname?.startsWith("/dashboard/patterns") ?? false;

  const displayName = !isLoaded
    ? null
    : user
      ? (user.firstName ?? user.username ?? null)
      : "Anonymous";

  const handleNewEntry = () => {
    const id = createEntryId();
    upsertEntry(id, { title: "" });
    router.push(`/dashboard/journal/${id}?new=1`);
  };

  const handleDeleteEntry = (id: string) => {
    const wasActive = id === activeEntryId;
    deleteEntry(id);
    if (wasActive) router.push("/dashboard");
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  const persistCollapsed = (next: boolean) => {
    if (isOverlayNav) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch {
      // ignore storage write errors
    }
  };

  const expandSidebar = () => {
    setCollapsed(false);
    persistCollapsed(false);
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      persistCollapsed(next);
      if (next) closeSearch();
      return next;
    });
  };

  const closeOverlayNav = () => {
    if (!isOverlayNav) return;
    setCollapsed(true);
    closeSearch();
  };

  const menuToggle = (
    <Tooltip content="Open menu">
      <button
        type="button"
        onClick={expandSidebar}
        aria-label="Open menu"
        className={`shrink-0 ${sidebarToggleFilledClass}`}
      >
        <Menu
          size={iconPx(SIDEBAR_TOGGLE_SIZE)}
          strokeWidth={iconStroke(SIDEBAR_TOGGLE_SIZE)}
          aria-hidden
          className={iconFixed}
        />
      </button>
    </Tooltip>
  );

  if (collapsed && !isOverlayNav) {
    return (
      <div className="fixed left-4 top-6 z-30">
        {menuToggle}
      </div>
    );
  }

  const sidebarPanel = (
    <aside
      className={clsx(
        "flex h-full min-h-0 w-[min(280px,88vw)] shrink-0 flex-col overflow-hidden border-r border-(--sidebar-border) bg-(--sidebar-bg) sm:w-[264px]",
        isOverlayNav && "shadow-[4px_0_24px_rgba(0,0,0,0.08)]",
        !isOverlayNav && "relative",
      )}
      aria-hidden={isOverlayNav && collapsed ? true : undefined}
      inert={isOverlayNav && collapsed ? true : undefined}
    >
      <div className="flex min-h-0 flex-1 flex-col px-5">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 pt-6 pb-8">
          <p
            className="min-w-0 flex-1 truncate text-[1rem] font-bold leading-tight tracking-tight text-(--canvas-title-ink)"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {displayName ? `${displayName}\u2019s ` : ""}Unfold
          </p>
          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip content="Patterns">
              <Link
                href="/dashboard/patterns"
                onClick={closeOverlayNav}
                aria-label="Patterns"
                aria-current={isPatternsActive ? "page" : undefined}
                className={clsx(
                  btnIconTransparent(SIDEBAR_ACTION_SIZE),
                  isPatternsActive
                    ? "text-(--sidebar-ink)"
                    : "text-(--sidebar-icon) hover:text-(--sidebar-ink)",
                )}
              >
                <Waypoints
                  size={iconPx(SIDEBAR_ACTION_SIZE)}
                  strokeWidth={iconStroke(SIDEBAR_ACTION_SIZE)}
                  aria-hidden
                  className={iconFixed}
                />
              </Link>
            </Tooltip>
            <Tooltip content="Close menu">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Close menu"
                className={`shrink-0 ${btnIconTransparent(SIDEBAR_TOGGLE_SIZE)}`}
              >
                <ChevronsLeft
                  size={iconPx(SIDEBAR_TOGGLE_SIZE)}
                  strokeWidth={iconStroke(SIDEBAR_TOGGLE_SIZE)}
                  aria-hidden
                  className={iconFixed}
                />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Entries section header (swaps to inline search when active) */}
        <div className="mb-3 flex h-8 shrink-0 items-center justify-between">
          {searchOpen ? (
            <div className="flex h-full w-full items-center gap-2 rounded-[7px] bg-(--sidebar-hover-bg) px-2.5">
              <Search
                size={14}
                strokeWidth={1.75}
                className="shrink-0 text-(--sidebar-icon)"
                aria-hidden
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeSearch();
                }}
                placeholder="Search entries"
                aria-label="Search entries"
                className="w-full bg-transparent text-sm text-(--sidebar-ink) outline-none placeholder:text-(--sidebar-ink-soft)"
              />
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="flex shrink-0 items-center justify-center text-(--sidebar-icon) transition-colors duration-150 hover:text-(--sidebar-ink)"
              >
                <X size={14} strokeWidth={1.9} aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <span className="text-sm font-medium text-tertiary">Entries</span>
              <div className="flex items-center gap-0.5">
                <Tooltip content="Search entries">
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    aria-label="Search entries"
                    className={`shrink-0 ${btnIconTransparent(SIDEBAR_ACTION_SIZE)}`}
                  >
                    <Search
                      size={iconPx(SIDEBAR_ACTION_SIZE)}
                      strokeWidth={iconStroke(SIDEBAR_ACTION_SIZE)}
                      aria-hidden
                      className={iconFixed}
                    />
                  </button>
                </Tooltip>
                <Tooltip content="New entry">
                  <button
                    type="button"
                    onClick={handleNewEntry}
                    aria-label="New entry"
                    className={`shrink-0 ${btnIconTransparent(SIDEBAR_ACTION_SIZE)}`}
                  >
                    <Plus
                      size={iconPx(SIDEBAR_ACTION_SIZE)}
                      strokeWidth={iconStroke(SIDEBAR_ACTION_SIZE)}
                      aria-hidden
                      className={iconFixed}
                    />
                  </button>
                </Tooltip>
              </div>
            </>
          )}
        </div>

        {/* Entry list */}
        <nav
          className="sidebar-entries-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-4"
          aria-label="Journal entries"
        >
          {filteredEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-(--sidebar-ink-soft)">
              {entries.length === 0 ? "No entries yet" : "No matches"}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {filteredEntries.map((entry) => {
                const isActive = entry.id === activeEntryId;
                const isSealed = typeof entry.sealedAt === "number";
                const displayTitle = resolveEntryTitle(entry.title);
                const isPlaceholder = displayTitle === UNTITLED_ENTRY;
                const preview = entryPreview(entry);
                const relativeTime = formatRelativeTime(entry.createdAt);

                return (
                  <li
                    key={entry.id}
                    className={clsx(
                      "group relative rounded-lg transition-colors duration-150",
                      isActive
                        ? "bg-(--sidebar-active-bg)"
                        : "hover:bg-(--sidebar-hover-bg)",
                    )}
                  >
                    <Link
                      href={`/dashboard/journal/${entry.id}`}
                      onClick={closeOverlayNav}
                      aria-label={`Open ${displayTitle}`}
                      className="absolute inset-0 z-0 rounded-lg"
                    />
                    <div className="pointer-events-none relative flex flex-col gap-0.5 px-3 py-2.5">
                      <span className="flex items-start justify-between gap-3">
                        <span
                          className={clsx(
                            "block min-w-0 flex-1 truncate text-sm leading-snug",
                            isSealed && "text-disabled",
                            !isSealed &&
                              (isActive
                                ? "font-semibold text-active"
                                : "font-semibold text-active"),
                            !isSealed && isPlaceholder && "font-medium text-secondary",
                          )}
                        >
                          {displayTitle}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs text-(--sidebar-ink-soft)">
                          <span className="tabular-nums leading-none">
                            {relativeTime}
                          </span>
                          <button
                            type="button"
                            aria-label="Delete entry"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleDeleteEntry(entry.id);
                            }}
                            className="pointer-events-auto hidden h-3 w-3 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-(--sidebar-icon) transition-[color] duration-150 hover:text-(--sidebar-ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 group-hover:inline-flex group-focus-within:inline-flex"
                          >
                            <Trash2
                              size={12}
                              strokeWidth={1.75}
                              aria-hidden
                              className={iconFixed}
                            />
                          </button>
                        </span>
                      </span>
                      <span
                        className={clsx(
                          "truncate text-sm font-normal leading-snug",
                          isSealed
                            ? "text-disabled"
                            : "text-(--sidebar-ink-soft)",
                        )}
                      >
                        {preview || "No additional text"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </div>
    </aside>
  );

  if (isOverlayNav) {
    const drawerOpen = !collapsed;

    return (
      <>
        <div
          className={clsx(
            "fixed left-4 top-[max(1.5rem,env(safe-area-inset-top))] z-50",
            OVERLAY_OPACITY_TRANSITION,
            drawerOpen ? "pointer-events-none opacity-0" : "opacity-100",
          )}
        >
          {menuToggle}
        </div>

        <div
          className={clsx(
            "fixed inset-0 z-30",
            !drawerOpen && "pointer-events-none",
          )}
          aria-hidden={!drawerOpen}
        >
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={drawerOpen ? 0 : -1}
            className={clsx(
              "absolute inset-0 bg-black/22",
              OVERLAY_OPACITY_TRANSITION,
              drawerOpen ? "opacity-100" : "opacity-0",
            )}
            onClick={toggleCollapsed}
          />

          <div
            className={clsx(
              "absolute inset-y-0 left-0 z-10 transform-gpu will-change-transform",
              OVERLAY_TRANSFORM_TRANSITION,
              drawerOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            {sidebarPanel}
          </div>
        </div>
      </>
    );
  }

  return sidebarPanel;
}
