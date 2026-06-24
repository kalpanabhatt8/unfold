import { NextResponse } from "next/server";
import {
  MAX_SEAL_WHISPER_WORDS,
  normalizeSealWhisper,
} from "@/lib/journal-whisper";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const buildPrompt = (text: string): string =>
  `You are a quiet, warm companion reading someone's private journal entry.

They just finished writing and sealed it.
Read everything they wrote and respond with ONE short reaction — 2 to 5 words maximum.

Rules:
- Never say: 'I hear you', 'That sounds hard', 'You've got this', 'It's okay', 'Stay strong', 'Thank you for sharing', 'I'm proud of you'
- Never give advice or suggestions
- Never ask questions
- Never console like a therapist or chatbot
- Never be generic or empty

Instead: say something specific and human.
Something that shows you actually read it.
Something a real friend might whisper.

Examples of good responses:
* that was… kinda heavy, huh.
* you caught that. nice.
* okay, that coffee moment? it stayed.
* that last line though.
* yeah…(context) that mattered.
* sounds like that was enough today.
* not gonna lie, that felt real.
* hmm. that hit.
* okay, i see you.
* that shift? subtle, but real.
* you were honest there. respect.
* lowkey proud of you for that.
* that felt grounding.
* you made it through today.

Examples of bad responses (never use):
'I hear you and I care.'
'You are so strong.'
'Thank you for sharing this.'
'It sounds like you had a tough day.'
'Remember to be kind to yourself.'

Return only the whisper text.
No punctuation at the end unless it changes the meaning.
All lowercase.
2 to 5 words only.
Nothing else.

Journal entry: ${text}`;

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
      max_tokens: 24,
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
    return NextResponse.json({ whisper: null });
  }

  if (!text) {
    return NextResponse.json({ whisper: null });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ whisper: null });
  }

  try {
    const result = await callClaude(apiKey, text);

    if (!result.ok) {
      console.error("Journal whisper API error", result.status, result.errText);
      return NextResponse.json({ whisper: null });
    }

    if (!result.rawText) {
      return NextResponse.json({ whisper: null });
    }

    const whisper = normalizeSealWhisper(result.rawText);
    if (!whisper) {
      return NextResponse.json({ whisper: null });
    }

    const wordCount = whisper.split(/\s+/).filter(Boolean).length;
    if (wordCount > MAX_SEAL_WHISPER_WORDS) {
      return NextResponse.json({ whisper: null });
    }

    return NextResponse.json({ whisper });
  } catch (error) {
    console.error("Journal whisper route error", error);
    return NextResponse.json({ whisper: null });
  }
}
