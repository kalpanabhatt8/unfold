/**
 * Unfold — turn a composition plan into a materialized passage.
 *
 * Evidence slots are copied verbatim from the plan. Voice slots are scaffolded
 * with null text (or a bound quote for close:quote endings). Deterministic
 * closings (e.g. silence) arrive prefilled and skip AI.
 */

import type { PatternPlan, SlotSpec } from "@/lib/patterns/planner";
import {
  buildPassageCacheKey,
  type PassageSlot,
  type PatternPassage,
} from "@/lib/patterns/passage-types";
import type { PatternName } from "@/lib/patterns/vocabulary";

const materializeSlot = (spec: SlotSpec): PassageSlot => {
  switch (spec.kind) {
    case "moments":
      return { kind: "moments", quotes: spec.quotes };
    case "pair":
      return { kind: "pair", quotes: spec.quotes };
    case "echo":
      return {
        kind: "echo",
        phrase: spec.phrase,
        quotes: spec.quotes,
      };
    case "line":
      return { kind: "line", text: spec.text ?? null, steps: null };
    case "close":
      return {
        kind: "close",
        endingKind: spec.endingKind,
        text: null,
        quote: null,
      };
  }
};

export const materializePassage = (
  name: PatternName,
  plan: PatternPlan,
  evidenceKey: string,
  now: number,
): PatternPassage => {
  const slots = plan.slots.map((spec) => materializeSlot(spec));

  // Bind close:quote to the last chronological quote across the passage.
  const lastQuote = lastChronologicalQuote(plan);
  for (const slot of slots) {
    if (slot.kind === "close" && slot.endingKind === "quote") {
      slot.quote = lastQuote;
      slot.text = lastQuote?.text ?? null;
    }
  }

  return {
    name,
    shapeId: plan.shapeId,
    signature: plan.signature,
    depthTier: plan.depthTier,
    endingKind: plan.endingKind,
    lifecycle: plan.lifecycle,
    slots,
    cacheKey: buildPassageCacheKey(evidenceKey, plan.lifecycle, plan.signature),
    createdAt: now,
    discoveredAt: now,
    discoveryEvidenceKey: evidenceKey,
    occurrences: [],
  };
};

const lastChronologicalQuote = (plan: PatternPlan) => {
  const sorted = [...plan.quotes].sort((a, b) => {
    if (a.anchorTs !== b.anchorTs) return a.anchorTs - b.anchorTs;
    return a.entryId.localeCompare(b.entryId);
  });
  return sorted.at(-1) ?? null;
};
