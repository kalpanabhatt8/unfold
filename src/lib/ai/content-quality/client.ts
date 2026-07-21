import {
  QUALITY_CLIENT_TIMEOUT_MS,
  type ContentQualityResult,
} from "@/lib/ai/content-quality/constants";

/**
 * Client wrapper for content-quality classification.
 * Returns null on failure/timeout so callers can fail open (treat as unflagged).
 */
export async function fetchContentQuality(
  text: string,
): Promise<ContentQualityResult | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    QUALITY_CLIENT_TIMEOUT_MS,
  );

  try {
    const res = await fetch("/api/content-quality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
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
