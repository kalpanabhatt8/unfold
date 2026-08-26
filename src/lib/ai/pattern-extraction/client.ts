import { BROWSER_PATTERN_AI_DISABLED } from "@/lib/ai/server-only-policy";
import { EXTRACTION_CLIENT_TIMEOUT_MS } from "@/lib/ai/pattern-extraction/constants";
import type { ExtractionDebugTrace } from "@/lib/ai/pattern-extraction/debug-types";
import type { AnalysisPayload, EntryAnalysisResult } from "@/lib/patterns/types";

export type EntryAnalysisFetchResult = {
  analysis: AnalysisPayload | null;
  debug?: ExtractionDebugTrace;
  failureReason?: string;
};

export async function fetchEntryAnalysis(
  text: string,
  options?: { debug?: boolean },
): Promise<AnalysisPayload | null> {
  const result = await fetchEntryAnalysisDetailed(text, options);
  return result.analysis;
}

/** Pattern extraction is server-only — browser returns empty. */
export async function fetchEntryAnalysisDetailed(
  text: string,
  _options?: { debug?: boolean },
): Promise<EntryAnalysisFetchResult> {
  if (BROWSER_PATTERN_AI_DISABLED || !text.trim()) {
    return { analysis: null, failureReason: "server_only" };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    EXTRACTION_CLIENT_TIMEOUT_MS,
  );

  try {
    const res = await fetch("/api/entry-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
      signal: controller.signal,
    });

    if (!res.ok) return { analysis: null };

    const body = (await res.json()) as EntryAnalysisResult & {
      _debug?: ExtractionDebugTrace;
    };
    return {
      analysis: body.analysis ?? null,
      debug: body._debug,
      failureReason:
        body.analysis === null && "reason" in body ? body.reason : undefined,
    };
  } catch {
    return { analysis: null };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
