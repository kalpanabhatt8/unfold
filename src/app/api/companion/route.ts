import { NextResponse } from "next/server";

// Kept in sync with COMPANION_EMOTIONS in @/lib/companion-ai. Duplicated here
// (not imported) so this server route never pulls the client-only companion
// module into the server bundle.
export type CompanionEmotion =
  | "heavy"
  | "anxious"
  | "angry"
  | "confused"
  | "tired"
  | "happy"
  | "calm"
  | "neutral";

type CompanionApiResponse = {
  emotion: CompanionEmotion;
  line: string;
};

const EMOTIONS: CompanionEmotion[] = [
  "heavy",
  "anxious",
  "angry",
  "confused",
  "tired",
  "happy",
  "calm",
  "neutral",
];

/** Fast Gemini model — overridable via GEMINI_MODEL (e.g. gemini-3.5-flash). */
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

const parseGeminiJson = (raw: string): CompanionApiResponse | null => {
  // Be forgiving: strip markdown fences and grab the first {...} block, so a
  // stray preamble ("Here is the JSON:") or code fence doesn't break parsing.
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    const parsed = JSON.parse(candidate) as Partial<CompanionApiResponse>;
    if (
      parsed.emotion &&
      EMOTIONS.includes(parsed.emotion) &&
      typeof parsed.line === "string" &&
      parsed.line.trim()
    ) {
      return { emotion: parsed.emotion, line: parsed.line.trim().slice(0, 120) };
    }
  } catch {
    /* fall through */
  }
  return null;
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Companion unavailable" },
      { status: 503 }
    );
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

  const prompt = `You are a quiet sunflower companion watching someone journal privately.
Read their writing and respond with JSON only — no markdown, no extra keys.

Rules:
- Classify the overall emotional tone as exactly one of: heavy, anxious, angry, confused, tired, happy, calm, neutral
- "heavy"    = grief, sadness, loss, loneliness, weight
- "anxious"  = worry, fear, nervousness, feeling overwhelmed
- "angry"    = anger, frustration, resentment, feeling wronged
- "confused" = uncertainty, feeling torn, stuck, or unclear
- "tired"    = exhaustion, depletion, burnout, low energy
- "happy"    = joy, gratitude, excitement, lightness, celebration
- "calm"     = peace, ease, contentment, steadiness
- "neutral"  = everyday reflection or mixed tone with no clear emotion
- Pick the single most dominant tone. When genuinely unclear, use "neutral".
- Write one short warm line (max 12 words) that notices what they wrote
- Do NOT give advice, ask questions, or start a conversation
- Do NOT mention being AI or a sunflower
- Sound like a gentle friend in the room — observational, not therapeutic

Respond with this exact JSON shape:
{"emotion":"<one of the eight>","line":"your warm line here"}

Journal entry:
"""
${text.slice(0, 8000)}
"""`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            // Headroom for the model's reply. 2.5-flash counts "thinking"
            // tokens against this budget, so keep it comfortably above the
            // tiny JSON we need.
            maxOutputTokens: 256,
            responseMimeType: "application/json",
            // No reasoning needed for a one-shot tone classification — disable
            // thinking so the budget isn't eaten before the JSON is emitted.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      console.error("Gemini API error", await geminiRes.text());
      return NextResponse.json(
        { error: "Companion unavailable" },
        { status: 502 }
      );
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const rawText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    const parsed = parseGeminiJson(rawText);

    if (!parsed) {
      console.error("Gemini parse failed", rawText);
      return NextResponse.json(
        { error: "Invalid companion response" },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Companion route error", error);
    return NextResponse.json(
      { error: "Companion unavailable" },
      { status: 502 }
    );
  }
}
