import { NextResponse } from "next/server";
import {
  COMPANION_EMOTIONS,
  normalizeCompanionEmotion,
} from "@/lib/companion-emotions";
import { keywordFallback } from "@/lib/companion-local";
import { logCompanionServer } from "@/lib/companion-debug";

type CompanionEmotion = (typeof COMPANION_EMOTIONS)[number];
type CompanionConfidence = "high" | "medium" | "low";

type FallbackReason =
  | "no_api_key"
  | "claude_http_error"
  | "claude_empty_response"
  | "claude_parse_failed"
  | "claude_exception";

type CompanionApiResponse = {
  emotion: CompanionEmotion;
  confidence: CompanionConfidence;
  _debug?: {
    source: "claude" | "unavailable";
    rawClaude?: string;
    fallbackReason?: FallbackReason;
    claudeStatus?: number;
  };
};

const UNAVAILABLE_ANALYSIS: CompanionApiResponse = {
  emotion: "neutral",
  confidence: "low",
};

const withDevDebug = (
  payload: CompanionApiResponse,
  source: "claude" | "unavailable",
  extra?: Partial<NonNullable<CompanionApiResponse["_debug"]>>
): CompanionApiResponse => {
  if (process.env.NODE_ENV !== "development") return payload;
  return { ...payload, _debug: { source, ...extra } };
};

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const isCompanionConfidenceValue = (v: unknown): v is CompanionConfidence =>
  v === "high" || v === "medium" || v === "low";

const buildPrompt = (text: string): string =>
  `You are classifying the emotional tone of a private journal entry.

Classify the text into exactly ONE of these 9 emotions:
love, excited, neutral, happy, sad, anxious, tired, confused, shocked

Emotion definitions:
- love: warmth, affection, emotional closeness, tenderness, care
- excited: high-energy anticipation, thrill, eagerness, hype
- neutral: emotionally flat, purely descriptive/factual writing — use ONLY when no meaningful emotion exists
- happy: joy, pleasant mood, gratitude, contentment, pride, accomplishment, confidence
- sad: loneliness, grief, disappointment, heaviness, emotional pain
- anxious: worry, nervousness, overthinking, unease, fear of future
- tired: low energy, fatigue, mentally or physically tired, exhaustion
- confused: mental fog, uncertainty, disorientation, internal conflict, not understanding thoughts/feelings
- shocked: surprise, disbelief, sudden emotional impact

Rules:
- Return exactly ONE emotion from the list above
- Prefer nuanced emotional classification over neutral
- If text contains multiple emotions, choose the dominant one
- Detect subtle moods — journal writing often has low-intensity emotional states
- Do NOT default to neutral unless the text is truly emotionally flat
- Map pride, accomplishment, confidence, or smart to happy

Respond with ONLY this JSON (no explanation, no markdown):
{"emotion": "<emotion>", "confidence": "<high|medium|low>"}

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
      max_tokens: 60,
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

const stripMarkdownFences = (raw: string): string =>
  raw
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();

const isAllowedClassifierEmotion = (
  emotion: CompanionEmotion | null
): emotion is CompanionEmotion =>
  emotion !== null &&
  (COMPANION_EMOTIONS as readonly string[]).includes(emotion);

const parseClaudeResponse = (
  raw: string
): { emotion: CompanionEmotion; confidence: CompanionConfidence } | null => {
  const cleaned = stripMarkdownFences(raw);

  try {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
      const emotion = normalizeCompanionEmotion(
        typeof parsed.emotion === "string"
          ? parsed.emotion.toLowerCase()
          : parsed.emotion
      );
      if (isAllowedClassifierEmotion(emotion)) {
        const confidence = isCompanionConfidenceValue(parsed.confidence)
          ? parsed.confidence
          : "medium";
        return { emotion, confidence };
      }
    }
  } catch {
    // fall through to word scan
  }

  const lower = cleaned.toLowerCase();
  const direct = normalizeCompanionEmotion(lower.trim());
  if (isAllowedClassifierEmotion(direct)) {
    return { emotion: direct, confidence: "medium" };
  }
  for (const word of lower.split(/\s+/)) {
    const found = normalizeCompanionEmotion(word);
    if (isAllowedClassifierEmotion(found)) {
      return { emotion: found, confidence: "medium" };
    }
  }
  return null;
};

const unavailableResponse = (
  text: string,
  reason: FallbackReason,
  extra?: Partial<NonNullable<CompanionApiResponse["_debug"]>>
) => {
  logCompanionServer(text, reason, UNAVAILABLE_ANALYSIS, "unavailable");
  console.warn(`[🌻 claude] ⚠️ unavailable | reason: ${reason} | chars: ${text.length}`);
  return NextResponse.json(
    withDevDebug(UNAVAILABLE_ANALYSIS, "unavailable", {
      fallbackReason: reason,
      ...extra,
    })
  );
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
    return unavailableResponse(text, "no_api_key");
  }

  try {
    const result = await callClaude(apiKey, text);

    if (!result.ok) {
      console.error("Claude API error", result.status, result.errText);
      return unavailableResponse(text, "claude_http_error", {
        rawClaude: result.errText.slice(0, 500),
        claudeStatus: result.status,
      });
    }

    if (!result.rawText) {
      return unavailableResponse(text, "claude_empty_response");
    }

    const claudeParsed = parseClaudeResponse(result.rawText);
    if (!claudeParsed) {
      const fallback = keywordFallback(text);
      logCompanionServer(text, result.rawText, fallback, "claude");
      console.warn(
        `[🌻 claude] 🔤 invalid/unparseable → keyword: "${fallback.emotion}" | raw: "${result.rawText}"`
      );
      return NextResponse.json(
        withDevDebug(fallback, "claude", { rawClaude: result.rawText })
      );
    }

    const parsed = { emotion: claudeParsed.emotion, confidence: claudeParsed.confidence };
    logCompanionServer(text, result.rawText, parsed, "claude");
    console.log(
      `[🌻 claude] ✅ emotion: "${claudeParsed.emotion}" | confidence: "${claudeParsed.confidence}" | raw: "${result.rawText}" | chars: ${text.length}`
    );
    return NextResponse.json(
      withDevDebug(parsed, "claude", { rawClaude: result.rawText })
    );
  } catch (error) {
    console.error("Companion route error", error);
    return unavailableResponse(text, "claude_exception", {
      rawClaude: String(error).slice(0, 500),
    });
  }
}
