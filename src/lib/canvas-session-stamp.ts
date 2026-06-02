/**
 * Frozen journal header time for an active canvas visit.
 * - In-memory map: survives React Strict Mode remounts.
 * - sessionStorage: survives page refresh in the same tab.
 */

import { clearCompanionSession } from "@/lib/companion-session";

const SESSION_HEADER_PREFIX = "keeps-canvas-header-";

const calendarDayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const stampForOpen = (lastEditedAt: number | undefined, now: number): number => {
  if (
    typeof lastEditedAt !== "number" ||
    !Number.isFinite(lastEditedAt)
  ) {
    return now;
  }
  if (calendarDayKey(lastEditedAt) !== calendarDayKey(now)) {
    return now;
  }
  return lastEditedAt;
};

const sessionStorageKey = (bookId: string) =>
  `${SESSION_HEADER_PREFIX}${bookId}`;

const readTabSessionStamp = (bookId: string): number | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(sessionStorageKey(bookId));
    if (!raw) return undefined;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : undefined;
  } catch {
    return undefined;
  }
};

const writeTabSessionStamp = (bookId: string, stamp: number) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(sessionStorageKey(bookId), String(stamp));
  } catch {
    /* quota / private mode */
  }
};

const clearTabSessionStamp = (bookId: string) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(sessionStorageKey(bookId));
  } catch {
    /* noop */
  }
};

const activeStamps = new Map<string, number>();

/** Frozen journal header time for this visit (refresh-safe in the same tab). */
export const claimCanvasSessionStamp = (
  bookId: string,
  persistedLastEditedAt?: number
): number => {
  const inMemory = activeStamps.get(bookId);
  if (inMemory !== undefined) return inMemory;

  const tabSession = readTabSessionStamp(bookId);
  if (tabSession !== undefined) {
    activeStamps.set(bookId, tabSession);
    return tabSession;
  }

  const stamp = stampForOpen(persistedLastEditedAt, Date.now());
  activeStamps.set(bookId, stamp);
  writeTabSessionStamp(bookId, stamp);
  clearCompanionSession(bookId);
  return stamp;
};

/** Call when the user leaves via the back button (not on refresh). */
export const endCanvasSession = (bookId: string): void => {
  activeStamps.delete(bookId);
  clearTabSessionStamp(bookId);
  clearCompanionSession(bookId);
};
