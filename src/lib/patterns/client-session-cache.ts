/**
 * In-memory pattern artifact cache for the current browser session.
 *
 * localStorage can fail silently when quota is full (large entry boards). Sync
 * still needs a reliable read path for the Patterns UI in the same tab.
 */

import type { PatternPassage } from "@/lib/patterns/passage-types";
import type { PatternState } from "@/lib/patterns/pattern-state";
import type { PatternDisplay } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary-public";

const sessionPassages: Partial<Record<PatternName, PatternPassage>> = {};
const sessionDisplays: Record<string, PatternDisplay> = {};
const sessionStates: Partial<Record<PatternName, PatternState>> = {};

export const clearSessionPatternCache = (): void => {
  for (const key of Object.keys(sessionPassages) as PatternName[]) {
    delete sessionPassages[key];
  }
  for (const key of Object.keys(sessionDisplays)) {
    delete sessionDisplays[key];
  }
  for (const key of Object.keys(sessionStates) as PatternName[]) {
    delete sessionStates[key];
  }
};

export const rememberSessionPassage = (passage: PatternPassage): void => {
  sessionPassages[passage.name] = passage;
};

export const rememberSessionDisplay = (
  name: PatternName,
  evidenceKey: string,
  display: PatternDisplay,
): void => {
  sessionDisplays[`${name}|${evidenceKey}`] = display;
};

export const rememberSessionState = (state: PatternState): void => {
  sessionStates[state.name] = state;
};

export const mergeSessionPassages = (
  stored: Record<string, PatternPassage>,
): Record<string, PatternPassage> => ({
  ...stored,
  ...(sessionPassages as Record<string, PatternPassage>),
});

export const mergeSessionDisplays = (
  stored: Record<string, PatternDisplay>,
): Record<string, PatternDisplay> => ({
  ...stored,
  ...sessionDisplays,
});

export const mergeSessionStates = (
  stored: Record<string, PatternState>,
): Record<string, PatternState> => ({
  ...stored,
  ...(sessionStates as Record<string, PatternState>),
});
