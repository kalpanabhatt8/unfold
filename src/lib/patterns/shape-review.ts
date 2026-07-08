/**
 * Unfold — synthetic evidence fixtures for shape + lifecycle review.
 *
 * Run: npx tsx scripts/review-pattern-shapes.ts
 * Or in the browser console after importing reviewAllFixtures.
 */

import { classifyLifecycle } from "@/lib/patterns/lifecycle";
import { emptyState } from "@/lib/patterns/pattern-state";
import {
  advancePatternState,
  createPlan,
  type DepthTier,
  type NeighborShape,
} from "@/lib/patterns/planner";
import type { EndingKind } from "@/lib/patterns/pattern-state";
import type { PatternEvidenceItem } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

const DAY = 86_400_000;
const now = Date.now();

const item = (
  id: string,
  daysAgo: number,
  quotes: string[],
  confidence = 0.85,
): PatternEvidenceItem => ({
  entryId: id,
  entryTitle: `Entry ${id}`,
  createdAt: now - daysAgo * DAY,
  sealedAt: now - daysAgo * DAY,
  quotes,
  confidence,
});

export type ShapeFixture = {
  id: string;
  name: PatternName;
  evidence: PatternEvidenceItem[];
  globalActivityAt: number;
  expectShape?: string;
  notes?: string;
};

export const SHAPE_FIXTURES: ShapeFixture[] = [
  {
    id: "bare-emerging",
    name: "avoidance",
    evidence: [
      item("a", 3, ["I cleaned my desk before touching the draft."]),
      item("b", 5, ["I kept opening Slack instead."]),
      item("c", 7, ["I'll start after lunch."]),
    ],
    globalActivityAt: now - 2 * DAY,
    expectShape: "bare_close",
    notes: "Brand-new pattern — evidence only (quote ending, no AI voice)",
  },
  {
    id: "echo-tomorrow",
    name: "avoidance",
    evidence: [
      item("a", 10, ["I'll start tomorrow for real."]),
      item("b", 20, ["Tomorrow I'll tackle the hard part."]),
      item("c", 30, ["Maybe tomorrow."]),
      item("d", 3, ["Starting tomorrow, definitely."]),
    ],
    globalActivityAt: now - 2 * DAY,
    expectShape: "echo",
    notes: "Recurring token across entries",
  },
  {
    id: "pair-returning",
    name: "self_doubt",
    evidence: [
      item("a", 90, ["I'm not sure I'm qualified for this."]),
      item("b", 85, ["Who am I to even try."]),
      item("c", 5, ["Same doubt again today."]),
    ],
    globalActivityAt: now - 2 * DAY,
    expectShape: "pair",
    notes: "Large gap — returning lifecycle",
  },
  {
    id: "pair-drift",
    name: "overthinking",
    evidence: [
      item("a", 45, ["I replayed the conversation again."]),
      item("b", 20, ["Still looping on what I said."]),
      item("c", 5, ["Can't stop thinking about it."]),
    ],
    globalActivityAt: now - 2 * DAY,
    notes: "14d+ gap, strengthening — pair or single",
  },
  {
    id: "recognition-strong",
    name: "perfectionism",
    evidence: [
      item("a", 28, ["It's not good enough yet."]),
      item("b", 21, ["I need one more pass."]),
      item("c", 10, ["Still tweaking the details."]),
      item("d", 2, ["I'll send it when it's perfect."]),
    ],
    globalActivityAt: now - 2 * DAY,
    expectShape: "recognition",
    notes: "Strengthening pattern with enough quotes",
  },
  {
    id: "recognition-rich",
    name: "avoidance",
    evidence: [
      item("a", 30, ["I cleaned the whole kitchen instead."]),
      item("b", 24, ["Reorganized my files rather than start."]),
      item("c", 18, ["Answered every email but the important one."]),
      item("d", 12, ["Made another plan instead of moving."]),
      item("e", 6, ["Busywork felt safer than the real thing."]),
      item("f", 1, ["I keep circling the thing I fear."]),
    ],
    globalActivityAt: now - 1 * DAY,
    expectShape: "recognition",
    notes: "Evidence-rich pattern — should earn the deeper recognition arc",
  },
  {
    id: "resting",
    name: "comparison",
    evidence: [
      item("a", 60, ["Everyone else seems ahead."]),
      item("b", 55, ["I scroll and feel behind."]),
      item("c", 50, ["Their progress makes mine look small."]),
    ],
    globalActivityAt: now - 40 * DAY,
    notes: "No global activity — resting",
  },
  {
    id: "weakening",
    name: "people_pleasing",
    evidence: [
      item("a", 50, ["I said yes even though I was tired."]),
      item("b", 45, ["I didn't want to disappoint them."]),
      item("c", 40, ["I agreed before thinking."]),
    ],
    globalActivityAt: now - 3 * DAY,
    notes: "Old evidence, user still journaling elsewhere",
  },
];

export type FixtureReview = {
  fixtureId: string;
  lifecycle: string;
  shapeId: string;
  depthTier: DepthTier;
  endingKind: EndingKind;
  slotKinds: string[];
  quoteCount: number;
  voiceSlots: number;
  expectShape?: string;
  notes?: string;
};

export function reviewFixture(
  fixture: ShapeFixture,
  neighbors: NeighborShape[] = [],
): FixtureReview {
  const advanced = advancePatternState({
    name: fixture.name,
    evidence: fixture.evidence,
    globalActivityAt: fixture.globalActivityAt,
    prevState: null,
    neighbors,
    now,
  });

  const { plan } = createPlan(
    {
      name: fixture.name,
      evidence: fixture.evidence,
      globalActivityAt: fixture.globalActivityAt,
      prevState: emptyState(fixture.name, now),
      neighbors,
      now,
    },
    advanced,
  );

  const { lifecycle } = classifyLifecycle(
    fixture.evidence,
    fixture.globalActivityAt,
    null,
    now,
  );

  return {
    fixtureId: fixture.id,
    lifecycle,
    shapeId: plan.shapeId,
    depthTier: plan.depthTier,
    endingKind: plan.endingKind,
    slotKinds: plan.slots.map((s) => s.kind),
    quoteCount: plan.quotes.length,
    voiceSlots: plan.slots.filter(
      (s) => s.kind === "line" || s.kind === "close",
    ).length,
    expectShape: fixture.expectShape,
    notes: fixture.notes,
  };
}

export function reviewAllFixtures(): FixtureReview[] {
  const results: FixtureReview[] = [];
  const neighbors: NeighborShape[] = [];

  for (const fixture of SHAPE_FIXTURES) {
    const review = reviewFixture(fixture, neighbors);
    results.push(review);
    neighbors.push({
      depthTier: review.depthTier,
      endingKind: review.endingKind,
      shapeId: review.shapeId,
    });
  }

  return results;
}
