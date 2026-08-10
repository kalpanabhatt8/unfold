/**
 * TEMPORARY — localStorage store for pattern pipeline debug traces.
 * Delete after the extraction/aggregation experiment.
 *
 * All reads/writes are gated by canUsePatternPipelineDebugClient() so this
 * key is never written or read outside the locked local debug path.
 */

import type { ExtractionDebugTrace } from "@/lib/ai/pattern-extraction/debug-types";
import { canUsePatternPipelineDebugClient } from "@/lib/patterns/pattern-pipeline-debug-access";

export const PATTERN_PIPELINE_DEBUG_KEY = "unfold-pattern-pipeline-debug-TEMP";
export const PATTERN_PIPELINE_DEBUG_EVENT = "unfold-pattern-pipeline-debug";

export type PatternPipelineDebugRecord = {
  entryId: string;
  capturedAt: number;
  source: "live_extraction" | "manual_rerun";
  extraction: ExtractionDebugTrace;
  /** Final analysis returned by the same request (may match store). */
  requestFinalAnalysis: {
    topics: string[];
    patterns: Array<{
      name: string;
      confidence: number;
      evidence: string[];
    }>;
  } | null;
  failureReason?: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const readAll = (): Record<string, PatternPipelineDebugRecord> => {
  if (typeof window === "undefined") return {};
  if (!canUsePatternPipelineDebugClient()) return {};
  try {
    const raw = window.localStorage.getItem(PATTERN_PIPELINE_DEBUG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return parsed as Record<string, PatternPipelineDebugRecord>;
  } catch {
    return {};
  }
};

const writeAll = (map: Record<string, PatternPipelineDebugRecord>) => {
  if (typeof window === "undefined") return;
  if (!canUsePatternPipelineDebugClient()) return;
  try {
    window.localStorage.setItem(PATTERN_PIPELINE_DEBUG_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(PATTERN_PIPELINE_DEBUG_EVENT));
  } catch (error) {
    console.error("[pattern-pipeline-debug] save failed", error);
  }
};

export const getPipelineDebug = (
  entryId: string,
): PatternPipelineDebugRecord | null => readAll()[entryId] ?? null;

export const listPipelineDebug = (): PatternPipelineDebugRecord[] =>
  Object.values(readAll()).sort((a, b) => b.capturedAt - a.capturedAt);

export const putPipelineDebug = (record: PatternPipelineDebugRecord): void => {
  if (!canUsePatternPipelineDebugClient()) return;
  const map = readAll();
  map[record.entryId] = record;
  writeAll(map);
};

export const clearPipelineDebug = (): void => {
  if (typeof window === "undefined") return;
  if (!canUsePatternPipelineDebugClient()) return;
  window.localStorage.removeItem(PATTERN_PIPELINE_DEBUG_KEY);
  window.dispatchEvent(new Event(PATTERN_PIPELINE_DEBUG_EVENT));
};
