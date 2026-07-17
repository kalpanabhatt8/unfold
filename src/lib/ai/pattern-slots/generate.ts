import { callAnthropicMessages } from "@/lib/ai/claude";
import {
  SLOT_MAX_TOKENS,
  SLOT_MODEL,
  SLOT_TEMPERATURE,
} from "@/lib/ai/pattern-slots/constants";
import type {
  PriorVoiceSlot,
  SlotGenerationInput,
  VoiceSlotRequest,
} from "@/lib/ai/pattern-slots/input";
import { parseSlotResponse } from "@/lib/ai/pattern-slots/parse";
import {
  buildSlotPrompt,
  buildSlotRetryPrompt,
  SLOT_REJECTION_MESSAGES,
} from "@/lib/ai/pattern-slots/prompt";
import {
  validateSlotFills,
  type SlotRejection,
} from "@/lib/ai/pattern-slots/validation";
import type { ParsedSlotFill } from "@/lib/ai/pattern-slots/parse";

export type SlotGenerationResult = {
  fills: ParsedSlotFill[];
  rejected: SlotRejection[];
};

function rejectionMessage(reason: string): string {
  return SLOT_REJECTION_MESSAGES[reason] ?? reason;
}

async function attemptSlots(
  apiKey: string,
  input: SlotGenerationInput,
  buildPrompt: () => string,
): Promise<{ fills: ParsedSlotFill[]; reason?: string; rejected: SlotRejection[] }> {
  const roles = input.voiceSlots.map((s) => s.role).join("+");
  const started = performance.now();
  if (process.env.PATTERN_SLOTS_TIMING === "1") {
    console.log(
      `[pattern-slots] Claude START slots=${roles} indexes=${input.voiceSlots.map((s) => s.index).join(",")}`,
    );
  }

  const result = await callAnthropicMessages(apiKey, {
    model: SLOT_MODEL,
    prompt: buildPrompt(),
    maxTokens: SLOT_MAX_TOKENS,
    temperature: SLOT_TEMPERATURE,
  });

  if (process.env.PATTERN_SLOTS_TIMING === "1") {
    console.log(
      `[pattern-slots] Claude END slots=${roles} ${(performance.now() - started).toFixed(0)}ms ok=${result.ok}`,
    );
  }

  if (!result.ok) {
    console.error("[pattern-slots] upstream error", result.status, result.error);
    return { fills: [], rejected: [] };
  }

  if (!result.text) return { fills: [], reason: "empty", rejected: [] };

  const parsed = parseSlotResponse(result.text);
  if (!parsed) return { fills: [], reason: "parsing_error", rejected: [] };

  const validation = validateSlotFills(
    parsed,
    input.voiceSlots,
    input.quotes,
    input.definition,
    input.label,
    input.priorVoice,
  );

  if (validation.ok) {
    return { fills: validation.fills, rejected: validation.rejected };
  }
  return {
    fills: validation.fills,
    reason: validation.reason,
    rejected: validation.rejected,
  };
}

const mergeFills = (
  a: ParsedSlotFill[],
  b: ParsedSlotFill[],
): ParsedSlotFill[] => {
  const map = new Map<number, ParsedSlotFill>();
  for (const fill of a) map.set(fill.index, fill);
  for (const fill of b) map.set(fill.index, fill);
  return [...map.values()];
};

const mergeRejected = (a: SlotRejection[], b: SlotRejection[]): SlotRejection[] => [
  ...a,
  ...b,
];

const coversAllSlots = (
  fills: ParsedSlotFill[],
  voiceSlots: SlotGenerationInput["voiceSlots"],
): boolean => {
  const filled = new Set(fills.map((f) => f.index));
  return voiceSlots.every((s) => filled.has(s.index));
};

const missingSlots = (
  fills: ParsedSlotFill[],
  voiceSlots: VoiceSlotRequest[],
): VoiceSlotRequest[] => {
  const filled = new Set(fills.map((f) => f.index));
  return voiceSlots.filter((s) => !filled.has(s.index));
};

const priorFromFills = (
  fills: ParsedSlotFill[],
  voiceSlots: VoiceSlotRequest[],
): PriorVoiceSlot[] => {
  const roleByIndex = new Map(voiceSlots.map((s) => [s.index, s.role]));
  return fills.flatMap((f) => {
    const role = roleByIndex.get(f.index);
    if (!role) return [];
    return [{ index: f.index, role, text: f.text }];
  });
};

/** Recognition arcs fill one slot at a time so realization sees connection. */
const isSequentialShape = (shapeId: string): boolean =>
  shapeId === "recognition" ||
  shapeId === "recognition_q" ||
  shapeId === "recognition_deep";

async function generateRecognitionSlots(
  apiKey: string,
  input: SlotGenerationInput,
): Promise<SlotGenerationResult> {
  const sorted = [...input.voiceSlots].sort((a, b) => a.index - b.index);
  let priorVoice = [...input.priorVoice];
  let allFills: ParsedSlotFill[] = [];
  let allRejected: SlotRejection[] = [];

  for (const slot of sorted) {
    const slotInput: SlotGenerationInput = {
      ...input,
      voiceSlots: [slot],
      priorVoice,
    };

    const first = await attemptSlots(apiKey, slotInput, () =>
      buildSlotPrompt(slotInput),
    );

    let fills = first.fills;
    let rejected = first.rejected;

    if (!fills.some((f) => f.index === slot.index) && first.reason) {
      const second = await attemptSlots(apiKey, slotInput, () =>
        buildSlotRetryPrompt(slotInput, rejectionMessage(first.reason!)),
      );
      fills = mergeFills(fills, second.fills);
      rejected = mergeRejected(rejected, second.rejected);
    }

    const accepted = fills.find((f) => f.index === slot.index);
    if (accepted) {
      allFills = mergeFills(allFills, [accepted]);
      priorVoice = [
        ...priorVoice,
        { index: slot.index, role: slot.role, text: accepted.text },
      ];
    }
    allRejected = mergeRejected(allRejected, rejected);
  }

  return { fills: allFills, rejected: allRejected };
}

/**
 * Batch path used by discovery (and other non-recognition shapes):
 * one Claude call for all requested slots, then retry only the slots that
 * failed validation — keep any that already passed.
 */
async function generateBatchedSlots(
  apiKey: string,
  input: SlotGenerationInput,
): Promise<SlotGenerationResult> {
  const first = await attemptSlots(apiKey, input, () => buildSlotPrompt(input));
  let fills = first.fills;
  let rejected = first.rejected;

  if (coversAllSlots(fills, input.voiceSlots)) {
    return { fills, rejected };
  }

  const pending = missingSlots(fills, input.voiceSlots);
  if (pending.length === 0) {
    return { fills, rejected };
  }

  const retryReason =
    first.rejected.find((r) => pending.some((s) => s.index === r.index))
      ?.reason ??
    first.reason ??
    "incomplete";

  const retryInput: SlotGenerationInput = {
    ...input,
    voiceSlots: pending,
    priorVoice: [
      ...input.priorVoice,
      ...priorFromFills(fills, input.voiceSlots),
    ],
  };

  const second = await attemptSlots(apiKey, retryInput, () =>
    buildSlotRetryPrompt(retryInput, rejectionMessage(retryReason)),
  );
  fills = mergeFills(fills, second.fills);
  rejected = mergeRejected(rejected, second.rejected);

  if (coversAllSlots(fills, input.voiceSlots)) {
    return { fills, rejected };
  }

  const stillPending = missingSlots(fills, input.voiceSlots);
  if (stillPending.length === 0 || !second.reason) {
    return { fills, rejected };
  }

  const thirdInput: SlotGenerationInput = {
    ...input,
    voiceSlots: stillPending,
    priorVoice: [
      ...input.priorVoice,
      ...priorFromFills(fills, input.voiceSlots),
    ],
  };

  const third = await attemptSlots(apiKey, thirdInput, () =>
    buildSlotRetryPrompt(
      thirdInput,
      `${rejectionMessage(second.reason!)} Return one line per requested slot index only.`,
    ),
  );

  return {
    fills: mergeFills(fills, third.fills),
    rejected: mergeRejected(rejected, third.rejected),
  };
}

/**
 * Generate voice slot text:
 * 1. Discovery / default: one call for all slots; retry only failures
 * 2. Recognition family: sequential so later slots see earlier voice
 * 3. Return whatever validated (may be partial)
 */
export async function generateSlotFills(
  apiKey: string,
  input: SlotGenerationInput,
): Promise<SlotGenerationResult> {
  if (isSequentialShape(input.shapeId) && input.voiceSlots.length > 0) {
    return generateRecognitionSlots(apiKey, input);
  }

  return generateBatchedSlots(apiKey, input);
}
