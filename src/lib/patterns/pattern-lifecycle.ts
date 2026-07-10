/**
 * Cross-session voice generation lifecycle — tracks in-flight batches so
 * reopening a pattern can reattach instead of replanning or starting over.
 */

import type { PatternPassage } from "@/lib/patterns/passage-types";
import type { PatternName } from "@/lib/patterns/vocabulary";

const voiceGenByPattern = new Map<PatternName, Promise<PatternPassage>>();

export const isVoiceGenerationActive = (name: PatternName): boolean =>
  voiceGenByPattern.has(name);

export const getVoiceGenerationPromise = (
  name: PatternName,
): Promise<PatternPassage> | undefined => voiceGenByPattern.get(name);

export const trackVoiceGeneration = (
  name: PatternName,
  promise: Promise<PatternPassage>,
): Promise<PatternPassage> => {
  const existing = voiceGenByPattern.get(name);
  if (existing) return existing;

  voiceGenByPattern.set(name, promise);
  void promise.finally(() => {
    if (voiceGenByPattern.get(name) === promise) {
      voiceGenByPattern.delete(name);
    }
  });
  return promise;
};
