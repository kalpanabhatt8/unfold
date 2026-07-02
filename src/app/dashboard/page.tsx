"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createEntryId, readAllEntries } from "@/lib/journal-entries";

/**
 * `/dashboard` has no UI of its own — it hands off to the most recently
 * created journal entry (or creates a fresh one) inside the Journal tab.
 */
export default function DashboardRootPage() {
  const router = useRouter();

  useEffect(() => {
    let targetId: string;
    try {
      targetId = readAllEntries()[0]?.id ?? createEntryId();
    } catch {
      targetId = createEntryId();
    }
    router.replace(`/dashboard/journal/${targetId}`);
  }, [router]);

  return null;
}
