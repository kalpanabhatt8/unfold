import { DISPLAY_CLIENT_TIMEOUT_MS } from "@/lib/ai/pattern-display/constants";
import { fallbackDisplay } from "@/lib/ai/pattern-display/fallback";
import {
  getCachedDisplay,
  putCachedDisplay,
} from "@/lib/patterns/pattern-display-store";
import type { PatternDisplay } from "@/lib/patterns/types";
import type { PatternName } from "@/lib/patterns/vocabulary";

export type PatternDisplayInput = {
  name: PatternName;
  evidenceKey: string;
  quotes: string[];
};

export async function fetchPatternDisplay(
  input: PatternDisplayInput,
): Promise<PatternDisplay> {
  const cached = getCachedDisplay(input.name, input.evidenceKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    DISPLAY_CLIENT_TIMEOUT_MS,
  );

  try {
    const res = await fetch("/api/pattern-display", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patternName: input.name,
        quotes: input.quotes,
        evidenceKey: input.evidenceKey,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return putCachedDisplay(
        input.name,
        input.evidenceKey,
        fallbackDisplay(input.name, input.evidenceKey),
      );
    }

    const body = (await res.json()) as { display: PatternDisplay | null };

    if (!body.display?.displayTitle?.trim()) {
      return putCachedDisplay(
        input.name,
        input.evidenceKey,
        fallbackDisplay(input.name, input.evidenceKey),
      );
    }

    return putCachedDisplay(input.name, input.evidenceKey, {
      displayTitle: body.display.displayTitle,
      summary: body.display.summary,
    });
  } catch {
    return putCachedDisplay(
      input.name,
      input.evidenceKey,
      fallbackDisplay(input.name, input.evidenceKey),
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}
