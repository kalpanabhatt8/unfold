"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { JournalCanvasSkeleton } from "@/components/canvas/journal-canvas-skeleton";
import { resolveEntryOpenTarget } from "@/lib/entry-draft";
import { readAllEntries } from "@/lib/journal-entries";
import {
  ensureInitialSync,
  fullSync,
  hasPulledEntries,
} from "@/lib/sync/sync-client";

/**
 * `/dashboard` has no destination of its own - it opens the empty draft when
 * one exists (or creates a single new one), never inventing duplicate blanks.
 *
 * After sign-out/in local drafts are empty; wait for the first fullSync so we
 * reuse a server-side empty draft when one exists before creating locally.
 * Renders inside the shell so sidebar + canvas skeletons cover the wait.
 */
export default function DashboardRootPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    // Warm the journal route (TipTap + canvas, ~140kB) while the first sync
    // runs, so the redirect into it overlaps the network wait instead of paying
    // a cold bundle load afterward. The id is irrelevant - only the shared
    // route chunk is being prefetched.
    router.prefetch("/dashboard/journal/warm");

    const go = (id: string) => {
      if (cancelled) return;
      router.replace(`/dashboard/journal/${id}`);
    };

    const run = async () => {
      try {
        if (readAllEntries().length > 0) {
          go(resolveEntryOpenTarget().id);
        }
      } catch {
        /* treat as empty - wait for sync */
      }

      await ensureInitialSync();
      if (cancelled) return;

      // A pull that never landed leaves the store looking empty, and creating a
      // draft off that would duplicate the server's existing blank. Retry once,
      // then open regardless so a persistent outage can't strand the skeleton.
      if (!hasPulledEntries()) {
        await fullSync();
        if (cancelled) return;
      }

      go(resolveEntryOpenTarget().id);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="relative h-full min-h-0 w-full overflow-hidden">
      <JournalCanvasSkeleton />
    </main>
  );
}
