/** Extract the first JSON object from model output — content-quality feature only. */
export function parseContentQualityResponse(raw: string): unknown | null {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function validateContentQuality(parsed: unknown): {
  flagged: boolean;
  confidence: number;
} | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.flagged !== "boolean") return null;

  let confidence = 0;
  if (typeof record.confidence === "number" && Number.isFinite(record.confidence)) {
    confidence = Math.min(1, Math.max(0, record.confidence));
  }

  return { flagged: record.flagged, confidence };
}
