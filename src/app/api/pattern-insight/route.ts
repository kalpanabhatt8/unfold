import { NextResponse } from "next/server";
import { generateReflection } from "@/lib/ai/pattern-reflection/generate";
import { prepareReflectionInput } from "@/lib/ai/pattern-reflection/input";
import {
  isPatternName,
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
} from "@/lib/patterns/vocabulary";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let patternName = "";
  let quotes: string[] = [];
  let topics: string[] = [];

  try {
    const body = (await request.json()) as {
      patternName?: unknown;
      quotes?: unknown;
      topics?: unknown;
    };
    patternName =
      typeof body.patternName === "string" ? body.patternName.trim() : "";
    quotes = Array.isArray(body.quotes)
      ? body.quotes.filter((q): q is string => typeof q === "string")
      : [];
    topics = Array.isArray(body.topics)
      ? body.topics.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!isPatternName(patternName)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const prepared = prepareReflectionInput({
    patternName,
    label: PATTERN_LABELS[patternName],
    definition: PATTERN_DEFINITIONS[patternName],
    quotes,
    topics,
  });

  if (prepared.quotes.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ insight: null });
  }

  try {
    const insight = await generateReflection(apiKey, prepared);
    return NextResponse.json({ insight });
  } catch (error) {
    console.error("[pattern-reflection] route error", error);
    return NextResponse.json({ insight: null });
  }
}
