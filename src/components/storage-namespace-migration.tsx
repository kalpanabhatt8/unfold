"use client";

import "@/lib/storage-namespace";

/** Ensures legacy `keeps-*` storage keys migrate before the rest of the app reads them. */
export function StorageNamespaceMigration() {
  return null;
}
