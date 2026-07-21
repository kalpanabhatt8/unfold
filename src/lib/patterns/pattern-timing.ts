/**
 * Dev timing logs for the pattern discovery flow.
 *
 * Enabled in development, or in any build when:
 *   window.__UNFOLD_PATTERN_TIMING__ = true
 */

import type { DiscoveryPhase } from "@/lib/patterns/discovery-arc";
import type { PassageSlot, PatternPassage } from "@/lib/patterns/passage-types";

type Session = {
  patternName: string;
  openedAt: number;
  lastStageAt: number;
  lastStage: string | null;
  once: Set<string>;
  asyncStarts: Map<string, number>;
};

let session: Session | null = null;

export const isPatternTimingEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "development") return true;
  return Boolean(
    (
      window as Window & {
        __UNFOLD_PATTERN_TIMING__?: boolean;
        __KEEPS_PATTERN_TIMING__?: boolean;
      }
    ).__UNFOLD_PATTERN_TIMING__ ||
      (window as Window & { __KEEPS_PATTERN_TIMING__?: boolean })
        .__KEEPS_PATTERN_TIMING__,
  );
};

const log = (category: string, message: string, durationMs?: number): void => {
  if (!isPatternTimingEnabled()) return;
  if (durationMs !== undefined) {
    console.log(`[${category}]`, `${message} (${Math.round(durationMs)}ms)`);
    return;
  }
  console.log(`[${category}]`, message);
};

const logOnce = (
  key: string,
  category: string,
  message: string,
  durationMs?: number,
): void => {
  if (!session || session.once.has(key)) return;
  session.once.add(key);
  log(category, message, durationMs);
};

const phaseLabel = (phase: DiscoveryPhase): string => {
  switch (phase) {
    case "headline":
      return "Headline";
    case "evidence":
      return "Quotes";
    case "mechanism":
      return "Mechanism";
    case "reflection":
      return "Question";
  }
};

const mechanismText = (passage: PatternPassage | null | undefined): string => {
  if (!passage) return "";
  const line = passage.slots.find((s): s is Extract<PassageSlot, { kind: "line" }> => s.kind === "line");
  return line?.text?.trim() ?? "";
};

const questionText = (passage: PatternPassage | null | undefined): string => {
  if (!passage) return "";
  const close = passage.slots.find(
    (s): s is Extract<PassageSlot, { kind: "close" }> => s.kind === "close",
  );
  if (!close || close.endingKind === "quote") return "";
  return close.text?.trim() ?? "";
};

const mechanismPending = (passage: PatternPassage): boolean =>
  passage.slots.some((s) => s.kind === "line" && s.text === null);

const questionPending = (passage: PatternPassage): boolean =>
  passage.slots.some(
    (s) => s.kind === "close" && s.endingKind !== "quote" && s.text === null,
  );

/** Start a new timing session when a pattern detail view opens. */
export const beginPatternSession = (patternName: string): void => {
  if (!isPatternTimingEnabled()) return;
  session = {
    patternName,
    openedAt: performance.now(),
    lastStageAt: performance.now(),
    lastStage: null,
    once: new Set(),
    asyncStarts: new Map(),
  };
  log("Pattern", "Open");
};

export const elapsedSinceOpen = (): number =>
  session ? performance.now() - session.openedAt : 0;

/** Mark the start of an async operation; call the returned fn when it finishes. */
export const markAsyncStart = (
  category: string,
  key: string,
): ((finishLabel?: string) => void) => {
  const start = performance.now();
  session?.asyncStarts.set(key, start);
  log(category, "Start");
  return (finishLabel = "Finished") => {
    log(category, finishLabel, performance.now() - start);
    session?.asyncStarts.delete(key);
  };
};

export const logReconcileStart = (): (() => void) =>
  markAsyncStart("Reconcile", "reconcile");

export const logVoiceFetchStart = (
  passage: PatternPassage,
): (() => void) => {
  const voiceStart = performance.now();
  log("Voice", "Start");

  if (mechanismPending(passage)) {
    logOnce(`mechanism-requested:${passage.cacheKey}`, "Mechanism", "Requested");
    session?.asyncStarts.set(`mechanism:${passage.cacheKey}`, performance.now());
    log("Mechanism", "Start");
  }
  if (questionPending(passage)) {
    logOnce(`question-requested:${passage.cacheKey}`, "Question", "Requested");
    session?.asyncStarts.set(`question:${passage.cacheKey}`, performance.now());
    log("Question", "Start");
  }

  return () => log("Voice", "Finished", performance.now() - voiceStart);
};

export const logVoiceFetchEnd = (
  before: PatternPassage,
  after: PatternPassage,
): void => {
  const finishIfStarted = (key: string, category: string, label: string) => {
    const start = session?.asyncStarts.get(key);
    if (start === undefined) return;
    log(category, label, performance.now() - start);
    session?.asyncStarts.delete(key);
  };

  const mechKey = `mechanism:${before.cacheKey}`;
  const questionKey = `question:${before.cacheKey}`;

  const hadMechanism = Boolean(mechanismText(before));
  const hasMechanism = Boolean(mechanismText(after));
  if (!hadMechanism && hasMechanism) {
    finishIfStarted(mechKey, "Mechanism", "Finished");
    logOnce(`mechanism-loaded:${after.cacheKey}`, "Mechanism", "Loaded", elapsedSinceOpen());
  } else if (session?.asyncStarts.has(mechKey)) {
    finishIfStarted(
      mechKey,
      "Mechanism",
      mechanismPending(after) ? "Finished (still pending)" : "Finished",
    );
  }

  const hadQuestion = Boolean(questionText(before));
  const hasQuestion = Boolean(questionText(after));
  if (!hadQuestion && hasQuestion) {
    finishIfStarted(questionKey, "Question", "Finished");
    logOnce(`question-loaded:${after.cacheKey}`, "Question", "Loaded", elapsedSinceOpen());
  } else if (session?.asyncStarts.has(questionKey)) {
    finishIfStarted(
      questionKey,
      "Question",
      questionPending(after) ? "Finished (still pending)" : "Finished",
    );
  }
};

/** Log when voice slots newly appear in passage state (cache hit or generation). */
export const logPassageVoiceReady = (
  before: PatternPassage | null | undefined,
  after: PatternPassage | null | undefined,
): void => {
  if (!after) return;

  if (!mechanismText(before) && mechanismText(after)) {
    logOnce(`mechanism-loaded:${after.cacheKey}`, "Mechanism", "Loaded", elapsedSinceOpen());
  }
  if (!questionText(before) && questionText(after)) {
    logOnce(`question-loaded:${after.cacheKey}`, "Question", "Loaded", elapsedSinceOpen());
  }

  if (mechanismPending(after)) {
    logOnce(`mechanism-requested:${after.cacheKey}`, "Mechanism", "Requested");
  }
  if (questionPending(after)) {
    logOnce(`question-requested:${after.cacheKey}`, "Question", "Requested");
  }
};

export const logQuotesRendered = (quoteCount: number): void => {
  logOnce("quotes-rendered", "Quotes", `Rendered (${quoteCount} visible)`);
};

export const logVoiceGenerationBatchStart = (patternNames: string[]): void => {
  log("Voice", `Batch start (${patternNames.join(", ")})`);
};

export const logVoiceGenerationBatchEnd = (
  patternNames: string[],
  startMs: number,
): void => {
  log("Voice", `Batch finished (${patternNames.join(", ")})`, performance.now() - startMs);
};

export const logPopoverReady = (overflowCount: number): void => {
  if (overflowCount <= 0) return;
  logOnce("popover-ready", "Popover", `Ready (+${overflowCount} more)`);
};

export const logMechanismRendered = (): void => {
  logOnce("mechanism-rendered", "Mechanism", "Rendered", elapsedSinceOpen());
};

export const logQuestionRendered = (): void => {
  logOnce("question-rendered", "Question", "Rendered", elapsedSinceOpen());
};

export const logCtaReady = (): void => {
  logOnce("cta-ready", "CTA", "Ready", elapsedSinceOpen());
};

export const logCtaWaiting = (reason: string): void => {
  logOnce(`cta-waiting:${reason}`, "CTA", `Waiting (${reason})`, elapsedSinceOpen());
};

export const logStageAtIndex = (
  phase: DiscoveryPhase,
  phaseIndex: number,
  phases: DiscoveryPhase[],
): void => {
  if (!session) return;

  const label = phaseLabel(phase);
  const now = performance.now();
  const elapsed = now - session.lastStageAt;

  if (session.lastStage && session.lastStage !== label) {
    log("Stage", `${session.lastStage} → ${label}`, elapsed);
  } else if (!session.lastStage) {
    log("Stage", `Open → ${label}`, now - session.openedAt);
  }

  session.lastStage = label;
  session.lastStageAt = now;

  if (phaseIndex >= phases.length - 1) {
    logOnce("done-reached", "Pattern", "Done reached");
  }
};
