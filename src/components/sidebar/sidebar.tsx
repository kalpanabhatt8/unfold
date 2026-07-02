"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ChevronsLeft,
  Lock,
  Menu,
  Notebook,
  Plus,
  Search,
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
  ENTRIES_UPDATED_EVENT,
  ENTRY_DRAFTS_STORAGE_KEY,
  readAllEntries,
  upsertEntry,
  type JournalEntry,
} from "@/lib/journal-entries";
import { SidebarTab } from "@/components/sidebar/sidebar-tab";

const UNTITLED_ENTRY = "Untitled";
const SIDEBAR_COLLAPSED_KEY = "keeps-sidebar-collapsed";
const SIDEBAR_TOGGLE_SIZE = "xs" as const;
const SIDEBAR_ACTION_SIZE = "xs" as const;
const sidebarToggleFilledClass = `${btnIcon(SIDEBAR_TOGGLE_SIZE, "soft")} ${btnState.default} ${btnState.hover} ${btnState.active}`;

function resolveEntryTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : UNTITLED_ENTRY;
}

/** "just now" / "5m" / "2h" for today, then Yesterday / weekday / short date. */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m`;

  const date = new Date(timestamp);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(new Date(now));
  const entryDay = startOfDay(date);
  const diffDays = Math.round((today - entryDay) / 86_400_000);

  if (diffDays === 0) return `${Math.floor(diffMin / 60)}h`;
  if (diffDays === 1) return "Yesterday";

  const startOfWeek = startOfDay(
    new Date(
      new Date(now).getFullYear(),
      new Date(now).getMonth(),
      new Date(now).getDate() - new Date(now).getDay(),
    ),
  );
  if (diffDays > 1 && entryDay >= startOfWeek) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const [collapsed, setCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // ignore storage read errors
    }
  }, []);

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
  const isJournalActive = !isPatternsActive;

  const lastEntryId = activeEntryId ?? entries[0]?.id;
  const journalHref = lastEntryId
    ? `/dashboard/journal/${lastEntryId}`
    : "/dashboard";

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

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  const expandSidebar = () => {
    setCollapsed(false);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "false");
    } catch {
      // ignore storage write errors
    }
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore storage write errors
      }
      if (next) closeSearch();
      return next;
    });
  };

  const avatar = (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-(--sidebar-active-bg) text-[0.78rem] font-semibold text-(--sidebar-ink)"
      aria-hidden
    >
      {user?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : isLoaded && !user ? (
        "A"
      ) : null}
    </span>
  );

  if (collapsed) {
    return (
      <Tooltip content="Open menu" className="fixed left-4 top-6 z-30">
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
  }

  return (
    <aside className="flex h-full min-h-0 w-[264px] shrink-0 flex-col overflow-hidden border-r border-(--sidebar-border) bg-(--sidebar-bg)">
      <div className="shrink-0 px-2.5">
        {/* Header */}
        <div className="flex items-center gap-3 pt-6 pb-4">
          {avatar}
          <p
            className="min-w-0 flex-1 truncate text-[1rem] font-bold leading-tight tracking-tight text-(--canvas-title-ink)"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {displayName ? `${displayName}\u2019s ` : ""}Unfold
          </p>
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

        {/* Home / Pattern tabs */}
        <div className="flex items-center gap-1 pb-4">
          <SidebarTab
            href={journalHref}
            icon={Notebook}
            label="Entries"
            active={isJournalActive}
          />
          <SidebarTab
            href="/dashboard/patterns"
            icon={Waypoints}
            label="Pattern"
            active={isPatternsActive}
          />
        </div>

        {/* Entries section header (swaps to inline search when active) */}
        <div className="my-2 flex h-8 items-center justify-between mb-2">
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
              <span className="text-sm text-tertiary font-medium pl-2">Entries</span>
              <div className="flex items-center gap-1">
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
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2"
        aria-label="Journal entries"
      >
        {filteredEntries.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-(--sidebar-ink-soft)">
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

              return (
                <li key={entry.id}>
                  <Link
                    href={`/dashboard/journal/${entry.id}`}
                    className={clsx(
                      "flex flex-col gap-0 rounded-sm px-3 py-2.5 transition-colors duration-150",
                      isActive
                        ? "bg-(--sidebar-active-bg)"
                        : "hover:bg-(--sidebar-hover-bg)",
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className={clsx(
                          "truncate text-sm",
                          isSealed && "text-disabled",
                          !isSealed && isPlaceholder && "text-secondary font-medium",
                          !isSealed && !isPlaceholder && "text-active font-semibold",
                        )}
                      >
                        {displayTitle}
                      </span>
                      <span className="text-xs text-tertiary flex shrink-0 items-center gap-1">
                        {isSealed ? (
                          <Lock
                            size={10}
                            strokeWidth={1.9}
                            aria-hidden
                            className="text-(--sidebar-icon)"
                          />
                        ) : null}
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </span>
                    <span className="text-xs text-tertiary truncate">
                      {preview || "No additional text"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}
