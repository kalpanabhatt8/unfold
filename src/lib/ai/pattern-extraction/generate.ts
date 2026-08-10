import "server-only";

import { callAnthropicMessages } from "@/lib/ai/claude";
import {
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_MODEL,
  EXTRACTION_TEMPERATURE,
} from "@/lib/ai/pattern-extraction/constants";
import {
  buildExtractionDebugTrace,
  type ExtractionDebugTrace,
} from "@/lib/ai/pattern-extraction/debug-trace";
import { fallbackExtraction } from "@/lib/ai/pattern-extraction/fallback";
import { prepareExtractionInput } from "@/lib/ai/pattern-extraction/input";
import { parseExtractionResponse } from "@/lib/ai/pattern-extraction/parse";
import { buildExtractionPrompt } from "@/lib/ai/pattern-extraction/prompt";
import { validateExtraction } from "@/lib/ai/pattern-extraction/validation";
import type { EntryAnalysisResult } from "@/lib/patterns/types";

/** TEMPORARY — product path ignores `_debug`; debug page / client store use it. */
export type ExtractPatternsResult = EntryAnalysisResult & {
  _debug?: ExtractionDebugTrace;
};

export async function extractPatterns(
  apiKey: string,
  text: string,
): Promise<ExtractPatternsResult> {
  const prepared = prepareExtractionInput(text);

  const result = await callAnthropicMessages(apiKey, {
    model: EXTRACTION_MODEL,
    prompt: buildExtractionPrompt(prepared),
    maxTokens: EXTRACTION_MAX_TOKENS,
    temperature: EXTRACTION_TEMPERATURE,
  });

  if (!result.ok) {
    console.error("[pattern-extraction] upstream error", result.status);
    return fallbackExtraction("upstream_error");
  }

  if (!result.text) {
    return fallbackExtraction("empty_response");
  }

  const parsed = parseExtractionResponse(result.text);
  const _debug = buildExtractionDebugTrace({
    rawResponse: result.text,
    parsed,
    sourceText: prepared,
    model: EXTRACTION_MODEL,
  });

  const payload = validateExtraction(parsed, prepared);

  if (!payload) {
    console.warn(
      "[pattern-extraction] invalid output",
      // Never log raw LLM / journal content — status only.
      { model: EXTRACTION_MODEL, responseChars: result.text.length },
    );
    return { ...fallbackExtraction("invalid_output"), _debug };
  }

  return { analysis: payload, _debug };
}
