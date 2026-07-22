"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  X,
} from "lucide-react";
import {
  btnIconTransparent,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import {
  deleteEntry,
  ENTRIES_UPDATED_EVENT,
  ENTRY_DRAFTS_STORAGE_KEY,
  readAllEntries,
  type JournalEntry,
} from "@/lib/journal-entries";
import { resolveNewEntryTarget } from "@/lib/entry-draft";
import { useInitialSyncReady } from "@/lib/sync/use-initial-sync-ready";
import { SidebarEntriesSkeleton } from "@/components/sidebar/sidebar-entries-skeleton";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSurfacedPatterns } from "@/hooks/use-surfaced-patterns";
import { PatternsSidebarLink } from "@/components/sidebar/patterns-sidebar-link";
import { SidebarAccountMenu } from "@/components/sidebar/sidebar-account-menu";
import { OVERLAY_NAV_QUERY } from "@/lib/breakpoints";
import { OPEN_NAV_EVENT } from "@/lib/layout";
import { resolvePreferredName } from "@/lib/user-display";

const UNTITLED_ENTRY = "Untitled";
const SIDEBAR_COLLAPSED_KEY = "unfold-sidebar-collapsed";
const SIDEBAR_WIDTH_CLASS = "w-(--sidebar-width)";
const SIDEBAR_TOGGLE_SIZE = "xs" as const;
const SIDEBAR_ACTION_SIZE = "xs" as const;
const OVERLAY_OPACITY_TRANSITION =
  "transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
const OVERLAY_TRANSFORM_TRANSITION =
  "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
const SIDEBAR_WIDTH_TRANSITION =
  "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
const SIDEBAR_ANIMATION_MS = 300;

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

  // Empty on first paint so SSR and client HTML match; hydrate from localStorage
  // in useLayoutEffect (below) before the browser paints.
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const isOverlayNav = useMediaQuery(OVERLAY_NAV_QUERY);
  const [collapsed, setCollapsed] = useState(false);
  const initialSyncReady = useInitialSyncReady();
  const showEntriesSkeleton = !initialSyncReady && entries.length === 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia(OVERLAY_NAV_QUERY).matches) {
      setCollapsed(true);
      return;
    }
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // ignore storage read errors
    }
  }, []);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevPathnameRef = useRef(pathname);
  const { hasSurfaced: hasSurfacedPatterns, count: surfacedPatternCount } =
    useSurfacedPatterns();

  useLayoutEffect(() => {
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
  const isEntriesActive =
    !isPatternsActive &&
    (pathname === "/dashboard" ||
      (pathname?.startsWith("/dashboard/journal") ?? false));

  const displayName = !isLoaded
    ? null
    : user
      ? (resolvePreferredName(user) || user.username || null)
      : "Anonymous";

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

  const handleNewEntry = () => {
    // Seal/title work for the previous entry continues in journal-seal.ts —
    // do not wait for the stamp animation. Create (or reuse) then navigate
    // immediately; refresh the list so the new row is selected on arrival.
    const { id } = resolveNewEntryTarget();
    setEntries(readAllEntries());
    router.push(`/dashboard/journal/${id}?new=1`);
    closeOverlayNav();
  };

  const handleDeleteEntry = (id: string) => {
    const wasActive = id === activeEntryId;
    deleteEntry(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));

    if (!wasActive) return;

    const remaining = readAllEntries();
    if (remaining.length > 0) {
      setEntries(remaining);
      router.replace(`/dashboard/journal/${remaining[0].id}`);
      return;
    }

    const { id: newId } = resolveNewEntryTarget();
    setEntries(readAllEntries());
    router.replace(`/dashboard/journal/${newId}?new=1`);
  };

  useEffect(() => {
    const wasPatterns = prevPathnameRef.current?.startsWith("/dashboard/patterns");
    prevPathnameRef.current = pathname;

    if (isOverlayNav) {
      setCollapsed(true);
      return;
    }

    if (isPatternsActive) {
      closeSearch();
      return;
    }

    // Defer expand so Patterns → Journal doesn't layout-thrash against
    // CanvasBoard cold-start (quote clicks feel especially slow otherwise).
    if (isEntriesActive && wasPatterns) {
      const timer = window.setTimeout(() => {
        setCollapsed(false);
        persistCollapsed(false);
      }, SIDEBAR_ANIMATION_MS);
      return () => window.clearTimeout(timer);
    }
  }, [pathname, isOverlayNav, isPatternsActive, isEntriesActive]);

  const handlePatternsNav = () => {
    closeSearch();
    closeOverlayNav();
  };

  const desktopSidebarClosed = collapsed || isPatternsActive;
  // Fixed hamburger stays on journal only. Patterns uses an in-flow control
  // so accordion titles never slide under a floating menu.
  const canShowMenuToggle = collapsed && !isPatternsActive;
  const [menuToggleVisible, setMenuToggleVisible] = useState(false);
  const prevCanShowMenuToggleRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!canShowMenuToggle) {
      setMenuToggleVisible(false);
      prevCanShowMenuToggleRef.current = false;
      return;
    }

    if (prevCanShowMenuToggleRef.current !== false) {
      setMenuToggleVisible(true);
      prevCanShowMenuToggleRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      setMenuToggleVisible(true);
      prevCanShowMenuToggleRef.current = true;
    }, SIDEBAR_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [canShowMenuToggle]);

  useEffect(() => {
    const onOpenNav = () => {
      setCollapsed(false);
      if (isOverlayNav) return;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "false");
      } catch {
        // ignore storage write errors
      }
    };
    window.addEventListener(OPEN_NAV_EVENT, onOpenNav);
    return () => window.removeEventListener(OPEN_NAV_EVENT, onOpenNav);
  }, [isOverlayNav]);

  const menuToggle = (
    <button
      type="button"
      onClick={expandSidebar}
      aria-label="Open menu"
      className={`shrink-0 ${btnIconTransparent(SIDEBAR_TOGGLE_SIZE)}`}
    >
      <Menu
        size={iconPx(SIDEBAR_TOGGLE_SIZE)}
        strokeWidth={iconStroke(SIDEBAR_TOGGLE_SIZE)}
        aria-hidden
        className={iconFixed}
      />
    </button>
  );

  const sidebarContent = (
    <div className="relative flex h-full min-h-0 flex-col gap-3 px-2 pb-4">
      {hasSurfacedPatterns ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32 bg-linear-to-b from-transparent via-(--sidebar-bg)/40 to-(--sidebar-bg)"
        />
      ) : null}

      <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 pb-3 pt-5 pl-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarAccountMenu />
          <p
            className="min-w-0 flex-1 truncate text-[1rem] font-bold leading-tight tracking-tight text-(--canvas-title-ink)"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {displayName ? `${displayName}\u2019s ` : ""}Unfold
          </p>
        </div>
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
      </div>

      <section
        className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
        aria-label="Entries"
      >
        <div className="flex h-9 shrink-0 items-center px-2">
          {searchOpen ? (
            <div className="flex h-full w-full items-center gap-2 rounded-md bg-(--sidebar-active-bg) px-3">
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
                placeholder="Search"
                aria-label="Search entries"
                className="w-full min-w-0 bg-transparent text-sm text-(--sidebar-ink) outline-none placeholder:text-(--sidebar-ink-soft)"
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
              <span className="min-w-0 flex-1 truncate text-xs font-medium tracking-[0.01em] text-tertiary ">
                Recent entries
              </span>
              <div className="flex shrink-0 items-center gap-1">
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
              </div>
            </>
          )}
        </div>

        <div className="relative min-h-0 flex-1">
          <nav
            className="sidebar-entries-scroll min-h-0 h-full overflow-y-auto overscroll-y-contain"
            aria-label="Entries"
          >
          {showEntriesSkeleton ? (
            <SidebarEntriesSkeleton />
          ) : filteredEntries.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-(--sidebar-ink-soft)">
              {entries.length === 0 ? "No entries yet" : "No matches"}
            </p>
          ) : (
            <ul className="flex flex-col gap-1 px-2 pb-4">
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
                      "group relative rounded-md transition-colors duration-150",
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
                    <div
                      className={clsx(
                        "pointer-events-none relative flex flex-col gap-0.5 px-2.75 py-2.5",
                        isSealed && "opacity-78",
                      )}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span
                          className={clsx(
                            "block min-w-0 flex-1 truncate text-sm leading-snug",
                            isSealed
                              ? "font-medium text-sealed"
                              : clsx(
                                  isPlaceholder ? "font-medium" : "font-semibold",
                                  "text-primary opacity-80",
                                ),
                          )}
                        >
                          {displayTitle}
                        </span>
                        <span
                          className={clsx(
                            "flex shrink-0 items-center gap-1.5 pt-0.5 text-xs",
                            isSealed ? "text-sealed" : "text-secondary opacity-90",
                          )}
                        >
                          <span className="tabular-nums leading-none">
                            {relativeTime}
                          </span>
                          <button
                            type="button"
                            aria-label="Delete entry"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleDeleteEntry(entry.id);
                            }}
                            className="pointer-events-auto hidden h-3 w-3 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-(--sidebar-icon) transition-[color] duration-150 hover:text-(--sidebar-ink) focus-visible:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 group-hover:inline-flex"
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
                          "min-w-0 max-w-[88%] truncate text-sm font-normal leading-snug",
                          isSealed
                            ? "text-sealed"
                            : "text-secondary opacity-90",
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

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-(--sidebar-bg)/85 backdrop-blur-[0.1875rem] [mask-image:linear-gradient(to_bottom,transparent,black_55%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_55%)]"
          />
        </div>
      </section>

      {hasSurfacedPatterns ? (
        <div className="relative z-10">
          <PatternsSidebarLink
            count={surfacedPatternCount}
            active={isPatternsActive}
            onOpen={handlePatternsNav}
          />
        </div>
      ) : null}
    </div>
  );

  const sidebarPanel = (
    <aside
      className={clsx(
        "flex h-full min-h-0 flex-col overflow-hidden border-r border-(--sidebar-border) bg-(--sidebar-bg)",
        SIDEBAR_WIDTH_CLASS,
        isOverlayNav && "shadow-[0.25rem_0_1.5rem_rgba(0,0,0,0.08)]",
      )}
      aria-hidden={isOverlayNav && collapsed ? true : undefined}
      inert={isOverlayNav && collapsed ? true : undefined}
    >
      {sidebarContent}
    </aside>
  );

  const collapsedMenuToggle = (
    <div
      className={clsx(
        // Match page `px-4` / `sm:px-5` plus body safe-area so the icon
        // shares a left edge with Patterns / journal titles.
        "fixed z-20 left-[calc(env(safe-area-inset-left,0)+1rem)] sm:left-[calc(env(safe-area-inset-left,0)+1.25rem)]",
        OVERLAY_OPACITY_TRANSITION,
        menuToggleVisible
          ? "opacity-100"
          : "pointer-events-none opacity-0",
      )}
      style={{
        top: "max(1.5rem, env(safe-area-inset-top))",
      }}
    >
      {menuToggle}
    </div>
  );

  const desktopSidebar = (
    <>
      <div
        className={clsx(
          "relative h-full shrink-0 overflow-hidden",
          SIDEBAR_WIDTH_TRANSITION,
          desktopSidebarClosed ? "w-0" : SIDEBAR_WIDTH_CLASS,
        )}
        aria-hidden={desktopSidebarClosed}
      >
        <div className={clsx("absolute inset-y-0 left-0", SIDEBAR_WIDTH_CLASS)}>
          {sidebarPanel}
        </div>
      </div>
    </>
  );

  if (isOverlayNav) {
    const drawerOpen = !collapsed;

    return (
      <>
        {collapsedMenuToggle}

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

  return (
    <>
      {collapsedMenuToggle}
      {desktopSidebar}
    </>
  );
}
