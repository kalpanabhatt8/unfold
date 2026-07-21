import { NextResponse } from "next/server";
import type { CrisisRiskResult } from "@/lib/ai/crisis-risk/constants";
import { classifyCrisisRisk } from "@/lib/ai/crisis-risk/generate";
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
    console.error("[crisis-risk] classify_failed", {
      reason: "no_api_key",
      at: Date.now(),
    });
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  try {
    const result = await classifyCrisisRisk(apiKey, text);
    // Return only the gate fields — never echo entry text.
    return NextResponse.json<CrisisRiskResult>({
      flagged: result.flagged,
      confidence: result.confidence,
    });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "crisis_route_error";
    console.error("[crisis-risk] classify_failed", {
      reason,
      at: Date.now(),
    });
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
