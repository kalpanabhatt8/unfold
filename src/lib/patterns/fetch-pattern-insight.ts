/**
 * Client caller for cross-entry pattern insights (observation + common thread).
 */

import { fallbackPatternInsight } from "@/lib/patterns/fallback-insight";
import {
  getCachedInsight,
  putCachedInsight,
} from "@/lib/patterns/pattern-insight-store";
import type { PatternInsight } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

const INSIGHT_TIMEOUT_MS = 15_000;

export type PatternInsightInput = {
  name: PatternName;
  entryIds: string[];
  quotes: string[];
  topics: string[];
};

export async function fetchPatternInsight(
  input: PatternInsightInput,
): Promise<PatternInsight> {
  const cached = getCachedInsight(input.name, input.entryIds);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    INSIGHT_TIMEOUT_MS,
  );

  try {
    const res = await fetch("/api/pattern-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patternName: input.name,
        quotes: input.quotes,
        topics: input.topics,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return fallbackPatternInsight(input.name);

    const body = (await res.json()) as {
      insight: PatternInsight | null;
    };

    if (
      !body.insight?.observation?.trim() ||
      !body.insight?.commonThread?.trim()
    ) {
      return fallbackPatternInsight(input.name);
    }

    putCachedInsight(input.name, input.entryIds, body.insight);
    return body.insight;
  } catch {
    return fallbackPatternInsight(input.name);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
