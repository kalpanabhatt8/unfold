import { NextResponse } from "next/server";
import {
  isPatternName,
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
} from "@/lib/patterns/vocabulary";
import type { PatternInsight } from "@/lib/patterns/types";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const MAX_QUOTES = 8;
const MAX_QUOTE_CHARS = 160;

const buildPrompt = (
  patternName: string,
  label: string,
  definition: string,
  quotes: string[],
  topics: string[],
): string =>
  `You read evidence from several private journal entries where the same mental pattern appeared. Write two short insights grounded ONLY in the quotes and topics below — nothing invented.

Pattern: ${patternName} (${label})
Definition: ${definition}

Evidence quotes (verbatim snippets from different entries):
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Topics across those entries: ${topics.length > 0 ? topics.join(", ") : "(none listed)"}

Return:
1. observation — ONE sentence, second person ("You…"), describing the SPECIFIC way this pattern shows up in THESE entries. Not a label, not advice, not therapy. Must be something the writer might not have named themselves. Max ~90 characters if possible.
2. commonThread — ONE sentence starting with "Each one" or "All of them" that states what these specific entries have in common regarding this pattern. Grounded in the quotes. No advice.

Output ONLY valid JSON:
{"observation":"<sentence>","commonThread":"<sentence>"}`;

const callClaude = async (
  apiKey: string,
  prompt: string,
): Promise<
  { ok: true; rawText: string } | { ok: false; status: number; errText: string }
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
      max_tokens: 200,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (res.ok) {
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return { ok: true, rawText: data.content?.[0]?.text?.trim() ?? "" };
  }

  return { ok: false, status: res.status, errText: await res.text() };
};

const stripFences = (raw: string): string =>
  raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

const extractJsonObject = (raw: string): unknown | null => {
  const cleaned = stripFences(raw);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const normalizeInsight = (raw: unknown): PatternInsight | null => {
  if (!isRecord(raw)) return null;
  const observation =
    typeof raw.observation === "string" ? raw.observation.trim() : "";
  const commonThread =
    typeof raw.commonThread === "string" ? raw.commonThread.trim() : "";
  if (!observation || !commonThread) return null;
  return { observation, commonThread };
};

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let patternName = "";
  let quotes: string[] = [];
  let topics: string[] = [];

  try {
    const body = (await request.json()) as {
      patternName?: unknown;
      quotes?: unknown;
      topics?: unknown;
    };
    patternName =
      typeof body.patternName === "string" ? body.patternName.trim() : "";
    quotes = Array.isArray(body.quotes)
      ? body.quotes
          .filter((q): q is string => typeof q === "string")
          .map((q) => q.trim())
          .filter(Boolean)
          .map((q) =>
            q.length > MAX_QUOTE_CHARS ? q.slice(0, MAX_QUOTE_CHARS).trim() : q,
          )
          .slice(0, MAX_QUOTES)
      : [];
    topics = Array.isArray(body.topics)
      ? body.topics
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!isPatternName(patternName) || quotes.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ insight: null });
  }

  const prompt = buildPrompt(
    patternName,
    PATTERN_LABELS[patternName],
    PATTERN_DEFINITIONS[patternName],
    quotes,
    topics,
  );

  try {
    const result = await callClaude(apiKey, prompt);
    if (!result.ok) {
      console.error("Pattern insight API error", result.status, result.errText);
      return NextResponse.json({ insight: null });
    }

    const parsed = extractJsonObject(result.rawText);
    const insight = normalizeInsight(parsed);
    if (!insight) {
      console.warn("Pattern insight invalid output", result.rawText.slice(0, 200));
      return NextResponse.json({ insight: null });
    }

    return NextResponse.json({ insight });
  } catch (error) {
    console.error("Pattern insight route error", error);
    return NextResponse.json({ insight: null });
  }
}
