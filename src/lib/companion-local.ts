import { type CompanionEmotion } from "@/lib/companion-emotions";
import type {
  CompanionAnalysis,
  CompanionConfidence,
} from "@/lib/companion-analysis";

const LEXICONS: Record<Exclude<CompanionEmotion, "neutral">, string[]> = {
  love: [
    "love", "loved", "loving", "adore", "adored", "heart", "hearts",
    "cherish", "cherished", "devoted", "affection", "grateful", "gratitude",
    "thankful", "meant", "everything",
  ],
  sad: [
    "sad", "sadness", "grief", "grieving", "hurt", "hurting", "pain", "painful",
    "lonely", "loneliness", "lost", "miss", "missing", "cry", "crying", "cried",
    "tears", "heavy", "broken", "alone", "numb", "guilt", "guilty", "regret",
    "dark", "empty", "hopeless", "despair", "sorrow", "ache", "aching",
    "mourning", "devastated", "depressed", "down", "weeping", "heartbroken",
    "angry", "anger", "frustrated", "frustration", "hate", "bitter", "hard",
    "pretending", "wasn't", "isn't", "tired",
  ],
  confused: [
    "confused", "confusing", "confusion", "unsure", "uncertain", "unclear",
    "puzzled", "conflicted", "torn", "stuck", "questioning", "baffled",
    "unsettled", "doubting", "muddled", "indecisive", "anxious", "anxiety",
    "worried", "worry", "worrying", "nervous", "overthink", "overthinking",
    "spiral", "spiraling", "wrong", "scenarios",
  ],
  shocked: [
    "shocked", "shock", "surprise", "surprised", "surprising", "stunned",
    "startled", "unexpected", "unbelievable", "gasped", "astounded", "speechless",
    "wow", "whoa",
  ],
  excited: [
    "excited", "exciting", "thrilled", "thrilling", "pumped", "hyped",
    "ecstatic", "elated", "anticipation", "butterflies", "smiling",
  ],
  happy: [
    "happy", "happiness", "joy", "joyful", "proud", "glad", "celebrate",
    "blessed", "delight", "delighted", "amazing", "laughed", "light", "good",
  ],
};

const PRIORITY: Exclude<CompanionEmotion, "neutral">[] = [
  "love",
  "sad",
  "confused",
  "shocked",
  "excited",
  "happy",
];

const PHRASE_LOVE =
  /\b(grateful for|meant everything|people around me|so grateful)\b/i;
const PHRASE_HAPPY =
  /\b(genuinely good|good day|felt amazing|laughed a lot|feel light)\b/i;
const PHRASE_SAD =
  /\b(felt so hard|feeling empty|wasn't fine|isn't okay|couldn't shake|so tired of)\b/i;
const PHRASE_WORRY =
  /\b(what might go wrong|worst case|mind racing|could spiral|can't stop my mind)\b/i;
const PHRASE_STUCK =
  /\b(couldn't start|staring at|nothing happened|just couldn't)\b/i;
const PHRASE_EXCITED =
  /\b(smiling for no reason|might actually work out|something is happening)\b/i;
const PHRASE_NEUTRAL =
  /\b(nothing particularly good or bad|nothing particularly|okay\.|was okay)\b/i;

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const scoreTokens = (tokens: string[], lexicon: string[]): number => {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  let score = 0;
  for (const word of lexicon) {
    score += counts.get(word) ?? 0;
  }
  return score;
};

const scoreEmotion = (
  tokens: string[],
  emotion: Exclude<CompanionEmotion, "neutral">
): number => scoreTokens(tokens, LEXICONS[emotion]);

const pickBestEmotion = (
  tokens: string[]
): { emotion: CompanionEmotion; score: number } => {
  let bestEmotion: CompanionEmotion = "neutral";
  let bestScore = 0;
  for (const candidate of PRIORITY) {
    const candidateScore = scoreEmotion(tokens, candidate);
    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestEmotion = candidate;
    }
  }
  return { emotion: bestEmotion, score: bestScore };
};

/** Offline classification — expects delta text (new words since last react). */
export function detectCompanionAnalysis(text: string): CompanionAnalysis {
  const trimmed = text.trim();
  if (!trimmed) {
    return { emotion: "neutral", confidence: "low" };
  }

  const tokens = tokenize(trimmed);
  let emotion: CompanionEmotion = "neutral";
  let confidence: CompanionConfidence = "low";

  if (PHRASE_NEUTRAL.test(trimmed)) {
    emotion = "neutral";
    confidence = "low";
  } else if (PHRASE_LOVE.test(trimmed)) {
    emotion = "love";
    confidence = "high";
  } else if (PHRASE_EXCITED.test(trimmed)) {
    emotion = "excited";
    confidence = "high";
  } else if (PHRASE_WORRY.test(trimmed)) {
    emotion = "confused";
    confidence = "high";
  } else if (PHRASE_STUCK.test(trimmed)) {
    emotion = "confused";
    confidence = "high";
  } else if (PHRASE_SAD.test(trimmed)) {
    emotion = "sad";
    confidence = "high";
  } else if (PHRASE_HAPPY.test(trimmed)) {
    emotion = "happy";
    confidence = "high";
  } else {
    const best = pickBestEmotion(tokens);
    emotion = best.emotion;
    confidence = best.score >= 2 ? "high" : best.score >= 1 ? "low" : "low";
  }

  if (emotion === "neutral") {
    confidence = "low";
  }

  return { emotion, confidence };
}

/** @deprecated Use detectCompanionAnalysis */
export function detectCompanionEmotion(text: string): CompanionEmotion {
  return detectCompanionAnalysis(text).emotion;
}
