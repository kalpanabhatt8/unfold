import { COMPANION_EMOTIONS, type CompanionEmotion } from "@/lib/companion-ai";

const LEXICONS: Record<Exclude<CompanionEmotion, "neutral">, string[]> = {
  heavy: [
    "sad", "sadness", "grief", "grieving", "hurt", "hurting", "pain", "painful",
    "lonely", "loneliness", "lost", "miss", "missing", "cry", "crying", "cried",
    "tears", "heavy", "broken", "alone", "numb", "guilt", "guilty", "regret",
    "dark", "empty", "hopeless", "despair", "sorrow", "ache", "aching",
    "mourning", "devastated", "depressed", "down", "weeping", "heartbroken",
  ],
  anxious: [
    "anxious", "anxiety", "worried", "worry", "worrying", "nervous", "scared",
    "afraid", "fear", "fearful", "panic", "panicking", "dread", "stress",
    "stressed", "overwhelming", "overwhelmed", "tense", "uneasy", "restless",
    "terrified", "frightened", "insecure", "frantic", "spiral", "spiraling",
    "overthink", "overthinking", "catastrophe", "catastrophic", "catastrophizing",
    "ruminate", "ruminating", "rumination", "jitters", "jittery", "paranoid",
    "hypervigilant",
  ],
  angry: [
    "angry", "anger", "mad", "furious", "fury", "rage", "raging", "hate",
    "hated", "hating", "frustrated", "frustrating", "frustration", "annoyed",
    "irritated", "resent", "resentful", "pissed", "unfair", "betrayed", "bitter",
  ],
  confused: [
    "confused", "confusing", "confusion", "unsure", "uncertain", "unclear",
    "puzzled", "conflicted", "torn", "stuck", "questioning", "baffled",
    "unsettled", "doubting", "muddled", "indecisive",
  ],
  shocked: [
    "shocked", "shock", "surprise", "surprised", "surprising", "stunned",
    "startled", "startling", "unexpected", "unbelievable", "gasp", "gasped",
    "astounded", "speechless", "wow", "whoa", "omg", "jaw", "dropped",
  ],
  tired: [
    "tired", "exhausted", "exhaustion", "drained", "sleepy", "weary",
    "fatigue", "fatigued", "burnout", "depleted", "drowsy", "sluggish",
    "shattered", "lethargic", "wiped",
  ],
  happy: [
    "happy", "happiness", "grateful", "gratitude", "thankful", "love", "loved",
    "loving", "joy", "joyful", "excited", "proud", "hope", "hopeful", "glad",
    "smile", "smiling", "laugh", "laughed", "laughing", "celebrate", "blessed",
    "delight", "delighted", "amazing", "wonderful", "awesome", "thrilled",
  ],
  calm: [
    "calm", "peace", "peaceful", "relaxed", "serene", "quiet", "ease", "gentle",
    "tranquil", "settled", "grounded", "content", "steady", "centered", "okay",
  ],
};

const PRIORITY = COMPANION_EMOTIONS.filter(
  (e): e is Exclude<CompanionEmotion, "neutral"> => e !== "neutral"
);

/** Phrases that read as worry even without explicit anxious vocabulary. */
const ANXIOUS_PHRASES =
  /\b(go wrong|worst case|what if|can't stop|cannot stop|mind racing|on edge|spiraling out)\b/i;

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const scoreWords = (
  tokenCounts: Map<string, number>,
  lexicon: string[]
): number => {
  let score = 0;
  for (const word of lexicon) {
    score += tokenCounts.get(word) ?? 0;
  }
  return score;
};

/** Offline tone classification when Gemini is unavailable. */
export function detectCompanionEmotion(text: string): CompanionEmotion {
  const trimmed = text.trim();
  if (!trimmed) return "neutral";

  if (ANXIOUS_PHRASES.test(trimmed)) return "anxious";

  const tokenCounts = new Map<string, number>();
  for (const token of tokenize(trimmed)) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }

  let emotion: CompanionEmotion = "neutral";
  let best = 0;
  for (const candidate of PRIORITY) {
    const score = scoreWords(tokenCounts, LEXICONS[candidate]);
    if (score > best) {
      best = score;
      emotion = candidate;
    }
  }
  return emotion;
}
