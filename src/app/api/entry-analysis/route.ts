import { NextResponse } from "next/server";
import {
  ANALYSIS_EMOTIONS,
  isAnalysisEmotion,
  isPatternName,
  MAX_EVIDENCE_PER_PATTERN,
  MAX_PATTERNS_PER_ENTRY,
  MAX_TOPICS_PER_ENTRY,
  PATTERN_CONFIDENCE_FLOOR,
  PATTERN_DEFINITIONS,
  PATTERN_NAMES,
} from "@/lib/patterns/vocabulary";
import type {
  AnalysisPayload,
  EntryAnalysisResult,
  PatternMatch,
} from "@/lib/patterns/types";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

/** Rough word cap; long entries are head+tail sampled to stay cheap. */
const INPUT_WORD_CAP = 1200;
const HEAD_WORDS = 300;
const TAIL_WORDS = 900;
const MAX_EVIDENCE_CHARS = 140;

/** Keep requests small: whole text if short, else head + tail with an elision. */
function capInputText(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= INPUT_WORD_CAP) return text.trim();
  const head = words.slice(0, HEAD_WORDS).join(" ");
  const tail = words.slice(-TAIL_WORDS).join(" ");
  return `${head}\n[…]\n${tail}`;
}

const patternListForPrompt = PATTERN_NAMES.map(
  (name) => `- ${name}: ${PATTERN_DEFINITIONS[name]}`,
).join("\n");

const buildPrompt = (text: string): string =>
  `You are Unfold's reflection analyst. You read ONE private journal entry and identify the recurring MENTAL PATTERNS in how the person is thinking — not the topics, not the events.

Return:
- emotion: the single dominant emotion.
- topics: 1–2 short things the entry is about.
- patterns: 0–3 mental patterns from the FIXED list below.

You are observing, not advising. Never give advice, reassurance, diagnosis, or therapy. Never infer beyond what the text supports.

MENTAL PATTERNS (use these names EXACTLY; never invent others):
${patternListForPrompt}

DISAMBIGUATION:
- self_doubt = uncertainty ("can I?"); self_criticism = harsh judgment ("I'm terrible").
- comparison ranks self against others; fear_of_judgment worries about being evaluated.
- overthinking loops without direction; catastrophizing escalates to a worst case.

EMOTION — choose exactly one:
${ANALYSIS_EMOTIONS.join(", ")}

RULES:
- If no pattern is clearly present, return an empty "patterns" array. Do NOT force a match.
- Only include a pattern if your confidence is ${PATTERN_CONFIDENCE_FLOOR} or higher.
- At most ${MAX_PATTERNS_PER_ENTRY} patterns, highest confidence first.
- evidence: 1–${MAX_EVIDENCE_PER_PATTERN} quotes copied VERBATIM from the entry (a phrase or sentence), for each pattern.
- topics: 1–${MAX_TOPICS_PER_ENTRY} short lowercase noun phrases (e.g. "career", "a friendship", "money").
- Output ONLY valid JSON in the exact schema below. No prose, no markdown, no code fences.

SCHEMA:
{
  "emotion": "<one emotion>",
  "topics": ["<topic>"],
  "patterns": [
    { "name": "<pattern_name>", "confidence": 0.0, "evidence": ["<verbatim quote>"] }
  ]
}

EXAMPLE 1
Entry:
"""
Another rejection. People my age are already leading teams and I'm still here. Maybe I'm just not good enough for this. I keep rewriting my resume but never actually send it.
"""
Output:
{"emotion":"anxious","topics":["career","job search"],"patterns":[{"name":"comparison","confidence":0.92,"evidence":["People my age are already leading teams and I'm still here"]},{"name":"self_doubt","confidence":0.86,"evidence":["Maybe I'm just not good enough for this"]},{"name":"avoidance","confidence":0.7,"evidence":["I keep rewriting my resume but never actually send it"]}]}

EXAMPLE 2 (no patterns)
Entry:
"""
Walked by the river after dinner. The air was cool and it smelled like rain. Felt good to just move for a while.
"""
Output:
{"emotion":"happy","topics":["evening walk"],"patterns":[]}

Now analyze this entry and respond with JSON only:
"""
${text}
"""`;

const callClaude = async (
  apiKey: string,
  text: string,
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
      max_tokens: 500,
      temperature: 0.2,
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

const stripFences = (raw: string): string =>
  raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

/** Extract the first balanced-looking JSON object. */
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

/**
 * Clean + validate the model output against the schema. Repairs where safe,
 * returns null only when structurally unusable. Evidence quotes must be
 * verbatim substrings of the analyzed text.
 */
function normalizePayload(raw: unknown, sourceText: string): AnalysisPayload | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.patterns)) return null;

  const emotion = isAnalysisEmotion(raw.emotion) ? raw.emotion : "neutral";

  const topics = Array.isArray(raw.topics)
    ? raw.topics
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, MAX_TOPICS_PER_ENTRY)
    : [];

  const lowerSource = sourceText.toLowerCase();
  const seen = new Set<string>();
  const patterns: PatternMatch[] = [];

  for (const item of raw.patterns) {
    if (!isRecord(item)) continue;
    if (!isPatternName(item.name) || seen.has(item.name)) continue;

    const confidence =
      typeof item.confidence === "number" && Number.isFinite(item.confidence)
        ? Math.min(1, Math.max(0, item.confidence))
        : 0;
    if (confidence < PATTERN_CONFIDENCE_FLOOR) continue;

    const evidence = Array.isArray(item.evidence)
      ? item.evidence
          .filter((q): q is string => typeof q === "string")
          .map((q) => q.trim())
          .filter((q) => q && lowerSource.includes(q.toLowerCase()))
          .map((q) => (q.length > MAX_EVIDENCE_CHARS ? q.slice(0, MAX_EVIDENCE_CHARS).trim() : q))
          .slice(0, MAX_EVIDENCE_PER_PATTERN)
      : [];

    // Evidence is required to surface a pattern — no quote, no pattern.
    if (evidence.length === 0) continue;

    seen.add(item.name);
    patterns.push({ name: item.name, confidence, evidence });
  }

  patterns.sort((a, b) => b.confidence - a.confidence);

  return {
    emotion,
    topics,
    patterns: patterns.slice(0, MAX_PATTERNS_PER_ENTRY),
  };
}

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
    return NextResponse.json<EntryAnalysisResult>({
      analysis: null,
      reason: "no_api_key",
    });
  }

  const capped = capInputText(text);

  try {
    const result = await callClaude(apiKey, capped);

    if (!result.ok) {
      console.error("Entry analysis API error", result.status, result.errText);
      return NextResponse.json<EntryAnalysisResult>({
        analysis: null,
        reason: "upstream_error",
      });
    }

    if (!result.rawText) {
      return NextResponse.json<EntryAnalysisResult>({
        analysis: null,
        reason: "empty_response",
      });
    }

    const parsed = extractJsonObject(result.rawText);
    const payload = normalizePayload(parsed, capped);

    if (!payload) {
      console.warn("Entry analysis invalid output", result.rawText.slice(0, 300));
      return NextResponse.json<EntryAnalysisResult>({
        analysis: null,
        reason: "invalid_output",
      });
    }

    return NextResponse.json<EntryAnalysisResult>({ analysis: payload });
  } catch (error) {
    console.error("Entry analysis route error", error);
    return NextResponse.json<EntryAnalysisResult>({
      analysis: null,
      reason: "upstream_error",
    });
  }
}
