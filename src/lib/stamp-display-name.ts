/**
 * Shared stamp display-name cache + preferred-name resolution for the seal.
 * Kept outside the stamp component so account settings can update the cache
 * when the user changes their preferred name.
 */

import type { UserResource } from "@clerk/types";
import { resolvePreferredName } from "@/lib/user-display";

export const STAMP_NAME_CACHE_KEY = "keeps-stamp-display-name-v2";

export function readStampDisplayNameCache(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STAMP_NAME_CACHE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function cacheStampDisplayName(name: string) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = name.trim();
    if (trimmed) {
      window.localStorage.setItem(STAMP_NAME_CACHE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(STAMP_NAME_CACHE_KEY);
    }
  } catch {
    /* noop */
  }
}

/** Prefer account preferred name, then fall back to caller-provided resolution. */
export function resolveStampNameFromUser(
  user: UserResource | null | undefined,
  fallback: string,
): string {
  const preferred = resolvePreferredName(user);
  if (preferred) return preferred;
  return fallback.trim();
}
