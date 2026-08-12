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
  btnIconChrome,
  btnPrimary,
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
import { SidebarEmptyState } from "@/components/sidebar/sidebar-empty-state";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSurfacedPatterns } from "@/hooks/use-surfaced-patterns";
import { usePatternGeneration } from "@/hooks/use-pattern-generation";
import { PatternsSidebarLink } from "@/components/sidebar/patterns-sidebar-link";
import { SidebarAccountMenu } from "@/components/sidebar/sidebar-account-menu";
import { SectionLabel } from "@/components/ui/section-label";
import { JournalInsightsPanel } from "@/components/journal-insights/journal-insights-panel";
import { useJournalInsights } from "@/hooks/use-journal-insights";
import { OVERLAY_NAV_QUERY } from "@/lib/breakpoints";
import {
  OPEN_NAV_EVENT,
  OVERLAY_MENU_ICON_ONLY_CLASS,
  OVERLAY_MENU_INSET_LEFT_CLASS,
} from "@/lib/layout";
import { resolvePreferredName } from "@/lib/user-display";

const UNTITLED_ENTRY = "Untitled";
const SIDEBAR_COLLAPSED_KEY = "unfold-sidebar-collapsed";
const SIDEBAR_WIDTH_CLASS = "w-(--sidebar-width)";
const SIDEBAR_TOGGLE_SIZE = "xs" as const;
const SIDEBAR_ACTION_SIZE = "xs" as const;
/** Brand row: mt-4 + h-7 + mb-2 = 52 — matches SHELL_BRAND_ROW_HEIGHT_PX. */
const SIDEBAR_BRAND_ROW =
  "relative z-20 flex h-7 shrink-0 items-center justify-between gap-2 mt-4 mb-2 pl-4";
const SIDEBAR_BRAND_TITLE =
  "min-w-0 flex-1 truncate text-md font-semibold leading-none tracking-tight text-primary [font-family:var(--font-heading)]";
const OVERLAY_OPACITY_TRANSITION =
  "transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
const OVERLAY_TRANSFORM_TRANSITION =
  "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
const SIDEBAR_WIDTH_TRANSITION =
  "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
/** Soft edge above Patterns / panel bottom — gradient only, no blur (blur cuts mid-glyph). */
const SIDEBAR_SCROLL_FADE =
  "pointer-events-none absolute inset-x-0 bottom-0 z-1 h-10 bg-gradient-to-t from-(--sidebar-bg) from-[12%] to-transparent";
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

type SidebarProps = {
  /**
   * SSR seed from the request pathname (via middleware header). Keeps the
   * Insights vs Entries branch identical on server HTML and the first client
   * paint; `usePathname` then takes over after mount / on client navigations.
   */
  initialPatternsActive?: boolean;
};

export function Sidebar({ initialPatternsActive = false }: SidebarProps) {
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
  const [isPatternsActive, setIsPatternsActive] = useState(initialPatternsActive);
  // Relative labels use Date.now() — empty until mount so SSR/client match.
  const [relativeTimesReady, setRelativeTimesReady] = useState(false);
  // Clerk often has the user on the client before hydration finishes, while SSR
  // still sees isLoaded=false → "Unfold" vs "Name's Unfold". Gate on mount.
  const [hasMounted, setHasMounted] = useState(false);
  const initialSyncReady = useInitialSyncReady();
  const showEntriesSkeleton = !initialSyncReady && entries.length === 0;
  const { summary: journalSummary, ready: journalInsightsReady } =
    useJournalInsights();
  const showSummaryHeading =
    journalInsightsReady && journalSummary.entryCount > 0;

  useEffect(() => {
    setRelativeTimesReady(true);
    setHasMounted(true);
  }, []);

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
  const { count: surfacedPatternCount } = useSurfacedPatterns();
  usePatternGeneration();

  // Sync after mount / client navigations. Initial state comes from the
  // server prop so hydration does not depend on usePathname() matching SSR.
  useEffect(() => {
    setIsPatternsActive(pathname?.startsWith("/dashboard/patterns") ?? false);
  }, [pathname]);

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

  useLayoutEffect(() => {
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

  const isEntriesActive =
    !isPatternsActive &&
    (pathname === "/dashboard" ||
      (pathname?.startsWith("/dashboard/journal") ?? false));

  const displayName =
    !hasMounted || !isLoaded
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
    // Seal/title work for the previous entry continues in journal-seal.ts -
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

    // Patterns swaps the sidebar body to Insights — keep the rail open.
    if (isPatternsActive) {
      closeSearch();
      setCollapsed(false);
      persistCollapsed(false);
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

  const desktopSidebarClosed = collapsed;
  // Patterns overlay keeps its own in-flow Menu; desktop Patterns has none,
  // so show the floating toggle whenever the rail is closed there.
  const canShowMenuToggle =
    collapsed && !(isPatternsActive && isOverlayNav);
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
      className={
        isOverlayNav
          ? OVERLAY_MENU_ICON_ONLY_CLASS
          : `shrink-0 ${btnIconChrome(SIDEBAR_TOGGLE_SIZE)}`
      }
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
    <div className="relative flex h-full min-h-0 flex-col gap-4 px-2 pb-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32 bg-linear-to-b from-transparent via-(--sidebar-bg)/40 to-(--sidebar-bg)"
      />

      {isPatternsActive ? (
        <div className={SIDEBAR_BRAND_ROW}>
          <p className={SIDEBAR_BRAND_TITLE}>Your Journal</p>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Close menu"
            className={`shrink-0 ${btnIconChrome(SIDEBAR_TOGGLE_SIZE)}`}
          >
            <ChevronsLeft
              size={iconPx(SIDEBAR_TOGGLE_SIZE)}
              strokeWidth={iconStroke(SIDEBAR_TOGGLE_SIZE)}
              aria-hidden
              className={iconFixed}
            />
          </button>
        </div>
      ) : (
        <div className={SIDEBAR_BRAND_ROW}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SidebarAccountMenu />
            <p className={SIDEBAR_BRAND_TITLE}>
              {displayName ? `${displayName}\u2019s ` : ""}Unfold
            </p>
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Close menu"
            className={`shrink-0 ${btnIconChrome(SIDEBAR_TOGGLE_SIZE)}`}
          >
            <ChevronsLeft
              size={iconPx(SIDEBAR_TOGGLE_SIZE)}
              strokeWidth={iconStroke(SIDEBAR_TOGGLE_SIZE)}
              aria-hidden
              className={iconFixed}
            />
          </button>
        </div>
      )}

      {isPatternsActive ? (
        <section
          className="relative z-10 -mr-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
          aria-label="Your Journal"
        >
          {showSummaryHeading ? (
            <div className="flex h-9 shrink-0 items-center pl-4 pr-4">
              <SectionLabel>Summary</SectionLabel>
            </div>
          ) : null}
          <div className="relative min-h-0 flex-1">
            <div className="sidebar-entries-scroll min-h-0 h-full overflow-y-auto overscroll-y-contain pl-4 pr-4">
              <JournalInsightsPanel />
            </div>
            <div aria-hidden className={SIDEBAR_SCROLL_FADE} />
          </div>
        </section>
      ) : (
        <section
          className="relative z-10 -mr-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
          aria-label="Entries"
        >
          <div className="flex h-9 shrink-0 items-center pl-4 pr-4">
            {searchOpen ? (
              <div className="flex h-full w-full items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--sidebar-ink-soft)_24%,var(--sidebar-edge-border))] bg-(--sidebar-entry-hover-bg) pl-3 pr-1 shadow-[0_1px_3px_color-mix(in_srgb,var(--sidebar-ink)_6%,transparent)]">
                <Search
                  size={14}
                  strokeWidth={1.8}
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
                  className={`shrink-0 ${btnIconChrome(SIDEBAR_ACTION_SIZE)}`}
                >
                  <X
                    size={iconPx(SIDEBAR_ACTION_SIZE)}
                    strokeWidth={iconStroke(SIDEBAR_ACTION_SIZE)}
                    aria-hidden
                    className={iconFixed}
                  />
                </button>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <SectionLabel>Recent entries</SectionLabel>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    aria-label="Search entries"
                    className={`shrink-0 ${btnIconChrome(SIDEBAR_ACTION_SIZE)}`}
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
                    className={`shrink-0 ${btnIconChrome(SIDEBAR_ACTION_SIZE)}`}
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
              <div className="pl-2 pr-4">
                {entries.length === 0 ? (
                  <SidebarEmptyState
                    title="No entries yet"
                    body="Start with a single line — your recent entries will live here."
                    action={
                      <button
                        type="button"
                        onClick={handleNewEntry}
                        className={btnPrimary("sm")}
                      >
                        <Plus
                          size={iconPx("sm")}
                          strokeWidth={iconStroke("sm")}
                          aria-hidden
                          className={iconFixed}
                        />
                        New entry
                      </button>
                    }
                  />
                ) : (
                  <SidebarEmptyState
                    title="No matches"
                    body="Try a different word or phrase."
                    compact
                  />
                )}
              </div>
            ) : (
              <ul className="flex flex-col gap-1 pl-2 pr-4 pb-10">
                {filteredEntries.map((entry) => {
                  const isActive = entry.id === activeEntryId;
                  const isSealed = typeof entry.sealedAt === "number";
                  const displayTitle = resolveEntryTitle(entry.title);
                  const isPlaceholder = displayTitle === UNTITLED_ENTRY;
                  const preview = entryPreview(entry);
                  const relativeTime = relativeTimesReady
                    ? formatRelativeTime(entry.createdAt)
                    : "";

                  return (
                    <li
                      key={entry.id}
                      className={clsx(
                        "group relative rounded-md transition-colors duration-150",
                        isActive
                          ? "bg-(--sidebar-entry-pressed-bg)"
                          : "hover:bg-(--sidebar-entry-hover-bg)",
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
                          isSealed && "opacity-79",
                        )}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span
                            className={clsx(
                              "block min-w-0 flex-1 truncate text-sm leading-snug",
                              isSealed
                                ? "font-medium text-sealed"
                                : clsx(
                                    isPlaceholder ? "font-medium" : "font-medium",
                                    "text-primary opacity-90",
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
                                strokeWidth={1.8}
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

            <div aria-hidden className={SIDEBAR_SCROLL_FADE} />
          </div>
        </section>
      )}

      {!isPatternsActive ? (
        <div className="relative z-10 pl-2">
          <PatternsSidebarLink
            count={surfacedPatternCount}
            active={false}
            onOpen={handlePatternsNav}
          />
        </div>
      ) : null}
    </div>
  );

  // Desktop: flush left rail. Overlay: full-height drawer (unchanged).
  const sidebarPanel = (
    <aside
      className={clsx(
        "flex h-full min-h-0 flex-col overflow-hidden bg-(--sidebar-bg)",
        SIDEBAR_WIDTH_CLASS,
        "border-r border-(--sidebar-edge-border)",
        isOverlayNav &&
          "shadow-[0.25rem_0_1.5rem_rgba(0,0,0,0.08)]",
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
        "fixed z-20",
        OVERLAY_MENU_INSET_LEFT_CLASS,
        OVERLAY_OPACITY_TRANSITION,
        menuToggleVisible
          ? "opacity-100"
          : "pointer-events-none opacity-0",
      )}
      style={{
        top: "max(1rem, env(safe-area-inset-top))",
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
        <div
          className={clsx(
            "absolute inset-y-0 left-0 box-border",
            SIDEBAR_WIDTH_CLASS,
          )}
        >
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
