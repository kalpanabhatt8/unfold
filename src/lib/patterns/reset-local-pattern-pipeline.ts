/**
 * Clear client-side pattern pipeline caches so passages, display titles, and
 * planner state can rebuild from current analyses + entries.
 */

import {
  PATTERN_DISPLAY_STORAGE_KEY,
  PATTERN_DISPLAY_UPDATED_EVENT,
} from "@/lib/patterns/pattern-display-store";
import {
  PATTERN_PASSAGES_STORAGE_KEY,
  PATTERN_PASSAGE_UPDATED_EVENT,
  PATTERN_READY_PASSAGES_STORAGE_KEY,
} from "@/lib/patterns/passage-store";
import { PATTERN_STATE_STORAGE_KEY } from "@/lib/patterns/pattern-state";

/** Wipe passage, display, and planner state caches; notify listeners. */
export function resetLocalPatternPipeline(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PATTERN_PASSAGES_STORAGE_KEY);
    window.localStorage.removeItem(PATTERN_READY_PASSAGES_STORAGE_KEY);
    window.localStorage.removeItem(PATTERN_DISPLAY_STORAGE_KEY);
    window.localStorage.removeItem(PATTERN_STATE_STORAGE_KEY);
    window.dispatchEvent(new Event(PATTERN_PASSAGE_UPDATED_EVENT));
    window.dispatchEvent(new Event(PATTERN_DISPLAY_UPDATED_EVENT));
  } catch {
    /* private mode / quota */
  }
}
