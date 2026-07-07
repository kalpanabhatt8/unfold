import { REFLECTION_CLIENT_TIMEOUT_MS } from "@/lib/ai/pattern-reflection/constants";
import { fallbackReflection } from "@/lib/ai/pattern-reflection/fallback";
import {
  getCachedInsight,
  putCachedInsight,
} from "@/lib/patterns/pattern-insight-store";
import type { PatternInsight } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

export type PatternReflectionInput = {
  name: PatternName;
  entryIds: string[];
  quotes: string[];
  topics: string[];
};

export async function fetchPatternInsight(
  input: PatternReflectionInput,
): Promise<PatternInsight> {
  const cached = getCachedInsight(input.name, input.entryIds);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REFLECTION_CLIENT_TIMEOUT_MS,
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

    if (!res.ok) return fallbackReflection(input.name);

    const body = (await res.json()) as { insight: PatternInsight | null };

    if (
      !body.insight?.observation?.trim() ||
      !body.insight?.commonThread?.trim()
    ) {
      return fallbackReflection(input.name);
    }

    putCachedInsight(input.name, input.entryIds, body.insight);
    return body.insight;
  } catch {
    return fallbackReflection(input.name);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
