/**
 * Server-ready patterns — authoritative list membership for the UI.
 *
 * A pattern is "server-ready" when synced artifacts exist together:
 *   pattern_passage (complete voice) + pattern_display (title) + optional pattern_state
 *
 * List visibility does NOT re-derive surfacing from client aggregation or require
 * local analyses to pass freshness checks. Client aggregation remains for
 * regeneration triggers and debug only.
 */

import { isVoiceArcShape } from "@/lib/patterns/discovery-arc";
import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import { isCompleteVoicePassage } from "@/lib/patterns/passage-fill";
import {
  getCachedDisplay,
  listCachedDisplays,
} from "@/lib/patterns/pattern-display-store";
import {
  getCachedPassage,
  getDisplayPassage,
  listCachedPassages,
} from "@/lib/patterns/passage-store";
import {
  passageEvidenceKeyFromCacheKey,
  passageNeedsGeneration,
  type PatternPassage,
} from "@/lib/patterns/passage-types";
import { getState, listStates } from "@/lib/patterns/pattern-state";
import type { PatternState } from "@/lib/patterns/pattern-state";
import type {
  PatternDisplay,
  PatternEvidenceItem,
  SurfacedPattern,
} from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary-public";

export type PatternArtifactSnapshot = {
  states: PatternState[];
  passages: PatternPassage[];
  displays: Array<{ patternName: PatternName; display: PatternDisplay }>;
};

const quotesFromPassage = (passage: PatternPassage): QuoteRef[] => {
  const quotes: QuoteRef[] = [];
  for (const slot of passage.slots) {
    if (slot.kind === "moments" || slot.kind === "echo") {
      quotes.push(...slot.quotes);
    } else if (slot.kind === "pair") {
      quotes.push(slot.quotes[0], slot.quotes[1]);
    } else if (slot.kind === "close" && slot.quote) {
      quotes.push(slot.quote);
    }
  }
  return quotes;
};

const evidenceFromPassage = (passage: PatternPassage): PatternEvidenceItem[] => {
  const byEntry = new Map<string, PatternEvidenceItem>();
  for (const quote of quotesFromPassage(passage)) {
    const existing = byEntry.get(quote.entryId);
    if (existing) {
      if (!existing.quotes.includes(quote.text)) existing.quotes.push(quote.text);
      continue;
    }
    byEntry.set(quote.entryId, {
      entryId: quote.entryId,
      entryTitle: quote.entryTitle,
      createdAt: quote.anchorTs,
      lastEditedAt: quote.anchorTs,
      quotes: [quote.text],
      confidence: quote.confidence,
    });
  }
  return [...byEntry.values()];
};

const countPassageQuotes = (passage: PatternPassage): number =>
  quotesFromPassage(passage).length;

const resolveDisplayForPassage = (
  name: PatternName,
  passage: PatternPassage,
): PatternDisplay | null => {
  const evidenceKey = passageEvidenceKeyFromCacheKey(passage.cacheKey);
  const direct = getCachedDisplay(name, evidenceKey);
  if (direct) return direct;

  const stateKey = getState(name)?.evidenceKey;
  if (stateKey) {
    const fromState = getCachedDisplay(name, stateKey);
    if (fromState) return fromState;
  }

  const fallback = listCachedDisplays().find((row) => row.patternName === name);
  return fallback?.display ?? null;
};

/**
 * Visibility for a synced artifact triple — uses stored lifecycle + passage
 * shape, not client-recomputed aggregate evidence.
 */
export const isServerReadyPatternVisible = (
  name: PatternName,
  passage: PatternPassage,
  display: PatternDisplay | null,
): boolean => {
  if (!display) return false;
  if (!isCompleteVoicePassage(passage)) return false;

  if (isVoiceArcShape(passage.shapeId)) return true;

  const lifecycle = getState(name)?.lifecycle ?? passage.lifecycle;
  const quoteCount = countPassageQuotes(passage);
  const discoveryEligible =
    quoteCount >= 3 && lifecycle !== "resting" && lifecycle !== "emerging";
  return !discoveryEligible;
};

const toSurfacedPattern = (
  name: PatternName,
  passage: PatternPassage,
  display: PatternDisplay,
): SurfacedPattern => {
  const evidence = evidenceFromPassage(passage);
  return {
    name,
    entryCount: evidence.length,
    evidence,
    timeHint: null,
    coPatterns: [],
    foldedLabels: [],
    suppressedPatterns: [],
    relatedPatterns: [],
    display,
  };
};

/** Patterns with complete synced passage + display artifacts. */
export const listServerReadyPatterns = (): SurfacedPattern[] => {
  const seen = new Set<PatternName>();
  const ready: SurfacedPattern[] = [];

  const consider = (name: PatternName) => {
    if (seen.has(name)) return;
    const passage = getDisplayPassage(name) ?? getCachedPassage(name);
    if (!passage) return;
    const display = resolveDisplayForPassage(name, passage);
    if (!isServerReadyPatternVisible(name, passage, display)) return;
    seen.add(name);
    ready.push(toSurfacedPattern(name, passage, display!));
  };

  for (const state of listStates()) {
    consider(state.name);
  }
  for (const passage of listCachedPassages()) {
    consider(passage.name);
  }

  return ready;
};

const resolveDisplayFromMaps = (
  name: PatternName,
  passage: PatternPassage,
  statesByName: Map<PatternName, PatternState>,
  displaysByPattern: Map<PatternName, PatternDisplay[]>,
): PatternDisplay | null => {
  const evidenceKey = passageEvidenceKeyFromCacheKey(passage.cacheKey);
  const rows = displaysByPattern.get(name) ?? [];
  const direct = rows.find((d) => d.sourceEvidenceKey === evidenceKey);
  if (direct) return direct;

  const stateKey = statesByName.get(name)?.evidenceKey;
  if (stateKey) {
    const fromState = rows.find((d) => d.sourceEvidenceKey === stateKey);
    if (fromState) return fromState;
  }

  return rows[0] ?? null;
};

const isVisibleFromMaps = (
  name: PatternName,
  passage: PatternPassage,
  display: PatternDisplay | null,
  statesByName: Map<PatternName, PatternState>,
): boolean => {
  if (!display) return false;
  if (!isCompleteVoicePassage(passage)) return false;
  if (isVoiceArcShape(passage.shapeId)) return true;

  const lifecycle = statesByName.get(name)?.lifecycle ?? passage.lifecycle;
  const quoteCount = countPassageQuotes(passage);
  const discoveryEligible =
    quoteCount >= 3 && lifecycle !== "resting" && lifecycle !== "emerging";
  return !discoveryEligible;
};

const pickDisplayPassageFromMaps = (
  name: PatternName,
  passagesByName: Map<PatternName, PatternPassage>,
): PatternPassage | null => {
  const working = passagesByName.get(name);
  if (
    working &&
    isCompleteVoicePassage(working) &&
    isVoiceArcShape(working.shapeId)
  ) {
    return working;
  }
  if (working && isCompleteVoicePassage(working)) return working;
  return null;
};

/** Build list rows from a DB/API artifact snapshot (no localStorage). */
export const listServerReadyPatternsFromSnapshot = (
  snapshot: PatternArtifactSnapshot,
): SurfacedPattern[] => {
  const statesByName = new Map(snapshot.states.map((s) => [s.name, s]));
  const passagesByName = new Map(snapshot.passages.map((p) => [p.name, p]));
  const displaysByPattern = new Map<PatternName, PatternDisplay[]>();
  for (const { patternName, display } of snapshot.displays) {
    const list = displaysByPattern.get(patternName) ?? [];
    list.push(display);
    displaysByPattern.set(patternName, list);
  }

  const seen = new Set<PatternName>();
  const ready: SurfacedPattern[] = [];

  const consider = (name: PatternName) => {
    if (seen.has(name)) return;
    const passage = pickDisplayPassageFromMaps(name, passagesByName);
    if (!passage) return;
    const display = resolveDisplayFromMaps(
      name,
      passage,
      statesByName,
      displaysByPattern,
    );
    if (!isVisibleFromMaps(name, passage, display, statesByName)) return;
    seen.add(name);
    ready.push(toSurfacedPattern(name, passage, display!));
  };

  for (const state of snapshot.states) consider(state.name);
  for (const passage of snapshot.passages) consider(passage.name);

  return ready;
};

/** Resolve one pattern from synced caches (detail panel + deep links). */
export const resolveServerReadyPattern = (
  name: PatternName,
): SurfacedPattern | null =>
  listServerReadyPatterns().find((row) => row.name === name) ?? null;

/**
 * True when synced artifacts imply work still in flight — incomplete voice,
 * or planner state without a passage yet.
 */
export const hasSyncedPatternWorkInProgress = (): boolean => {
  if (listStates().length === 0 && listCachedPassages().length === 0) {
    return false;
  }

  for (const passage of listCachedPassages()) {
    if (passageNeedsGeneration(passage)) return true;
  }

  for (const state of listStates()) {
    const passage = getCachedPassage(state.name);
    if (!passage) return true;
  }

  return false;
};
