/**
 * Montage detector — rejects mechanism loops that stitch separate entry
 * incidents into an implied timeline instead of naming the generic shape.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "so", "to", "of", "in", "on", "at",
  "it", "is", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "did", "does", "that", "this", "with", "for", "as", "by", "from",
  "i", "me", "my", "you", "your", "they", "their", "them", "we", "our",
  "someone", "something", "some", "still", "just", "then", "when", "what",
  "how", "if", "not", "no", "yes", "out", "up", "down", "over", "into",
]);

const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w']/g, ""))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

/** Split mechanism prose into sentences (matches validation punctuation count). */
export const splitMechanismSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const quoteOverlapRatio = (sentence: string, quote: string): number => {
  const lineWords = tokens(sentence);
  if (lineWords.length < 2) return 0;
  const quoteWords = new Set(tokens(quote));
  if (quoteWords.size === 0) return 0;
  const overlap = lineWords.filter((w) => quoteWords.has(w)).length;
  return overlap / lineWords.length;
};

/** Index of the quote this sentence maps to most strongly, if above threshold. */
const dominantQuoteForSentence = (
  sentence: string,
  quotes: string[],
  threshold: number,
): number | null => {
  let bestIndex = -1;
  let bestRatio = 0;
  quotes.forEach((quote, index) => {
    const ratio = quoteOverlapRatio(sentence, quote);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestIndex = index;
    }
  });
  return bestRatio >= threshold ? bestIndex : null;
};

/** ≥2 sentences open with the same telegraphic incident pattern ("Saw X", "Got Y"). */
export const hasRepeatedTelegraphicOpeners = (text: string): boolean => {
  const sentences = splitMechanismSentences(text);
  const telegraphic = sentences.filter((s) =>
    /^(?:Saw|Got|Read|Heard|Noticed|Checked|Found|Watched|Spotted|Opened|Closed)\b/i.test(
      s.trim(),
    ),
  );
  return telegraphic.length >= 2;
};

/**
 * True when consecutive sentences each map strongly to a *different* evidence
 * quote — a montage of separate entry incidents, not one generic loop shape.
 */
export const mapsQuotesInSequence = (
  text: string,
  quotes: string[],
  overlapThreshold = 0.35,
): boolean => {
  if (quotes.length < 2) return false;

  const sentences = splitMechanismSentences(text);
  if (sentences.length < 2) return false;

  const mapped: number[] = [];
  for (const sentence of sentences) {
    const index = dominantQuoteForSentence(sentence, quotes, overlapThreshold);
    if (index !== null) mapped.push(index);
  }

  if (mapped.length < 2) return false;

  // Montage: each mapped sentence points at a different quote in order.
  const allDifferent =
    mapped.length >= 2 &&
    mapped.every((idx, i) => i === 0 || idx !== mapped[i - 1]!) &&
    new Set(mapped).size >= 2;

  return allDifferent && mapped.length >= 2;
};

/** Reject mechanism text that stitches quote incidents instead of abstract shape. */
export const stitchesIncidents = (text: string, quotes: string[]): boolean =>
  hasRepeatedTelegraphicOpeners(text) || mapsQuotesInSequence(text, quotes);
