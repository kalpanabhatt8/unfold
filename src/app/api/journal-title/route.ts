import { NextResponse } from "next/server";
import {
  MAX_SEAL_TITLE_WORDS,
  normalizeSealTitle,
  UNTITLED_ENTRY,
} from "@/lib/journal-title";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const buildPrompt = (text: string): string =>
  `You name private journal entries for a personal diary app.

Read the full entry and identify what it is really about — the core feeling or tension underneath.

Then write a short title (2–5 words) in the user's own inner voice: natural, raw, and emotionally honest. Not poetic. Not inspirational. Not a keyword summary.

Rules:
- 2–5 words only
- Sound like something the writer might actually think or say to themselves
- Plain, direct language — no literary flourishes or self-help tone
- Do NOT use metaphor-heavy words: light, rise, journey, healing, growth, warrior, bloom, unfold, etc.
- Do NOT lift or paraphrase the opening sentence unless those exact words are the true heart of the entry
- Avoid generic diary phrases ("I feel sad", "today felt heavy", "I can do")
- No punctuation at the end
- No quotes around the title
- Title case is fine but not required

Good titles: I Refuse to Shrink · No Longer Small · Still Not Over It
Bad titles: Finding My Light · The Healing Journey · I Can Do · Today Felt Heavy

Respond with ONLY the title text — nothing else.

Journal entry:
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
      max_tokens: 32,
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

  try {
    const result = await callClaude(apiKey, text);

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
