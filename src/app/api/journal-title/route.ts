import { NextResponse } from "next/server";
import { generateTitle } from "@/lib/ai/title/generate";
import {
  fallbackTitle,
  hasMeaningfulContentForTitle,
} from "@/lib/ai/title/fallback";
import { UNTITLED_ENTRY } from "@/lib/ai/title/constants";
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
    return NextResponse.json({
      title: hasMeaningfulContentForTitle(text)
        ? fallbackTitle(text)
        : UNTITLED_ENTRY,
    });
  }

  try {
    const title = await generateTitle(apiKey, text);
    return NextResponse.json({ title });
  } catch (error) {
    console.error("[title] route error", error);
    return NextResponse.json({
      title: hasMeaningfulContentForTitle(text)
        ? fallbackTitle(text)
        : UNTITLED_ENTRY,
    });
  }
}
