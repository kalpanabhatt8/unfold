import { NextResponse } from "next/server";
import type { ContentQualityResult } from "@/lib/ai/content-quality/constants";
import { classifyContentQuality } from "@/lib/ai/content-quality/generate";
import { requireUser } from "@/lib/server/auth";
import { requireAiUser } from "@/lib/server/ai-auth";

/** Dev warm-up — compiles the route without calling Claude. */
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
    console.error("[content-quality] classify_failed", {
      reason: "no_api_key",
      at: Date.now(),
    });
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  try {
    const result = await classifyContentQuality(apiKey, text);
    // Return only the gate fields — never echo entry text.
    return NextResponse.json<ContentQualityResult>({
      flagged: result.flagged,
      confidence: result.confidence,
    });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "quality_route_error";
    console.error("[content-quality] classify_failed", {
      reason,
      at: Date.now(),
    });
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
