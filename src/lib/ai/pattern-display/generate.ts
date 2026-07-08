import { callAnthropicMessages } from "@/lib/ai/claude";
import {
  DISPLAY_MAX_TOKENS,
  DISPLAY_MODEL,
  DISPLAY_TEMPERATURE,
} from "@/lib/ai/pattern-display/constants";
import { prepareDisplayInput } from "@/lib/ai/pattern-display/input";
import { parseDisplayResponse } from "@/lib/ai/pattern-display/parse";
import {
  buildDisplayPrompt,
  buildDisplayRetryPrompt,
  DISPLAY_REJECTION_MESSAGES,
} from "@/lib/ai/pattern-display/prompt";
import { validateDisplay } from "@/lib/ai/pattern-display/validation";
import type { PatternDisplay } from "@/lib/patterns/types";
import type { DisplayInput } from "@/lib/ai/pattern-display/input";

function rejectionMessage(reason: string): string {
  return DISPLAY_REJECTION_MESSAGES[reason] ?? reason;
}

async function attemptDisplay(
  apiKey: string,
  input: DisplayInput,
  buildPrompt: () => string,
): Promise<{ display: PatternDisplay | null; reason?: string }> {
  const result = await callAnthropicMessages(apiKey, {
    model: DISPLAY_MODEL,
    prompt: buildPrompt(),
    maxTokens: DISPLAY_MAX_TOKENS,
    temperature: DISPLAY_TEMPERATURE,
  });

  if (!result.ok) {
    console.error("[pattern-display] upstream error", result.status, result.error);
    return { display: null };
  }

  if (!result.text) return { display: null, reason: "empty" };

  const parsed = parseDisplayResponse(result.text);
  const validation = validateDisplay(
    parsed,
    input.quotes,
    input.label,
    input.definition,
  );

  if (validation.ok) {
    return {
      display: {
        displayTitle: validation.display.displayTitle,
        summary: validation.display.summary,
        sourceEvidenceKey: "",
        createdAt: Date.now(),
      },
    };
  }

  return { display: null, reason: validation.reason };
}

export async function generateDisplay(
  apiKey: string,
  rawInput: {
    patternName: string;
    label: string;
    definition: string;
    quotes: string[];
  },
): Promise<PatternDisplay | null> {
  const input = prepareDisplayInput(rawInput);
  if (input.quotes.length === 0) return null;

  const first = await attemptDisplay(apiKey, input, () =>
    buildDisplayPrompt(input),
  );
  if (first.display) return first.display;

  if (first.reason) {
    const second = await attemptDisplay(apiKey, input, () =>
      buildDisplayRetryPrompt(input, rejectionMessage(first.reason!)),
    );
    if (second.display) return second.display;
  }

  return null;
}
