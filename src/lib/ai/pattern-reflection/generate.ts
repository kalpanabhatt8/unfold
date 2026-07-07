import { callAnthropicMessages } from "@/lib/ai/claude";
import {
  REFLECTION_MAX_TOKENS,
  REFLECTION_MODEL,
  REFLECTION_TEMPERATURE,
} from "@/lib/ai/pattern-reflection/constants";
import { prepareReflectionInput } from "@/lib/ai/pattern-reflection/input";
import { parseReflectionResponse } from "@/lib/ai/pattern-reflection/parse";
import {
  buildReflectionPrompt,
  buildReflectionRetryPrompt,
  REFLECTION_REJECTION_MESSAGES,
} from "@/lib/ai/pattern-reflection/prompt";
import { validateReflection } from "@/lib/ai/pattern-reflection/validation";
import type { PatternInsight } from "@/lib/patterns/types";
import type { ReflectionInput } from "@/lib/ai/pattern-reflection/input";

function rejectionMessage(reason: string): string {
  return REFLECTION_REJECTION_MESSAGES[reason] ?? reason;
}

async function attemptReflection(
  apiKey: string,
  input: ReflectionInput,
  buildPrompt: () => string,
): Promise<{ insight: PatternInsight | null; reason?: string }> {
  const result = await callAnthropicMessages(apiKey, {
    model: REFLECTION_MODEL,
    prompt: buildPrompt(),
    maxTokens: REFLECTION_MAX_TOKENS,
    temperature: REFLECTION_TEMPERATURE,
  });

  if (!result.ok) {
    console.error("[pattern-reflection] upstream error", result.status, result.error);
    return { insight: null };
  }

  if (!result.text) {
    return { insight: null, reason: "empty" };
  }

  const parsed = parseReflectionResponse(result.text);
  const validation = validateReflection(
    parsed,
    input.quotes,
    input.definition,
  );

  if (validation.ok) return { insight: validation.insight };

  return { insight: null, reason: validation.reason };
}

/**
 * Pattern reflection orchestration:
 * 1. Reflection prompt → validate (grounded in quotes)
 * 2. Retry with rejection reason → validate
 * 3. null (client applies fallbackReflection)
 */
export async function generateReflection(
  apiKey: string,
  rawInput: {
    patternName: string;
    label: string;
    definition: string;
    quotes: string[];
    topics: string[];
  },
): Promise<PatternInsight | null> {
  const input = prepareReflectionInput(rawInput);
  if (input.quotes.length === 0) return null;

  const first = await attemptReflection(apiKey, input, () =>
    buildReflectionPrompt(input),
  );
  if (first.insight) return first.insight;

  if (first.reason) {
    const second = await attemptReflection(apiKey, input, () =>
      buildReflectionRetryPrompt(input, rejectionMessage(first.reason!)),
    );
    if (second.insight) return second.insight;
  }

  return null;
}
