import "server-only";

import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import { extractJournalPlainText } from "@/lib/canvas-word-count";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isCanvasSnapshot = (v: unknown): v is CanvasSnapshot => {
  if (!isRecord(v)) return false;
  return Array.isArray(v.textColumns);
};

/** Plain text for server analysis — prefers stored searchText, falls back to content JSON. */
export const resolveEntryText = (entry: {
  searchText: string;
  content: unknown;
}): string => {
  const fromSearch = entry.searchText?.trim();
  if (fromSearch) return fromSearch;
  if (entry.content && isCanvasSnapshot(entry.content)) {
    return extractJournalPlainText(entry.content).trim();
  }
  return "";
};
