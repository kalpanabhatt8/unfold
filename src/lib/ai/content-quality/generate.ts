import { callAnthropicMessages } from "@/lib/ai/claude";
import {
  QUALITY_MAX_TOKENS,
  QUALITY_MODEL,
  QUALITY_TEMPERATURE,
  type ContentQualityResult,
} from "@/lib/ai/content-quality/constants";
import {
  parseContentQualityResponse,
  validateContentQuality,
} from "@/lib/ai/content-quality/parse";
import { buildContentQualityPrompt } from "@/lib/ai/content-quality/prompt";

export async function classifyContentQuality(
  apiKey: string,
  entryText: string,
): Promise<ContentQualityResult> {
  const result = await callAnthropicMessages(apiKey, {
    model: QUALITY_MODEL,
    prompt: buildContentQualityPrompt(entryText),
    maxTokens: QUALITY_MAX_TOKENS,
    temperature: QUALITY_TEMPERATURE,
  });

  if (!result.ok) {
    throw new Error(`quality_upstream_${result.status}`);
  }

  if (!result.text) {
    throw new Error("quality_empty_response");
  }

  const parsed = parseContentQualityResponse(result.text);
  const validated = validateContentQuality(parsed);
  if (!validated) {
    throw new Error("quality_invalid_output");
  }

  return validated;
}
