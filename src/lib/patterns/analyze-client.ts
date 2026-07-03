/**
 * Unfold — client caller for the entry-analysis route.
 *
 * Returns the validated payload on success, or null on any failure (no key,
 * network, upstream, invalid output). Never throws — a null simply means the
 * entry stays unanalyzed and is eligible for a later retry.
 */

import type { AnalysisPayload, EntryAnalysisResult } from "@/lib/patterns/types";

const ANALYSIS_TIMEOUT_MS = 12_000;

export async function fetchEntryAnalysis(
  text: string,
): Promise<AnalysisPayload | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    ANALYSIS_TIMEOUT_MS,
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
