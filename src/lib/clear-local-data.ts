/**
 * Wipe device-local Unfold caches (journal entries, boards, patterns, sync
 * bookkeeping). Required on sign-out and whenever the signed-in Clerk user
 * changes so one account never reads another's localStorage.
 */

import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";

export const AUTH_USER_STORAGE_KEY = "unfold-auth-user-id";

const UNFOLD_PREFIXES = ["unfold-", "keeps-"] as const;

const isUnfoldKey = (key: string): boolean =>
  UNFOLD_PREFIXES.some((prefix) => key.startsWith(prefix));

const collectPrefixedKeys = (storage: Storage): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && isUnfoldKey(key)) keys.push(key);
  }
  return keys;
};

/** Remove all Unfold product data from local and session storage. */
export function clearLocalUnfoldData(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of collectPrefixedKeys(window.localStorage)) {
      window.localStorage.removeItem(key);
    }
    for (const key of collectPrefixedKeys(window.sessionStorage)) {
      window.sessionStorage.removeItem(key);
    }
    window.dispatchEvent(new Event(ENTRIES_UPDATED_EVENT));
  } catch {
    /* private mode / quota */
  }
}

/**
 * Ensure local caches belong to `userId`. Clears all Unfold data when the
 * signed-in user changes. Returns true when data was wiped.
 */
export function ensureAuthUserScope(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const previous = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (previous === userId) return false;
    clearLocalUnfoldData();
    window.localStorage.setItem(AUTH_USER_STORAGE_KEY, userId);
    return true;
  } catch {
    return false;
  }
}
