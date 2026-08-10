import { NextResponse } from "next/server";
import { extractPatterns } from "@/lib/ai/pattern-extraction/generate";
import { fallbackExtraction } from "@/lib/ai/pattern-extraction/fallback";
import { canUsePatternPipelineDebug } from "@/lib/patterns/pattern-pipeline-debug-access";
import type { EntryAnalysisResult } from "@/lib/patterns/types";
import { requireUser } from "@/lib/server/auth";
import { requireAiUser } from "@/lib/server/ai-auth";

/** Dev warm-up - compiles the route without calling Claude. */
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
  let userId: string;
  try {
    userId = await requireAiUser();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  let text = "";
  let wantDebug = false;
  try {
    const body = (await request.json()) as { text?: unknown; debug?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
    // TEMPORARY — debug tool only; product clients omit this flag.
    // Even if the client asks, production / non-allowlisted users never get `_debug`.
    wantDebug = body.debug === true && canUsePatternPipelineDebug(userId);
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
    if (wantDebug) {
      return NextResponse.json(result);
    }
    // Product path: strip temporary `_debug` so behavior matches pre-tool.
    const { _debug: _ignored, ...product } = result;
    void _ignored;
    return NextResponse.json<EntryAnalysisResult>(product);
  } catch (error) {
    console.error("[pattern-extraction] route error", error);
    return NextResponse.json<EntryAnalysisResult>(
      fallbackExtraction("upstream_error"),
    );
  }
}
