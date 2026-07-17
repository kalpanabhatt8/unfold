/**
 * Discovery arc — four-beat guided reflection (presentation layer).
 *
 * Headline → Evidence → Mechanism? → Reflection
 *
 * The mechanism beat replays the chain of events that leads into the pattern —
 * never a summary of the entries or a description of behavior.
 */

import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import type { PassageSlot } from "@/lib/patterns/passage-types";

export const DISCOVERY_SHAPE_ID = "discovery";
export const DISCOVERY_EVIDENCE_VISIBLE = 3;

export type DiscoveryPhase =
  | "headline"
  | "evidence"
  | "mechanism"
  | "reflection";

export type DiscoveryArc = {
  phases: DiscoveryPhase[];
  headline: { title: string; orienting: string };
  evidence: { visible: QuoteRef[]; overflow: QuoteRef[] };
  mechanism: { text: string } | null;
  reflection: { question: string; quote: QuoteRef | null };
};

export const isDiscoveryShape = (shapeId?: string): boolean =>
  shapeId === DISCOVERY_SHAPE_ID;

const VOICE_ARC_SHAPES = new Set([
  DISCOVERY_SHAPE_ID,
  "recognition",
  "recognition_q",
  "recognition_deep",
]);

export const isVoiceArcShape = (shapeId?: string): boolean =>
  shapeId !== undefined && VOICE_ARC_SHAPES.has(shapeId);

const passageHasVoiceSlots = (slots: PassageSlot[]): boolean =>
  slots.some((s) => s.kind === "line") ||
  slots.some(
    (s) =>
      s.kind === "close" &&
      (s.endingKind === "question" || s.endingKind === "line"),
  );

const collectQuotes = (slots: PassageSlot[]): QuoteRef[] => {
  const quotes: QuoteRef[] = [];
  for (const slot of slots) {
    if (slot.kind === "moments") quotes.push(...slot.quotes);
    if (slot.kind === "pair") quotes.push(...slot.quotes);
    if (slot.kind === "echo") quotes.push(...slot.quotes);
  }
  return quotes;
};

type LineSlot = Extract<PassageSlot, { kind: "line" }>;
type CloseSlot = Extract<PassageSlot, { kind: "close" }>;

/**
 * Structural slot selection — which slots back which beats.
 *
 * This depends ONLY on the slot layout the planner cached, never on the
 * generated text. The beat list must be identical before and after voice
 * fills arrive, and across regenerations of the same plan — otherwise the
 * beat count (and the Continue/Done CTA) changes between opens.
 */
/**
 * Pick the line slot that backs the mechanism beat.
 *
 * Legacy plans may still carry a first line that was the old recognition
 * question — skip it and use the mechanism line that followed.
 */
const selectMechanismSlot = (
  lineSlots: LineSlot[],
  shapeId?: string,
): LineSlot | null => {
  if (lineSlots.length === 0) return null;
  if (isDiscoveryShape(shapeId) && lineSlots.length >= 2) {
    return lineSlots[1];
  }
  if (!isDiscoveryShape(shapeId) && lineSlots.length >= 2) {
    return lineSlots[lineSlots.length - 1];
  }
  return lineSlots[0];
};

const selectArcSlots = (
  slots: PassageSlot[],
  shapeId?: string,
): {
  mechanismSlot: LineSlot | null;
  closeSlot: CloseSlot | null;
} => {
  const lineSlots = slots.filter((s): s is LineSlot => s.kind === "line");
  const closeSlot =
    slots.find((s): s is CloseSlot => s.kind === "close") ?? null;

  return {
    mechanismSlot: selectMechanismSlot(lineSlots, shapeId),
    closeSlot,
  };
};

export function buildOrientingLine(momentCount: number): string {
  if (momentCount <= 1) return "A moment from your journal.";
  return "A few moments from this week.";
}

/**
 * Build the full guided arc from a voice-capable passage.
 *
 * The phase list is STRUCTURAL: a beat exists iff its backing slot exists in
 * the cached plan. Generated text only fills beats in, it never adds or
 * removes them — so the beat count is final before the first render and
 * identical on every open of the same passage.
 */
export function buildDiscoveryArc(
  slots: PassageSlot[],
  headlineTitle: string,
  orienting?: string,
  shapeId: string = DISCOVERY_SHAPE_ID,
): DiscoveryArc {
  const allQuotes = collectQuotes(slots);
  const visible = allQuotes.slice(0, DISCOVERY_EVIDENCE_VISIBLE);
  const overflow = allQuotes.slice(DISCOVERY_EVIDENCE_VISIBLE);

  const { mechanismSlot, closeSlot } = selectArcSlots(slots, shapeId);

  const phases: DiscoveryPhase[] = ["headline"];
  if (allQuotes.length > 0) phases.push("evidence");
  if (mechanismSlot) phases.push("mechanism");
  if (closeSlot) phases.push("reflection");

  const closeQuote =
    closeSlot?.endingKind === "quote" ? closeSlot.quote ?? null : null;
  const closeText =
    closeSlot && closeSlot.endingKind !== "quote"
      ? closeSlot.text?.trim() ?? ""
      : "";

  return {
    phases,
    headline: {
      title: headlineTitle,
      orienting: orienting ?? buildOrientingLine(allQuotes.length),
    },
    evidence: { visible, overflow },
    mechanism: mechanismSlot
      ? { text: mechanismSlot.text?.trim() ?? "" }
      : null,
    reflection: { question: closeText, quote: closeQuote },
  };
}

/** Minimal arc for evidence-only shapes (headline + evidence). */
export function buildEvidenceArc(
  slots: PassageSlot[],
  headlineTitle: string,
  orienting?: string,
): DiscoveryArc {
  const allQuotes = collectQuotes(slots);
  const visible = allQuotes.slice(0, DISCOVERY_EVIDENCE_VISIBLE);
  const overflow = allQuotes.slice(DISCOVERY_EVIDENCE_VISIBLE);

  return {
    phases: ["headline", "evidence"],
    headline: {
      title: headlineTitle,
      orienting: orienting ?? buildOrientingLine(allQuotes.length),
    },
    evidence: { visible, overflow },
    mechanism: null,
    reflection: { question: "", quote: null },
  };
}

export function buildArcFromPassage(
  slots: PassageSlot[],
  shapeId: string,
  headlineTitle: string,
  orienting?: string,
): DiscoveryArc {
  if (isVoiceArcShape(shapeId) || passageHasVoiceSlots(slots)) {
    return buildDiscoveryArc(slots, headlineTitle, orienting, shapeId);
  }
  return buildEvidenceArc(slots, headlineTitle, orienting);
}

// ── Diagnostics ──────────────────────────────────────────────────────────

export type BeatTrace = {
  beat: DiscoveryPhase;
  status: "created" | "removed";
  reason: string;
  text?: string;
};

/**
 * Explain, beat-by-beat, why the arc has the phases it does. Pure — safe to
 * call from debug logging. Shows which beats were dropped and why, so a
 * collapsed flow (e.g. only headline + evidence) can be traced to its cause.
 */
export function explainArc(
  slots: PassageSlot[],
  shapeId: string,
): { trace: BeatTrace[]; route: string } {
  const voiceRoute = isVoiceArcShape(shapeId) || passageHasVoiceSlots(slots);
  const route = voiceRoute
    ? `voice:${shapeId} (beats from slot structure)`
    : `evidence-only:${shapeId} (headline + evidence beats only)`;

  const quotes = collectQuotes(slots);

  const trace: BeatTrace[] = [];
  trace.push({ beat: "headline", status: "created", reason: "always shown" });
  trace.push({
    beat: "evidence",
    status: quotes.length > 0 ? "created" : "removed",
    reason: quotes.length > 0 ? `${quotes.length} quote(s)` : "no quotes bound",
  });

  if (!voiceRoute) {
    for (const beat of ["mechanism", "reflection"] as const) {
      trace.push({
        beat,
        status: "removed",
        reason: "evidence-only shape has no voice slots",
      });
    }
    return { trace, route };
  }

  const { mechanismSlot, closeSlot } = selectArcSlots(slots, shapeId);

  trace.push({
    beat: "mechanism",
    status: mechanismSlot ? "created" : "removed",
    reason: mechanismSlot
      ? mechanismSlot.text?.trim()
        ? "line slot, filled"
        : "line slot, awaiting voice"
      : "no mechanism line slot in plan",
    text: mechanismSlot?.text ?? undefined,
  });

  trace.push({
    beat: "reflection",
    status: closeSlot ? "created" : "removed",
    reason: closeSlot
      ? closeSlot.endingKind === "quote"
        ? "close slot (quote ending)"
        : closeSlot.text?.trim()
          ? "close slot, filled"
          : "close slot, awaiting voice"
      : "no close slot in plan",
    text: closeSlot?.text ?? undefined,
  });

  return { trace, route };
}

export const phaseAtIndex = (
  arc: DiscoveryArc,
  index: number,
): DiscoveryPhase => arc.phases[index] ?? arc.phases[arc.phases.length - 1];

export const phaseIndex = (arc: DiscoveryArc, phase: DiscoveryPhase): number =>
  arc.phases.indexOf(phase);

const phaseHasContent = (arc: DiscoveryArc, phase: DiscoveryPhase): boolean => {
  switch (phase) {
    case "headline":
      return true;
    case "evidence":
      return arc.evidence.visible.length > 0;
    case "mechanism":
      return arc.mechanism !== null;
    case "reflection":
      return (
        arc.reflection.question.trim().length > 0 ||
        arc.reflection.quote !== null
      );
  }
};

/**
 * First reveal index — never open on headline alone.
 * Prefer evidence so the opening state always includes journal content.
 */
export function getInitialRevealIndex(arc: DiscoveryArc): number {
  const evidenceIdx = phaseIndex(arc, "evidence");
  if (evidenceIdx >= 0 && phaseHasContent(arc, "evidence")) {
    return evidenceIdx;
  }

  for (let i = 0; i < arc.phases.length; i++) {
    const phase = arc.phases[i];
    if (phase === "headline") continue;
    if (phaseHasContent(arc, phase)) return i;
  }

  return Math.max(0, arc.phases.length - 1);
}

/** Deterministic CTA copy — Continue until the final phase, then Done. */
export function discoveryContinueLabel(
  arc: DiscoveryArc,
  currentIndex: number,
): "Continue →" | "Done →" {
  return currentIndex >= arc.phases.length - 1 ? "Done →" : "Continue →";
}

export const hasReachedPhase = (
  arc: DiscoveryArc,
  currentIndex: number,
  phase: DiscoveryPhase,
): boolean => {
  const target = phaseIndex(arc, phase);
  return target >= 0 && currentIndex >= target;
};

export const discoveryAwaitingVoice = (
  arc: DiscoveryArc,
  phase: DiscoveryPhase,
): boolean => {
  if (!arc.phases.includes(phase)) return false;
  switch (phase) {
    case "headline":
    case "evidence":
      return false;
    case "mechanism":
      return (arc.mechanism?.text.trim().length ?? 0) === 0;
    case "reflection":
      return (
        arc.reflection.quote === null &&
        arc.reflection.question.trim().length === 0
      );
  }
};

