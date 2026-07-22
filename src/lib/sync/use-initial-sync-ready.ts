"use client";

/**
 * True once the first post-sign-in sync has settled, or local entries already
 * exist (warm cache). Used to show entry/canvas skeletons instead of an empty
 * flash while cloud data is still loading after a wipe.
 *
 * Always starts `false` so SSR and the client's first paint match (localStorage
 * is unavailable on the server). Warm cache is applied in useLayoutEffect.
 */

import { useLayoutEffect, useState } from "react";
import { ENTRIES_UPDATED_EVENT, readAllEntries } from "@/lib/journal-entries";
import { INITIAL_SYNC_DONE_EVENT } from "@/lib/sync/local-flags";
import { isInitialSyncCompleted } from "@/lib/sync/sync-client";

function computeReady(): boolean {
  if (typeof window === "undefined") return false;
  if (isInitialSyncCompleted()) return true;
  try {
    return readAllEntries().length > 0;
  } catch {
    return false;
  }
}

export function useInitialSyncReady(): boolean {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const refresh = () => setReady(computeReady());
    refresh();
    window.addEventListener(INITIAL_SYNC_DONE_EVENT, refresh);
    window.addEventListener(ENTRIES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(INITIAL_SYNC_DONE_EVENT, refresh);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, refresh);
    };
  }, []);

  return ready;
}
