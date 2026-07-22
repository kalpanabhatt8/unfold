"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { JournalCanvasSkeleton } from "@/components/canvas/journal-canvas-skeleton";
import { resolveEntryOpenTarget } from "@/lib/entry-draft";
import { readAllEntries } from "@/lib/journal-entries";
import { ensureInitialSync } from "@/lib/sync/sync-client";

/**
 * `/dashboard` has no destination of its own — it opens the empty draft when
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
        /* treat as empty — wait for sync */
      }

      await ensureInitialSync();
      if (cancelled) return;
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
