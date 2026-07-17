import { applySlotFills } from "@/lib/patterns/passage-fill";
import { putCachedPassage } from "@/lib/patterns/passage-store";
import {
  passageNeedsGeneration,
  type PatternPassage,
} from "@/lib/patterns/passage-types";
import {
  logVoiceFetchEnd,
  logVoiceFetchStart,
} from "@/lib/patterns/pattern-timing";
import {
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
  type PatternName,
} from "@/lib/patterns/vocabulary";
import { SLOT_CLIENT_TIMEOUT_MS } from "@/lib/ai/pattern-slots/constants";
import { buildSlotGenerationInput } from "@/lib/ai/pattern-slots/input";
import { trackVoiceGeneration } from "@/lib/patterns/pattern-lifecycle";

const inflight = new Map<string, Promise<PatternPassage>>();

const flightKey = (passage: PatternPassage): string => {
  const input = buildSlotGenerationInput(
    passage,
    PATTERN_LABELS[passage.name],
    PATTERN_DEFINITIONS[passage.name],
  );
  const pending =
    input?.voiceSlots.map((s) => s.index).join(",") ?? "complete";
  return `${passage.name}|${passage.cacheKey}|${pending}`;
};

async function fetchPatternSlotFillsOnce(
  passage: PatternPassage,
): Promise<PatternPassage> {
  const input = buildSlotGenerationInput(
    passage,
    PATTERN_LABELS[passage.name],
    PATTERN_DEFINITIONS[passage.name],
  );

  if (!input) return passage;

  const finishVoice = logVoiceFetchStart(passage);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    SLOT_CLIENT_TIMEOUT_MS,
  );

  try {
    const res = await fetch("/api/pattern-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patternName: input.patternName,
        quotes: input.quotes,
        voiceSlots: input.voiceSlots,
        shapeId: input.shapeId,
        priorVoice: input.priorVoice,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(
        "[pattern-slots] API error",
        res.status,
        errText.slice(0, 200),
      );
      const empty = applySlotFills(passage, []);
      logVoiceFetchEnd(passage, empty);
      return empty;
    }

    const body = (await res.json()) as {
      fills: Array<{ index: number; text: string }>;
      rejected?: Array<{ index: number; text: string; reason: string }>;
    };

    if ((body.rejected ?? []).length > 0) {
      console.warn(
        "[pattern-slots] rejected",
        passage.name,
        body.rejected,
      );
    }

    const filled = applySlotFills(passage, body.fills ?? []);
    logVoiceFetchEnd(passage, filled);

    // Persist every round — including partial fills — so HMR / remounts
    // can resume from cache instead of losing completed voice slots.
    putCachedPassage(filled);

    if ((body.fills ?? []).length === 0) {
      console.warn(
        "[pattern-slots] no fills returned for",
        passage.name,
        passage.shapeId,
      );
    } else if (passageNeedsGeneration(filled)) {
      console.log(
        "[pattern-slots] partial fills for",
        passage.name,
        body.fills,
      );
    }

    return filled;
  } catch (error) {
    console.warn("[pattern-slots] generation failed", error);
    const empty = applySlotFills(passage, []);
    logVoiceFetchEnd(passage, empty);
    return empty;
  } finally {
    finishVoice();
    window.clearTimeout(timeoutId);
  }
}

export async function fetchPatternSlotFills(
  passage: PatternPassage,
): Promise<PatternPassage> {
  const key = flightKey(passage);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetchPatternSlotFillsOnce(passage).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

export type PassageGenerationTarget = {
  name: PatternName;
  passage: PatternPassage;
};

/**
 * HTTP rounds for incomplete voice. Server already retries failed slots
 * inside one request; stacking many client rounds was the multi-minute path.
 */
const MAX_GENERATION_ROUNDS = 2;

/** Generate voice slots — retries when validation leaves slots unfilled. */
export async function generatePassageSlots(
  targets: PassageGenerationTarget[],
): Promise<Map<PatternName, PatternPassage>> {
  const results = new Map<PatternName, PatternPassage>(
    targets.map(({ name, passage }) => [name, passage]),
  );

  for (let round = 0; round < MAX_GENERATION_ROUNDS; round += 1) {
    const pending = targets
      .map(({ name }) => ({ name, passage: results.get(name)! }))
      .filter(({ passage }) => passageNeedsGeneration(passage));

    if (pending.length === 0) break;

    if (round > 0) {
      console.log(
        "[pattern-slots] retry round",
        round + 1,
        "for",
        pending.map((p) => p.name),
      );
    }

    await Promise.all(
      pending.map(async ({ name, passage }) => {
        const filled = await fetchPatternSlotFills(passage);
        results.set(name, filled);
      }),
    );
  }

  return results;
}

/** Generate voice for one pattern — reattaches if a batch is already in flight. */
export async function generatePassageVoiceForPattern(
  target: PassageGenerationTarget,
): Promise<PatternPassage> {
  const run = async (): Promise<PatternPassage> => {
    const results = await generatePassageSlots([target]);
    return results.get(target.name) ?? target.passage;
  };
  return trackVoiceGeneration(target.name, run());
}
