"use client";

/**
 * Mounts the sync engine for the dashboard. Clears local caches when the
 * signed-in user changes, then full sync on load (and when the tab regains
 * focus after a while); debounced push whenever local stores flag dirty data.
 *
 * `userId` comes from the server so the cache scope is settled on the first
 * commit. The sync engine blocks on that scope, and layout effects run before
 * any page's passive effect, so a wipe can never land inside a sync pass.
 */

import { useEffect, useLayoutEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { ensureAuthUserScope } from "@/lib/clear-local-data";
import { SYNC_DIRTY_EVENT } from "@/lib/sync/local-flags";
import {
  ensureInitialSync,
  fullSync,
  pushSync,
  resetInitialSyncGate,
} from "@/lib/sync/sync-client";
import { markSyncScopeReady } from "@/lib/sync/sync-scope";

const PUSH_DEBOUNCE_MS = 4_000;
const FULL_SYNC_INTERVAL_MS = 5 * 60_000;

export function SyncProvider({ userId }: { userId: string | null }) {
  const { user } = useUser();
  // Server id first; the Clerk hook is only a fallback for an in-session
  // account change, since it resolves long after the first sync would start.
  const scopeUserId = userId ?? user?.id ?? null;

  // Re-scope, then open the gate. Sync waits on the gate, so no pass can have
  // its freshly pulled entries or its cursor wiped out from under it.
  useLayoutEffect(() => {
    if (scopeUserId && ensureAuthUserScope(scopeUserId)) {
      resetInitialSyncGate();
    }
    markSyncScopeReady();
  }, [scopeUserId]);

  useEffect(() => {
    if (!scopeUserId) return;

    void ensureInitialSync();

    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePush = () => {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        pushTimer = null;
        void pushSync();
      }, PUSH_DEBOUNCE_MS);
    };

    let lastFullSyncAt = Date.now();
    const handleVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFullSyncAt < FULL_SYNC_INTERVAL_MS) return;
      lastFullSyncAt = Date.now();
      void fullSync();
    };

    const interval = setInterval(() => {
      lastFullSyncAt = Date.now();
      void fullSync();
    }, FULL_SYNC_INTERVAL_MS);

    window.addEventListener(SYNC_DIRTY_EVENT, schedulePush);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      if (pushTimer) clearTimeout(pushTimer);
      clearInterval(interval);
      window.removeEventListener(SYNC_DIRTY_EVENT, schedulePush);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [scopeUserId]);

  return null;
}
