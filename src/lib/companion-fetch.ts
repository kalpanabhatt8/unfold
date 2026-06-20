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

const COMPANION_API_TIMEOUT_MS = 12_000;
/** Dev cold-start / HMR — wait between retries when the route is not ready yet. */
const COMPANION_ROUTE_RETRY_MS = [500, 1_000, 1_500, 2_000, 3_000] as const;

const isRouteNotReady = (status: number) =>
  status === 404 || status === 502 || status === 503;

const isCompanionConfidence = (value: unknown): value is CompanionConfidence =>
  value === "high" || value === "low";

const postCompanion = (
  body: { text: string; scope?: "delta" },
  signal?: AbortSignal
) =>
  fetch("/api/companion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

const waitForRetry = (attempt: number) =>
  new Promise((r) =>
    window.setTimeout(r, COMPANION_ROUTE_RETRY_MS[attempt] ?? 3_000)
  );

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
  for (let attempt = 0; attempt < COMPANION_ROUTE_RETRY_MS.length; attempt++) {
    try {
      const res = await fetch("/api/companion");
      if (!isRouteNotReady(res.status)) return;
    } catch {
      /* retry */
    }
    await waitForRetry(attempt);
  }
};

/** Classify journal context (retries when the dev route is cold). */
export const fetchCompanionAnalysis = async (
  text: string
): Promise<CompanionAnalysis> => {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty companion context");
  }

  let lastError: unknown;
  const maxAttempts = COMPANION_ROUTE_RETRY_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      COMPANION_API_TIMEOUT_MS
    );

    try {
      const res = await postCompanion(
        { text: trimmed, scope: "delta" },
        controller.signal
      );

      if (isRouteNotReady(res.status) && attempt < maxAttempts - 1) {
        await waitForRetry(attempt);
        continue;
      }

      if (!res.ok) {
        throw new Error(`Companion API failed (${res.status})`);
      }

      const body = await res.json();
      const parsed = parseAnalysis(body);
      if (!parsed) {
        throw new Error("Invalid companion analysis");
      }

      const source: CompanionAnalysisSource =
        parsed._debug?.source ?? "gemini";
      logCompanionRawResponse(parsed, source);

      return { emotion: parsed.emotion, confidence: parsed.confidence };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await waitForRetry(attempt);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error("Companion API failed");
};

/** @deprecated Use fetchCompanionAnalysis */
export const fetchCompanionEmotion = async (
  emotionText: string
): Promise<CompanionEmotion> => {
  const result = await fetchCompanionAnalysis(emotionText);
  return result.emotion;
};
