import { callAnthropicMessages } from "@/lib/ai/claude";
import {
  SLOT_MAX_TOKENS,
  SLOT_MODEL,
  SLOT_TEMPERATURE,
} from "@/lib/ai/pattern-slots/constants";
import type { SlotGenerationInput } from "@/lib/ai/pattern-slots/input";
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
  const result = await callAnthropicMessages(apiKey, {
    model: SLOT_MODEL,
    prompt: buildPrompt(),
    maxTokens: SLOT_MAX_TOKENS,
    temperature: SLOT_TEMPERATURE,
  });

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

const isRecognitionShape = (shapeId: string): boolean =>
  shapeId === "recognition" ||
  shapeId === "recognition_q" ||
  shapeId === "recognition_deep";

/** Recognition arcs fill one slot at a time so realization sees connection. */
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
 * Generate voice slot text:
 * 1. Prompt → validate (per-slot, drop failures)
 * 2. Retry with rejection reason when incomplete
 * 3. Return whatever validated (may be partial)
 */
export async function generateSlotFills(
  apiKey: string,
  input: SlotGenerationInput,
): Promise<SlotGenerationResult> {
  if (isRecognitionShape(input.shapeId) && input.voiceSlots.length > 0) {
    return generateRecognitionSlots(apiKey, input);
  }

  const first = await attemptSlots(apiKey, input, () => buildSlotPrompt(input));

  if (coversAllSlots(first.fills, input.voiceSlots)) {
    return { fills: first.fills, rejected: first.rejected };
  }

  const retryReason = first.reason ?? "incomplete";
  const second = await attemptSlots(apiKey, input, () =>
    buildSlotRetryPrompt(input, rejectionMessage(retryReason)),
  );

  const merged = mergeFills(first.fills, second.fills);
  const rejected = mergeRejected(first.rejected, second.rejected);

  if (coversAllSlots(merged, input.voiceSlots)) {
    return { fills: merged, rejected };
  }

  if (!coversAllSlots(merged, input.voiceSlots) && second.reason) {
    const third = await attemptSlots(apiKey, input, () =>
      buildSlotRetryPrompt(
        input,
        `${rejectionMessage(second.reason!)} Return one line per requested slot index only.`,
      ),
    );
    const final = mergeFills(merged, third.fills);
    return {
      fills: final,
      rejected: mergeRejected(rejected, third.rejected),
    };
  }

  return { fills: merged, rejected };
}
