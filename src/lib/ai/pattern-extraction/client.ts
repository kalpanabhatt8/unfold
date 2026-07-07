import { EXTRACTION_CLIENT_TIMEOUT_MS } from "@/lib/ai/pattern-extraction/constants";
import type { AnalysisPayload, EntryAnalysisResult } from "@/lib/patterns/types";

export async function fetchEntryAnalysis(
  text: string,
): Promise<AnalysisPayload | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    EXTRACTION_CLIENT_TIMEOUT_MS,
  );

  try {
    const res = await fetch("/api/entry-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const body = (await res.json()) as EntryAnalysisResult;
    return body.analysis ?? null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
