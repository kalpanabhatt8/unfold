import { NextResponse } from "next/server";
import { generateSlotFills } from "@/lib/ai/pattern-slots/generate";
import type { PriorVoiceSlot, VoiceSlotRequest } from "@/lib/ai/pattern-slots/input";
import {
  isPatternName,
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
} from "@/lib/patterns/vocabulary";
import {
  SLOT_MAX_QUOTE_CHARS,
  SLOT_MAX_QUOTES,
} from "@/lib/ai/pattern-slots/constants";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let patternName = "";
  let quotes: string[] = [];
  let voiceSlots: VoiceSlotRequest[] = [];
  let shapeId = "";
  let priorVoice: PriorVoiceSlot[] = [];

  try {
    const body = (await request.json()) as {
      patternName?: unknown;
      quotes?: unknown;
      voiceSlots?: unknown;
      shapeId?: unknown;
      priorVoice?: unknown;
    };
    patternName =
      typeof body.patternName === "string" ? body.patternName.trim() : "";
    shapeId = typeof body.shapeId === "string" ? body.shapeId : "";
    quotes = Array.isArray(body.quotes)
      ? body.quotes.filter((q): q is string => typeof q === "string")
      : [];
    voiceSlots = Array.isArray(body.voiceSlots)
      ? body.voiceSlots.filter(
          (s): s is VoiceSlotRequest =>
            typeof s === "object" &&
            s !== null &&
            typeof (s as VoiceSlotRequest).index === "number" &&
            typeof (s as VoiceSlotRequest).kind === "string",
        )
      : [];
    priorVoice = Array.isArray(body.priorVoice)
      ? body.priorVoice.filter(
          (p): p is PriorVoiceSlot =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as PriorVoiceSlot).index === "number" &&
            typeof (p as PriorVoiceSlot).role === "string" &&
            typeof (p as PriorVoiceSlot).text === "string",
        )
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!isPatternName(patternName) || quotes.length === 0 || voiceSlots.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const sanitizedQuotes = quotes
    .map((q) => q.trim())
    .filter(Boolean)
    .map((q) =>
      q.length > SLOT_MAX_QUOTE_CHARS
        ? q.slice(0, SLOT_MAX_QUOTE_CHARS).trim()
        : q,
    )
    .slice(0, SLOT_MAX_QUOTES);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ fills: [] });
  }

  try {
    const result = await generateSlotFills(apiKey, {
      patternName,
      label: PATTERN_LABELS[patternName],
      definition: PATTERN_DEFINITIONS[patternName],
      quotes: sanitizedQuotes,
      voiceSlots,
      shapeId,
      priorVoice,
    });
    return NextResponse.json({
      fills: result.fills,
      rejected: result.rejected,
    });
  } catch (error) {
    console.error("[pattern-slots] route error", error);
    return NextResponse.json({ fills: [] });
  }
}
