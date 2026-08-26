/**
 * Pure server-ready pattern list from artifact snapshots (no localStorage).
 */

import { isVoiceArcShape } from "@/lib/patterns/discovery-arc";
import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import { isCompleteVoicePassage } from "@/lib/patterns/passage-fill";
import {
  passageEvidenceKeyFromCacheKey,
  type PatternPassage,
} from "@/lib/patterns/passage-types";
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

const resolveDisplay = (
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

const isVisible = (
  name: PatternName,
  passage: PatternPassage,
  display: PatternDisplay | null,
  statesByName: Map<PatternName, PatternState>,
): boolean => {
  if (!display) return false;
  if (!isCompleteVoicePassage(passage)) return false;
  if (isVoiceArcShape(passage.shapeId)) return true;

  const lifecycle = statesByName.get(name)?.lifecycle ?? passage.lifecycle;
  const quoteCount = quotesFromPassage(passage).length;
  const discoveryEligible =
    quoteCount >= 3 && lifecycle !== "resting" && lifecycle !== "emerging";
  return !discoveryEligible;
};

const pickDisplayPassage = (
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

/** Build list rows from synced artifact snapshot (server DB or API payload). */
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
    const passage = pickDisplayPassage(name, passagesByName);
    if (!passage) return;
    const display = resolveDisplay(name, passage, statesByName, displaysByPattern);
    if (!isVisible(name, passage, display, statesByName)) return;
    seen.add(name);
    const evidence = evidenceFromPassage(passage);
    ready.push({
      name,
      entryCount: evidence.length,
      evidence,
      timeHint: null,
      coPatterns: [],
      foldedLabels: [],
      suppressedPatterns: [],
      relatedPatterns: [],
      display: display!,
    });
  };

  for (const state of snapshot.states) consider(state.name);
  for (const passage of snapshot.passages) consider(passage.name);

  return ready;
};
