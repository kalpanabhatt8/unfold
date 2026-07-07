import {
  REFLECTION_MAX_COMMON_THREAD_CHARS,
  REFLECTION_MAX_OBSERVATION_CHARS,
} from "@/lib/ai/pattern-reflection/constants";
import type { PatternInsight } from "@/lib/patterns/types";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const ADVICE_MARKERS =
  /\b(should|try to|you need to|you must|consider|remember to|it's important|i recommend|you could)\b/i;

const THERAPY_MARKERS =
  /\b(healing|mindfulness|self-care|trauma|wellness|journey|growth mindset)\b/i;

export type ReflectionValidationResult =
  | { ok: true; insight: PatternInsight }
  | { ok: false; reason: string; insight: PatternInsight | null };

function normalizeFields(raw: unknown): PatternInsight | null {
  if (!isRecord(raw)) return null;
  const observation =
    typeof raw.observation === "string" ? raw.observation.trim() : "";
  const commonThread =
    typeof raw.commonThread === "string" ? raw.commonThread.trim() : "";
  if (!observation || !commonThread) return null;
  return { observation, commonThread };
}

function isGroundedInQuotes(observation: string, quotes: string[]): boolean {
  const obsLower = observation.toLowerCase();
  const words = obsLower.split(/\s+/).filter((w) => w.length > 4);
  if (words.length === 0) return false;

  const quoteText = quotes.join(" ").toLowerCase();
  const shared = words.filter((w) => quoteText.includes(w));
  return shared.length >= 1;
}

function echoesDefinition(
  observation: string,
  definition: string,
): boolean {
  const defWords = definition
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 5);
  const obsLower = observation.toLowerCase();
  const hits = defWords.filter((w) => obsLower.includes(w));
  return hits.length >= 3;
}

/** Validate reflection quality — grounded, curious, not definitional. */
export function validateReflection(
  raw: unknown,
  quotes: string[],
  definition: string,
): ReflectionValidationResult {
  const insight = normalizeFields(raw);
  if (!insight) {
    return { ok: false, reason: "empty", insight: null };
  }

  if (
    insight.observation.length > REFLECTION_MAX_OBSERVATION_CHARS ||
    insight.commonThread.length > REFLECTION_MAX_COMMON_THREAD_CHARS
  ) {
    return { ok: false, reason: "too_long", insight };
  }

  if (
    !insight.commonThread.startsWith("Each one") &&
    !insight.commonThread.startsWith("All of them")
  ) {
    return { ok: false, reason: "invalid_common_thread", insight };
  }

  if (echoesDefinition(insight.observation, definition)) {
    return { ok: false, reason: "definition_echo", insight };
  }

  if (
    ADVICE_MARKERS.test(insight.observation) ||
    ADVICE_MARKERS.test(insight.commonThread)
  ) {
    return { ok: false, reason: "advice_voice", insight };
  }

  if (
    THERAPY_MARKERS.test(insight.observation) ||
    THERAPY_MARKERS.test(insight.commonThread)
  ) {
    return { ok: false, reason: "advice_voice", insight };
  }

  if (!isGroundedInQuotes(insight.observation, quotes)) {
    return { ok: false, reason: "not_grounded", insight };
  }

  return { ok: true, insight };
}
