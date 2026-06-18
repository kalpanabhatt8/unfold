import {
  COMPANION_EMOTIONS,
  LIVE_EMOTION_MIN_WORDS,
  type CompanionEmotion,
  type CompanionResponse,
} from "@/lib/companion-ai";

/* ════════════════════════════════════════════════════════════════════════════
 *  Offline emotion detection — pure keyword matching, no API.
 *
 *  Used as the instant fallback whenever the Gemini route is unavailable
 *  (missing key, error, or timeout). Each emotion has a single-word lexicon
 *  (matched against tokenised journal text) and a small set of warm,
 *  observational lines. Add/remove words here to tune detection.
 *
 *  Keep lexicons SINGLE TOKENS — the tokenizer splits on whitespace, so
 *  multi-word phrases ("fed up") will never match.
 * ════════════════════════════════════════════════════════════════════════════ */

const LEXICONS: Record<Exclude<CompanionEmotion, "neutral">, string[]> = {
  // grief, sadness, weight, loss
  heavy: [
    "sad", "sadness", "grief", "grieving", "hurt", "hurting", "pain", "painful",
    "lonely", "loneliness", "lost", "miss", "missing", "cry", "crying", "cried",
    "tears", "heavy", "broken", "alone", "numb", "guilt", "guilty", "regret",
    "dark", "empty", "hopeless", "despair", "sorrow", "ache", "aching",
    "mourning", "devastated", "depressed", "down", "weeping", "unbearable",
    "suffering", "heartbroken", "grieve",
  ],
  // worry, fear, nervousness
  anxious: [
    "anxious", "anxiety", "worried", "worry", "worrying", "nervous", "scared",
    "afraid", "fear", "fearful", "panic", "panicking", "dread", "stress",
    "stressed", "stressful", "overwhelmed", "overwhelming", "tense", "uneasy",
    "restless", "racing", "apprehensive", "jittery", "terrified", "frightened",
    "insecure", "shaking", "trembling", "frantic", "paranoid",
  ],
  // anger, frustration, resentment
  angry: [
    "angry", "anger", "mad", "furious", "fury", "rage", "raging", "hate",
    "hated", "hating", "frustrated", "frustrating", "frustration", "annoyed",
    "annoying", "irritated", "irritating", "resent", "resentful", "pissed",
    "unfair", "betrayed", "livid", "fuming", "disgusted", "bitter", "outraged",
    "infuriating", "hostile", "snapped", "yelled",
  ],
  // uncertainty, disorientation, being torn
  confused: [
    "confused", "confusing", "confusion", "unsure", "uncertain", "uncertainty",
    "unclear", "puzzled", "conflicted", "torn", "stuck", "questioning",
    "ambivalent", "disoriented", "wondering", "baffled", "unsettled",
    "directionless", "doubting", "blurry", "muddled", "indecisive",
  ],
  // fatigue, exhaustion, depletion
  tired: [
    "tired", "exhausted", "exhaustion", "drained", "sleepy", "weary",
    "wearied", "fatigue", "fatigued", "burnout", "worn", "depleted", "spent",
    "drowsy", "yawning", "overworked", "sluggish", "shattered", "knackered",
    "lethargic", "wiped", "running", "empty",
  ],
  // joy, gratitude, lightness
  happy: [
    "happy", "happiness", "grateful", "gratitude", "thankful", "love", "loved",
    "loving", "joy", "joyful", "excited", "exciting", "proud", "hope",
    "hopeful", "glad", "smile", "smiling", "laugh", "laughed", "laughing",
    "celebrate", "celebrating", "blessed", "fun", "delight", "delighted",
    "win", "won", "amazing", "wonderful", "awesome", "cheerful", "thrilled",
    "ecstatic", "bright", "grinning",
  ],
  // peace, serenity, ease
  calm: [
    "calm", "peace", "peaceful", "relaxed", "relaxing", "serene", "serenity",
    "quiet", "ease", "easy", "gentle", "soothing", "tranquil", "settled",
    "grounded", "content", "contented", "steady", "centered", "balanced",
    "mellow", "soft", "still", "comfortable", "okay", "fine", "breathe",
  ],
};

const LINES: Record<CompanionEmotion, string[]> = {
  heavy: [
    "That sounds like it carries some weight.",
    "You're holding something real here.",
    "There's a lot in what you wrote.",
    "I can feel the heaviness in this.",
  ],
  anxious: [
    "There's a restless edge in what you wrote.",
    "Something here feels like it's been worrying you.",
    "I notice a bit of unease in this.",
    "Your mind sounds like it's been racing.",
  ],
  angry: [
    "There's some real heat in what you wrote.",
    "Something here clearly got under your skin.",
    "I can feel the frustration in this.",
    "That sounds like it stirred something up.",
  ],
  confused: [
    "Sounds like you're sorting through something tangled.",
    "There's a lot you're still turning over here.",
    "Some of this feels unsettled, still finding its shape.",
    "You're sitting with some uncertainty here.",
  ],
  tired: [
    "Sounds like you're running on empty.",
    "There's a tiredness underneath this.",
    "You seem worn down by it all.",
    "Feels like you've been carrying a lot lately.",
  ],
  happy: [
    "There's a lightness in what you wrote.",
    "Something warm is coming through here.",
    "That has a bright feeling to it.",
    "You sound like you're carrying something good.",
  ],
  calm: [
    "There's a quiet steadiness in this.",
    "Something here feels settled and calm.",
    "You sound at ease in what you wrote.",
    "There's a gentle peace in these words.",
  ],
  neutral: [
    "You're putting real thought on the page.",
    "I noticed you taking your time with this.",
    "There's honesty in what you wrote.",
    "You're really showing up for yourself here.",
  ],
};

/**
 * Order ties resolve in: the first emotion with the top score wins. Heavier /
 * more pressing tones are listed first so a tie surfaces them over lighter ones.
 */
const PRIORITY = COMPANION_EMOTIONS.filter(
  (e): e is Exclude<CompanionEmotion, "neutral"> => e !== "neutral"
);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const scoreWords = (tokenCounts: Map<string, number>, lexicon: string[]): number => {
  let score = 0;
  for (const word of lexicon) {
    score += tokenCounts.get(word) ?? 0;
  }
  return score;
};

const buildTokenCounts = (text: string): Map<string, number> => {
  const tokenCounts = new Map<string, number>();
  for (const token of tokenize(text)) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }
  return tokenCounts;
};

/** Fast local tone classification — sync, no API. */
export function detectCompanionEmotion(text: string): CompanionEmotion {
  const trimmed = text.trim();
  if (!trimmed) return "neutral";

  const tokenCounts = buildTokenCounts(trimmed);
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

export function meetsLiveEmotionThreshold(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (tokenize(trimmed).length >= LIVE_EMOTION_MIN_WORDS) return true;
  return detectCompanionEmotion(trimmed) !== "neutral";
}

const pickLine = (lines: string[], text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash + text.charCodeAt(i) * (i + 1)) % lines.length;
  }
  return lines[hash] ?? lines[0];
};

/** Infer one of 8 emotions + a warm line from journal text — no API required. */
export const analyzeJournalLocally = (text: string): CompanionResponse => {
  const trimmed = text.trim();
  const emotion = detectCompanionEmotion(trimmed);

  return {
    emotion,
    line: pickLine(LINES[emotion], trimmed),
  };
};
