import { callAnthropicMessages } from "@/lib/ai/claude";
import {
  CRISIS_MAX_TOKENS,
  CRISIS_MODEL,
  CRISIS_TEMPERATURE,
  type CrisisRiskResult,
} from "@/lib/ai/crisis-risk/constants";
import {
  parseCrisisRiskResponse,
  validateCrisisRisk,
} from "@/lib/ai/crisis-risk/parse";
import { buildCrisisRiskPrompt } from "@/lib/ai/crisis-risk/prompt";

export async function classifyCrisisRisk(
  apiKey: string,
  entryText: string,
): Promise<CrisisRiskResult> {
  const result = await callAnthropicMessages(apiKey, {
    model: CRISIS_MODEL,
    prompt: buildCrisisRiskPrompt(entryText),
    maxTokens: CRISIS_MAX_TOKENS,
    temperature: CRISIS_TEMPERATURE,
  });

  if (!result.ok) {
    throw new Error(`crisis_upstream_${result.status}`);
  }

  if (!result.text) {
    throw new Error("crisis_empty_response");
  }

  const parsed = parseCrisisRiskResponse(result.text);
  const validated = validateCrisisRisk(parsed);
  if (!validated) {
    throw new Error("crisis_invalid_output");
  }

  return validated;
}
