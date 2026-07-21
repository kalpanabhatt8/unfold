/**
 * One-time localStorage → cloud import.
 *
 * Entries arrive one per request. Journal content is text-only.
 */

import { pushEntries } from "@/lib/server/entries";
import type { WireEntry } from "@/lib/sync/wire-types";

export const importEntry = async (
  userId: string,
  entry: WireEntry,
): Promise<void> => {
  await pushEntries(userId, [entry]);
};
