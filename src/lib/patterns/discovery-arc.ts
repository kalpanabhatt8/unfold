/**
 * Discovery arc — guided reflection (presentation layer).
 *
 * Headline → Moments → Recurrence? → Closing signal? → Reflection?
 *
 * Closing is exactly one of: silence | drift | phrase | mechanism | none.
 * Reflection only when the plan carried an open question from the user's writing.
 */

import { chronologicalQuoteRefs } from "@/lib/ai/pattern-slots/input";
import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import { isDistinctiveEchoPhrase } from "@/lib/patterns/evidence-signals";
import { splitMechanismSteps } from "@/lib/patterns/mechanism-steps";
import type { PassageSlot, PatternPassage } from "@/lib/patterns/passage-types";
import {
  buildRecurrenceCard,
  type RecurrenceCardData,
} from "@/lib/patterns/occurrences";

export const DISCOVERY_SHAPE_ID = "discovery";
export const DISCOVERY_EVIDENCE_VISIBLE = 3;

export type DiscoveryPhase =
  | "headline"
  | "evidence"
  | "recurrence"
  | "closing"
  | "reflection";

/** One Loop bridge sentence with the journal quotes that support it. */
export type MechanismStepPresentation = {
  text: string;
  quotes: QuoteRef[];
};

export type ClosingPresentation =
  | { kind: "silence"; text: string }
  | { kind: "drift"; early: QuoteRef; recent: QuoteRef }
  | { kind: "phrase"; phrase: string }
  | { kind: "mechanism"; text: string; steps: MechanismStepPresentation[] }
  | null;

export type DiscoveryArc = {
  phases: DiscoveryPhase[];
  headline: { title: string; orienting: string };
  evidence: { visible: QuoteRef[]; overflow: QuoteRef[] };
  /** Earlier vs newest match — only from 2nd occurrence onward. */
  recurrence: RecurrenceCardData | null;
  closing: ClosingPresentation;
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

const collectMomentQuotes = (slots: PassageSlot[]): QuoteRef[] => {
  const quotes: QuoteRef[] = [];
  for (const slot of slots) {
    if (slot.kind === "moments") quotes.push(...slot.quotes);
  }
  if (quotes.length === 0) {
    for (const slot of slots) {
      if (slot.kind === "pair") quotes.push(...slot.quotes);
      if (slot.kind === "echo") quotes.push(...slot.quotes);
    }
  }
  return quotes;
};

type LineSlot = Extract<PassageSlot, { kind: "line" }>;
type CloseSlot = Extract<PassageSlot, { kind: "close" }>;
type PairSlot = Extract<PassageSlot, { kind: "pair" }>;
type EchoSlot = Extract<PassageSlot, { kind: "echo" }>;

const SILENCE_LINE = /^then,\s+for\s+/i;

/** Resolve 1-based quoteIndexes into QuoteRefs from the chronological pool. */
export function resolveMechanismSteps(
  line: LineSlot,
  quotePool: QuoteRef[],
): MechanismStepPresentation[] {
  const text = line.text?.trim() ?? "";
  const stored = line.steps?.filter((s) => s.text.trim().length > 0) ?? [];

  if (stored.length > 0) {
    return stored.map((step) => ({
      text: step.text.trim(),
      quotes: step.quoteIndexes
        .map((i) => quotePool[i - 1])
        .filter((q): q is QuoteRef => Boolean(q)),
    }));
  }

  // Legacy fills without steps: show sentences, no per-step evidence.
  return splitMechanismSteps(text).map((step) => ({
    text: step,
    quotes: [],
  }));
}

/**
 * Derive the single closing presentation from slots.
 * Discovery layouts place at most one of: silence line, drift pair, phrase echo,
 * mechanism line — after the moments pool.
 */
export function selectClosingPresentation(
  slots: PassageSlot[],
  shapeId?: string,
): ClosingPresentation {
  const momentsIdx = slots.findIndex((s) => s.kind === "moments");
  const afterMoments =
    momentsIdx >= 0 ? slots.slice(momentsIdx + 1) : slots.slice();

  const driftPair = afterMoments.find((s): s is PairSlot => s.kind === "pair");
  if (driftPair) {
    const [a, b] = driftPair.quotes;
    const [early, recent] =
      a.anchorTs <= b.anchorTs ? [a, b] : [b, a];
    return { kind: "drift", early, recent };
  }

  const phrase = afterMoments.find((s): s is EchoSlot => s.kind === "echo");
  if (phrase && isDistinctiveEchoPhrase(phrase.phrase)) {
    return { kind: "phrase", phrase: phrase.phrase };
  }
  // Weak single-token echoes (e.g. "kept", "written") are not a closing beat.

  const lineSlots = afterMoments.filter((s): s is LineSlot => s.kind === "line");
  let mechanismLine: LineSlot | null =
    lineSlots.length >= 2 && !isDiscoveryShape(shapeId)
      ? lineSlots[lineSlots.length - 1]
      : lineSlots[0] ?? null;

  if (isDiscoveryShape(shapeId) && lineSlots.length >= 2) {
    mechanismLine = lineSlots[1];
  }

  if (mechanismLine) {
    const text = mechanismLine.text?.trim() ?? "";
    if (SILENCE_LINE.test(text)) {
      return { kind: "silence", text };
    }
    const steps = resolveMechanismSteps(
      mechanismLine,
      chronologicalQuoteRefs(slots),
    );
    return { kind: "mechanism", text, steps };
  }

  return null;
}

const selectCloseSlot = (slots: PassageSlot[]): CloseSlot | null =>
  slots.find((s): s is CloseSlot => s.kind === "close") ?? null;

export function buildOrientingLine(momentCount: number): string {
  if (momentCount <= 1) return "A moment from your journal.";
  return "A few moments from this week.";
}

export function buildDiscoveryArc(
  slots: PassageSlot[],
  headlineTitle: string,
  orienting?: string,
  shapeId: string = DISCOVERY_SHAPE_ID,
  passage?: PatternPassage | null,
): DiscoveryArc {
  const allQuotes = collectMomentQuotes(slots);
  const visible = allQuotes.slice(0, DISCOVERY_EVIDENCE_VISIBLE);
  const overflow = allQuotes.slice(DISCOVERY_EVIDENCE_VISIBLE);

  const closing = selectClosingPresentation(slots, shapeId);
  const closeSlot = selectCloseSlot(slots);
  const recurrence = passage ? buildRecurrenceCard(passage) : null;

  // Confirmed beat order: Headline → Moments → Recurrence → Loop → reflection
  const phases: DiscoveryPhase[] = ["headline"];
  if (allQuotes.length > 0) phases.push("evidence");
  if (recurrence) phases.push("recurrence");
  if (closing) phases.push("closing");
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
    recurrence,
    closing,
    reflection: { question: closeText, quote: closeQuote },
  };
}

/** Minimal arc for evidence-only shapes (headline + evidence). */
export function buildEvidenceArc(
  slots: PassageSlot[],
  headlineTitle: string,
  orienting?: string,
  _passage?: PatternPassage | null,
): DiscoveryArc {
  const allQuotes = collectMomentQuotes(slots);
  const visible = allQuotes.slice(0, DISCOVERY_EVIDENCE_VISIBLE);
  const overflow = allQuotes.slice(DISCOVERY_EVIDENCE_VISIBLE);

  return {
    phases: ["headline", "evidence"],
    headline: {
      title: headlineTitle,
      orienting: orienting ?? buildOrientingLine(allQuotes.length),
    },
    evidence: { visible, overflow },
    recurrence: null,
    closing: null,
    reflection: { question: "", quote: null },
  };
}

export function buildArcFromPassage(
  slots: PassageSlot[],
  shapeId: string,
  headlineTitle: string,
  orienting?: string,
  passage?: PatternPassage | null,
): DiscoveryArc {
  if (isVoiceArcShape(shapeId) || passageHasVoiceSlots(slots)) {
    return buildDiscoveryArc(slots, headlineTitle, orienting, shapeId, passage);
  }
  return buildEvidenceArc(slots, headlineTitle, orienting, passage);
}

// ── Diagnostics ──────────────────────────────────────────────────────────

export type BeatTrace = {
  beat: DiscoveryPhase;
  status: "created" | "removed";
  reason: string;
  text?: string;
};

export function explainArc(
  slots: PassageSlot[],
  shapeId: string,
  passage?: PatternPassage | null,
): { trace: BeatTrace[]; route: string } {
  const voiceRoute = isVoiceArcShape(shapeId) || passageHasVoiceSlots(slots);
  const route = voiceRoute
    ? `voice:${shapeId} (beats from slot structure)`
    : `evidence-only:${shapeId} (headline + evidence beats only)`;

  const quotes = collectMomentQuotes(slots);
  const closing = selectClosingPresentation(slots, shapeId);
  const closeSlot = selectCloseSlot(slots);
  const recurrence = passage ? buildRecurrenceCard(passage) : null;

  const trace: BeatTrace[] = [];
  trace.push({ beat: "headline", status: "created", reason: "always shown" });
  trace.push({
    beat: "evidence",
    status: quotes.length > 0 ? "created" : "removed",
    reason: quotes.length > 0 ? `${quotes.length} quote(s)` : "no quotes bound",
  });
  trace.push({
    beat: "recurrence",
    status: recurrence ? "created" : "removed",
    reason: recurrence
      ? `${recurrence.gapLabel} (${recurrence.earlier.entryId} → ${recurrence.newer.entryId})`
      : "no later occurrence yet",
  });

  if (!voiceRoute) {
    for (const beat of ["closing", "reflection"] as const) {
      trace.push({
        beat,
        status: "removed",
        reason: "evidence-only shape has no voice slots",
      });
    }
    return { trace, route };
  }

  trace.push({
    beat: "closing",
    status: closing ? "created" : "removed",
    reason: closing
      ? `${closing.kind}${
          closing.kind === "mechanism" || closing.kind === "silence"
            ? closing.text
              ? ", filled"
              : ", awaiting voice"
            : ""
        }`
      : "no closing signal in plan",
    text:
      closing?.kind === "mechanism" || closing?.kind === "silence"
        ? closing.text
        : closing?.kind === "phrase"
          ? closing.phrase
          : undefined,
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
    case "recurrence":
      return arc.recurrence !== null;
    case "closing":
      return arc.closing !== null;
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
    case "recurrence":
      return false;
    case "closing":
      return (
        arc.closing?.kind === "mechanism" &&
        (arc.closing.text.trim().length ?? 0) === 0
      );
    case "reflection":
      return (
        arc.reflection.quote === null &&
        arc.reflection.question.trim().length === 0
      );
  }
};
