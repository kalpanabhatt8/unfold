import { callAnthropicMessages } from "@/lib/ai/claude";
import {
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_MODEL,
  EXTRACTION_TEMPERATURE,
} from "@/lib/ai/pattern-extraction/constants";
import { fallbackExtraction } from "@/lib/ai/pattern-extraction/fallback";
import { prepareExtractionInput } from "@/lib/ai/pattern-extraction/input";
import { parseExtractionResponse } from "@/lib/ai/pattern-extraction/parse";
import { buildExtractionPrompt } from "@/lib/ai/pattern-extraction/prompt";
import { validateExtraction } from "@/lib/ai/pattern-extraction/validation";
import type { EntryAnalysisResult } from "@/lib/patterns/types";

export async function extractPatterns(
  apiKey: string,
  text: string,
): Promise<EntryAnalysisResult> {
  const prepared = prepareExtractionInput(text);

  const result = await callAnthropicMessages(apiKey, {
    model: EXTRACTION_MODEL,
    prompt: buildExtractionPrompt(prepared),
    maxTokens: EXTRACTION_MAX_TOKENS,
    temperature: EXTRACTION_TEMPERATURE,
  });

  if (!result.ok) {
    console.error("[pattern-extraction] upstream error", result.status, result.error);
    return fallbackExtraction("upstream_error");
  }

  if (!result.text) {
    return fallbackExtraction("empty_response");
  }

  const parsed = parseExtractionResponse(result.text);
  const payload = validateExtraction(parsed, prepared);

  if (!payload) {
    console.warn(
      "[pattern-extraction] invalid output",
      result.text.slice(0, 300),
    );
    return fallbackExtraction("invalid_output");
  }

  return { analysis: payload };
}
