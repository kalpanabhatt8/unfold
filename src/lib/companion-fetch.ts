import {
  isCompanionEmotion,
  type CompanionEmotion,
} from "@/lib/companion-emotions";
import type { CompanionAnalysis, CompanionConfidence } from "@/lib/companion-analysis";
import {
  logCompanionRawResponse,
  type CompanionAnalysisSource,
  type CompanionRawResponse,
} from "@/lib/companion-debug";

/** Abort Claude if no response within this window — caller falls back to keywords. */
const COMPANION_API_TIMEOUT_MS = 3_000;

/** Non-retryable — route returned a permanent-failure "unavailable" payload. */
export class CompanionUnavailableError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "CompanionUnavailableError";
    this.reason = reason;
  }
}

const isCompanionConfidence = (value: unknown): value is CompanionConfidence =>
  value === "high" || value === "medium" || value === "low";

const postCompanion = (body: { text: string }, signal?: AbortSignal) =>
  fetch("/api/companion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

const parseAnalysis = (data: unknown): CompanionRawResponse | null => {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (!isCompanionEmotion(record.emotion)) return null;
  if (!isCompanionConfidence(record.confidence)) return null;
  const debug =
    record._debug && typeof record._debug === "object"
      ? (record._debug as CompanionRawResponse["_debug"])
      : undefined;

  return {
    emotion: record.emotion as CompanionEmotion,
    confidence: record.confidence,
    _debug: debug,
  };
};

/** Ping the route so Next.js dev compiles it before the first classification. */
export const warmCompanionRoute = async (): Promise<void> => {
  const RETRY_DELAYS = [500, 1_000, 1_500, 2_000, 3_000] as const;
  const isNotReady = (s: number) => s === 404 || s === 502 || s === 503;
  for (let i = 0; i < RETRY_DELAYS.length; i++) {
    try {
      const res = await fetch("/api/companion");
      if (!isNotReady(res.status)) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => window.setTimeout(r, RETRY_DELAYS[i]));
  }
};

/**
 * Classify full canvas text (single attempt, 3 s abort).
 * Throws on any failure so the caller can fall back to keyword detection.
 */
export const fetchCompanionAnalysis = async (
  text: string
): Promise<CompanionAnalysis> => {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty companion context");

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    COMPANION_API_TIMEOUT_MS
  );

  try {
    const res = await postCompanion({ text: trimmed }, controller.signal);

    if (!res.ok) throw new Error(`Companion API failed (${res.status})`);

    const body = await res.json();
    const parsed = parseAnalysis(body);
    if (!parsed) throw new Error("Invalid companion analysis");

    const source: CompanionAnalysisSource = parsed._debug?.source ?? "claude";
    logCompanionRawResponse(parsed, source);

    if (source === "unavailable") {
      throw new CompanionUnavailableError(
        parsed._debug?.fallbackReason ?? "Companion classification unavailable"
      );
    }

    return { emotion: parsed.emotion, confidence: parsed.confidence };
  } finally {
    window.clearTimeout(timeoutId);
  }
};
