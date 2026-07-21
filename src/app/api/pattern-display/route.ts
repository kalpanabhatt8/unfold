import { NextResponse } from "next/server";
import { generateDisplay } from "@/lib/ai/pattern-display/generate";
import { prepareDisplayInput } from "@/lib/ai/pattern-display/input";
import {
  isPatternName,
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
} from "@/lib/patterns/vocabulary";
import { requireUser } from "@/lib/server/auth";
import { requireAiUser } from "@/lib/server/ai-auth";

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    await requireAiUser();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  let patternName = "";
  let quotes: string[] = [];
  let evidenceKey = "";

  try {
    const body = (await request.json()) as {
      patternName?: unknown;
      quotes?: unknown;
      evidenceKey?: unknown;
    };
    patternName =
      typeof body.patternName === "string" ? body.patternName.trim() : "";
    evidenceKey =
      typeof body.evidenceKey === "string" ? body.evidenceKey.trim() : "";
    quotes = Array.isArray(body.quotes)
      ? body.quotes.filter((q): q is string => typeof q === "string")
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!isPatternName(patternName) || quotes.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const prepared = prepareDisplayInput({
    patternName,
    label: PATTERN_LABELS[patternName],
    definition: PATTERN_DEFINITIONS[patternName],
    quotes,
  });

  if (prepared.quotes.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ display: null });
  }

  try {
    const generated = await generateDisplay(apiKey, prepared);
    if (!generated) {
      return NextResponse.json({ display: null });
    }

    return NextResponse.json({
      display: {
        displayTitle: generated.displayTitle,
        summary: generated.summary,
        sourceEvidenceKey: evidenceKey,
        createdAt: Date.now(),
      },
    });
  } catch (error) {
    console.error("[pattern-display] route error", error);
    return NextResponse.json({ display: null });
  }
}
