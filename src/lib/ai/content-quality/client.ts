import { BROWSER_PATTERN_AI_DISABLED } from "@/lib/ai/server-only-policy";
import {
  QUALITY_CLIENT_TIMEOUT_MS,
  type ContentQualityResult,
} from "@/lib/ai/content-quality/constants";

/**
 * Content-quality classification is server-only. Returns null so legacy callers fail open.
 */
export async function fetchContentQuality(
  text: string,
): Promise<ContentQualityResult | null> {
  if (BROWSER_PATTERN_AI_DISABLED || !text.trim()) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    QUALITY_CLIENT_TIMEOUT_MS,
  );

  try {
    const res = await fetch("/api/content-quality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const body = (await res.json()) as Partial<ContentQualityResult>;
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
