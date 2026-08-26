/**
 * In-memory pattern store backing for server-side pipeline runs.
 * Lets passage orchestration reuse the same store modules without localStorage.
 */

import type { PatternPassage } from "@/lib/patterns/passage-types";
import type { PatternState } from "@/lib/patterns/pattern-state";
import type { PatternDisplay } from "@/lib/patterns/types";

export type PatternStoreBacking = {
  states: Record<string, PatternState>;
  passages: Record<string, PatternPassage>;
  displays: Record<string, PatternDisplay>;
};

let activeBacking: PatternStoreBacking | null = null;

export const getActivePatternStoreBacking = (): PatternStoreBacking | null =>
  activeBacking;

export const activatePatternStoreBacking = (
  backing: PatternStoreBacking,
): void => {
  activeBacking = backing;
};

export const deactivatePatternStoreBacking = (): void => {
  activeBacking = null;
};

export async function withPatternStoreBacking<T>(
  backing: PatternStoreBacking,
  fn: () => Promise<T> | T,
): Promise<T> {
  activatePatternStoreBacking(backing);
  try {
    return await fn();
  } finally {
    deactivatePatternStoreBacking();
  }
}
