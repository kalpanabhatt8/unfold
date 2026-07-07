import { NextResponse } from "next/server";
import { extractPatterns } from "@/lib/ai/pattern-extraction/generate";
import { fallbackExtraction } from "@/lib/ai/pattern-extraction/fallback";
import type { EntryAnalysisResult } from "@/lib/patterns/types";

/** Dev warm-up — compiles the route without calling Claude. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json<EntryAnalysisResult>(
      fallbackExtraction("no_api_key"),
    );
  }

  try {
    const result = await extractPatterns(apiKey, text);
    return NextResponse.json<EntryAnalysisResult>(result);
  } catch (error) {
    console.error("[pattern-extraction] route error", error);
    return NextResponse.json<EntryAnalysisResult>(
      fallbackExtraction("upstream_error"),
    );
  }
}
