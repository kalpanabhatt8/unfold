"use client";

/**
 * Mounts the sync engine for the dashboard. Clears local caches when the
 * signed-in user changes, then full sync on load (and when the tab regains
 * focus after a while); debounced push whenever local stores flag dirty data.
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

const PUSH_DEBOUNCE_MS = 4_000;
const FULL_SYNC_INTERVAL_MS = 5 * 60_000;

export function SyncProvider() {
  const { isSignedIn, user } = useUser();

  useLayoutEffect(() => {
    if (!isSignedIn || !user?.id) return;
    const wiped = ensureAuthUserScope(user.id);
    if (wiped) resetInitialSyncGate();
  }, [isSignedIn, user?.id]);

  useEffect(() => {
    if (!isSignedIn || !user?.id) return;

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
  }, [isSignedIn, user?.id]);

  return null;
}
