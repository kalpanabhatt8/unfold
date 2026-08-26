import { BROWSER_PATTERN_AI_DISABLED } from "@/lib/ai/server-only-policy";
import {
  CRISIS_CLIENT_TIMEOUT_MS,
  type CrisisRiskResult,
} from "@/lib/ai/crisis-risk/constants";

/**
 * Crisis classification is server-only. Returns null so legacy callers fail open.
 */
export async function fetchCrisisRisk(
  text: string,
): Promise<CrisisRiskResult | null> {
  if (BROWSER_PATTERN_AI_DISABLED || !text.trim()) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    CRISIS_CLIENT_TIMEOUT_MS,
  );

  try {
    const res = await fetch("/api/crisis-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const body = (await res.json()) as Partial<CrisisRiskResult>;
    if (typeof body.flagged !== "boolean") return null;

    const confidence =
      typeof body.confidence === "number" && Number.isFinite(body.confidence)
        ? Math.min(1, Math.max(0, body.confidence))
        : 0;

    return { flagged: body.flagged, confidence };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
