/**
 * Whether a persisted EntryAnalysis is still valid for aggregation / reuse.
 *
 * Fail closed: missing promptVersion, wrong promptVersion, or content-hash
 * drift all count as stale. Entry-level tags may remain in storage; they must
 * not vote toward surfaced patterns until re-extracted under the current
 * extraction version.
 */

import { EXTRACTION_MODEL } from "@/lib/ai/pattern-extraction/constants";
import { PROMPT_VERSIONS } from "@/lib/ai/versions";
import { contentHash } from "@/lib/content-hash";
import type { EntryAnalysis } from "@/lib/patterns/types";

export const currentExtractionPromptVersion = (): string =>
  PROMPT_VERSIONS.extraction;

export const currentExtractionModelId = (): string => EXTRACTION_MODEL;

/** Stamp fields to attach whenever we persist a fresh extraction. */
export const extractionProvenance = (
  text: string,
): Pick<EntryAnalysis, "sourceContentHash" | "promptVersion" | "modelId"> => ({
  sourceContentHash: contentHash(text),
  promptVersion: PROMPT_VERSIONS.extraction,
  modelId: EXTRACTION_MODEL,
});

/**
 * True when this analysis was produced by the current extraction pipeline
 * for the given entry text.
 */
export function isAnalysisCurrent(
  analysis: EntryAnalysis,
  entryText: string,
): boolean {
  if (analysis.promptVersion !== PROMPT_VERSIONS.extraction) return false;
  if (!analysis.sourceContentHash) return false;
  return analysis.sourceContentHash === contentHash(entryText);
}

export function isAnalysisStale(
  analysis: EntryAnalysis,
  entryText: string,
): boolean {
  return !isAnalysisCurrent(analysis, entryText);
}
