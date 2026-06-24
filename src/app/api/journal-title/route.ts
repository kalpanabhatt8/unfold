import { NextResponse } from "next/server";
import {
  MAX_SEAL_TITLE_CHARS,
  MAX_SEAL_TITLE_WORDS,
  TITLE_INPUT_WORD_CAP,
  normalizeSealTitle,
  UNTITLED_ENTRY,
} from "@/lib/journal-title";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

function truncateForTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= TITLE_INPUT_WORD_CAP) return trimmed;
  return words.slice(-TITLE_INPUT_WORD_CAP).join(" ");
}

const buildPrompt = (text: string): string =>
  `Pick a 2–4 word title for this journal entry.
Use the writer's own words — raw emotional fragment, not a polished title.
Max ${MAX_SEAL_TITLE_CHARS} characters. No ending punctuation. Title only.

"""
${text}
"""`;

const callClaude = async (
  apiKey: string,
  text: string
): Promise<
  | { ok: true; rawText: string }
  | { ok: false; status: number; errText: string }
> => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 12,
      messages: [{ role: "user", content: buildPrompt(text) }],
    }),
  });

  if (res.ok) {
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const rawText = data.content?.[0]?.text?.trim() ?? "";
    return { ok: true, rawText };
  }

  const errText = await res.text();
  return { ok: false, status: res.status, errText };
};

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
    return NextResponse.json({ title: UNTITLED_ENTRY });
  }

  const excerpt = truncateForTitle(text);
  if (!excerpt) {
    return NextResponse.json({ title: UNTITLED_ENTRY });
  }

  try {
    const result = await callClaude(apiKey, excerpt);

    if (!result.ok) {
      console.error("Journal title API error", result.status, result.errText);
      return NextResponse.json({ title: UNTITLED_ENTRY });
    }

    if (!result.rawText) {
      return NextResponse.json({ title: UNTITLED_ENTRY });
    }

    const title = normalizeSealTitle(result.rawText);
    const wordCount = title.split(/\s+/).filter(Boolean).length;
    if (wordCount < 1 || wordCount > MAX_SEAL_TITLE_WORDS) {
      return NextResponse.json({ title: UNTITLED_ENTRY });
    }

    return NextResponse.json({ title });
  } catch (error) {
    console.error("Journal title route error", error);
    return NextResponse.json({ title: UNTITLED_ENTRY });
  }
}
