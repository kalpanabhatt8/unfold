import { NextResponse } from "next/server";
import {
  COMPANION_EMOTIONS,
  normalizeCompanionEmotion,
} from "@/lib/companion-emotions";
import { detectCompanionAnalysis } from "@/lib/companion-local";
import { logCompanionServer } from "@/lib/companion-debug";

type CompanionEmotion = (typeof COMPANION_EMOTIONS)[number];
type CompanionConfidence = "high" | "low";

type FallbackReason =
  | "no_api_key"
  | "gemini_http_error"
  | "gemini_quota_exceeded"
  | "gemini_empty_response"
  | "gemini_parse_failed"
  | "gemini_exception"
  | "force_local";

type CompanionApiResponse = {
  emotion: CompanionEmotion;
  confidence: CompanionConfidence;
  _debug?: {
    source: "gemini" | "local" | "api_fallback";
    rawGemini?: string;
    fallbackReason?: FallbackReason;
    geminiStatus?: number;
  };
};

const withDevDebug = (
  payload: CompanionApiResponse,
  source: "gemini" | "local" | "api_fallback",
  extra?: Partial<NonNullable<CompanionApiResponse["_debug"]>>
): CompanionApiResponse => {
  if (process.env.NODE_ENV !== "development") return payload;
  return {
    ...payload,
    _debug: { source, ...extra },
  };
};

/** Fast Gemini model — overridable via GEMINI_MODEL (e.g. gemini-2.5-flash). */
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

const EMOTION_LIST = COMPANION_EMOTIONS.join(", ");

const parseGeminiJson = (raw: string): CompanionApiResponse | null => {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate =
    start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    const parsed = JSON.parse(candidate) as Partial<CompanionApiResponse>;
    const emotion = normalizeCompanionEmotion(parsed.emotion);
    if (
      emotion &&
      (parsed.confidence === "high" || parsed.confidence === "low")
    ) {
      return {
        emotion,
        confidence: parsed.confidence,
      };
    }
  } catch {
    /* fall through */
  }
  return null;
};

const buildPrompt = (text: string, scope: "delta" | "full" = "delta"): string => {
  const scopeNote =
    scope === "delta"
      ? `This is ONLY the newest writing since the last pause — NOT the full journal.
Classify the emotional tone of THIS CHUNK alone. Ignore any prior paragraphs the user may have written earlier in the session.`
      : `Read the FULL excerpt before classifying — weight the MOST RECENT sentences heavily when the tone shifts.`;

  return `You are classifying the emotional tone of a private journal excerpt.
${scopeNote}
Respond with JSON only — no markdown, no extra keys.

Classify as exactly one of: ${EMOTION_LIST}

Definitions:
- "neutral"  = everyday reflection with no clear emotional tone
- "happy"    = settled joy, gratitude, warmth, contentment
- "excited"  = giddy anticipation, restless positive energy, butterflies
- "love"     = affection, warmth toward someone/something, feeling loved or loving
- "sad"      = grief, loss, loneliness, hurt, frustration, emotional weight
- "confused" = uncertainty, stuck, worry, unable to start, unclear
- "shocked"  = surprise, disbelief, sudden realization

Rules:
- Classify THIS excerpt only — do not infer tone from text not shown
- Prefer "neutral" with confidence "low" when the tone is ambiguous or flat
- Do NOT default to "happy" or "confused" — pick the clearest single tone in this chunk

Confidence:
- "high" = one clear dominant tone across the full excerpt
- "low"  = mixed, ambiguous, or too little signal

Examples:
- "I keep thinking about what might go wrong." → {"emotion":"confused","confidence":"high"}
- "Something is happening and I can't stop thinking about it. I keep smiling." → {"emotion":"excited","confidence":"high"}
- "Today was good. I finished something and laughed with a friend." → {"emotion":"happy","confidence":"high"}
- "I miss her so much. Everything feels heavy." → {"emotion":"sad","confidence":"high"}
- "I wrote some notes about my day." → {"emotion":"neutral","confidence":"low"}

Respond with JSON only:
{"emotion":"<one of the seven>","confidence":"high"|"low"}

Journal excerpt (${scope === "delta" ? "new chunk since last pause" : "full"}):
"""
${text.slice(0, 8000)}
"""`;
};

const fallbackResponse = (
  text: string,
  reason: FallbackReason,
  extra?: Partial<NonNullable<CompanionApiResponse["_debug"]>>
) => {
  const local = detectCompanionAnalysis(text);
  logCompanionServer(text, reason, local, "api_fallback");
  return NextResponse.json(
    withDevDebug(local, "api_fallback", { fallbackReason: reason, ...extra })
  );
};

/** Dev warm-up — compiles the route without calling Gemini. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let text = "";
  let scope: "delta" | "full" = "delta";
  try {
    const body = (await request.json()) as {
      text?: unknown;
      scope?: unknown;
    };
    text = typeof body.text === "string" ? body.text.trim() : "";
    scope = body.scope === "full" ? "full" : "delta";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  if (process.env.COMPANION_FORCE_LOCAL === "true") {
    const local = detectCompanionAnalysis(text);
    logCompanionServer(text, "force_local", local, "local");
    return NextResponse.json(
      withDevDebug(local, "local", { fallbackReason: "force_local" })
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const local = detectCompanionAnalysis(text);
    logCompanionServer(text, "no_api_key", local, "local");
    return NextResponse.json(
      withDevDebug(local, "local", { fallbackReason: "no_api_key" })
    );
  }

  const prompt = buildPrompt(text, scope);

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 128,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error", geminiRes.status, errText);
      const reason: FallbackReason =
        geminiRes.status === 429 ? "gemini_quota_exceeded" : "gemini_http_error";
      return fallbackResponse(text, reason, {
        rawGemini: errText.slice(0, 500),
        geminiStatus: geminiRes.status,
      });
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const rawText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (!rawText) {
      console.error("Gemini empty response", JSON.stringify(geminiData));
      return fallbackResponse(text, "gemini_empty_response");
    }

    const parsed = parseGeminiJson(rawText);

    if (!parsed) {
      console.error("Gemini parse failed", rawText);
      return fallbackResponse(text, "gemini_parse_failed", { rawGemini: rawText });
    }

    logCompanionServer(text, rawText, parsed, "gemini");
    return NextResponse.json(withDevDebug(parsed, "gemini", { rawGemini: rawText }));
  } catch (error) {
    console.error("Companion route error", error);
    return fallbackResponse(text, "gemini_exception", {
      rawGemini: String(error).slice(0, 500),
    });
  }
};
