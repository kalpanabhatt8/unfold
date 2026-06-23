/**
 * Client-side keyword fallback — used when Claude is unreachable or times out.
 * Scans the canvas text for signal words and returns a best-guess emotion.
 * Never throws, never shows errors to the user.
 */

import type { CompanionAnalysis } from "@/lib/companion-analysis";
import type { CompanionEmotion } from "@/lib/companion-emotions";

type KeywordEntry = { emotion: CompanionEmotion; keywords: readonly string[] };

const KEYWORD_MAP: readonly KeywordEntry[] = [
  { emotion: "sad",      keywords: ["sad", "crying", "cry", "lost", "alone", "lonely", "empty", "heavy", "grief", "hurt", "miss", "heartbreak"] },
  { emotion: "anxious",  keywords: ["worried", "worry", "scared", "fear", "panic", "stress", "stressed", "anxious", "anxiety", "nervous", "overwhelm"] },
  { emotion: "sad",      keywords: ["angry", "anger", "frustrated", "frustrat", "upset", "furious", "rage"] },
  { emotion: "confused", keywords: ["unsure", "stuck", "unclear", "confused", "don't know", "idk", "lost track"] },
  { emotion: "tired",    keywords: ["exhausted", "drained", "tired", "fatigue", "burnout", "sleepy", "low energy", "no energy", "can't function", "shutting down", "brain fog", "completely drained", "falling asleep", "passing out"] },
  { emotion: "shocked",  keywords: ["shocked", "can't believe", "unbelievable", "no way", "what the", "surprised", "jaw drop"] },
  { emotion: "happy",    keywords: ["happy", "joy", "joyful", "smile", "smiling", "good day", "felt good", "proud", "relieved", "accomplished", "confident", "realized", "finally understand", "figured out", "aha", "clicked", "makes sense now", "insight"] },
  { emotion: "excited",  keywords: ["excited", "thrilled", "amazing", "can't wait", "hyped", "pumped", "stoked", "omg"] },
  { emotion: "love",     keywords: ["love", "grateful", "gratitude", "thankful", "appreciate", "care", "warmth", "cherish", "blessed"] },
];

/** Aggregate keyword hit counts per emotion. */
function countMatches(lower: string): Map<CompanionEmotion, number> {
  const counts = new Map<CompanionEmotion, number>();
  for (const { emotion, keywords } of KEYWORD_MAP) {
    const hits = keywords.filter((kw) => lower.includes(kw)).length;
    if (hits > 0) {
      counts.set(emotion, (counts.get(emotion) ?? 0) + hits);
    }
  }
  return counts;
}

/**
 * Returns a best-guess CompanionAnalysis from keyword scanning.
 * Confidence is "high" when keywords match; otherwise "low" (preserves current face
 * unless deletion re-classify bypasses the gate).
 */
export function keywordFallback(text: string): CompanionAnalysis {
  const lower = text.toLowerCase();
  const counts = countMatches(lower);

  let bestEmotion: CompanionEmotion = "neutral";
  let bestCount = 0;

  for (const [emotion, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestEmotion = emotion;
    }
  }

  console.log(
    `[🌻 fallback] 🔤 keyword scan | best: "${bestEmotion}" | hits: ${bestCount} | confidence: "${bestCount > 0 ? "high" : "low"}"`
  );

  return {
    emotion: bestEmotion,
    confidence: bestCount > 0 ? "high" : "low",
  };
}
