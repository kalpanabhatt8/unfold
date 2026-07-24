/**
 * Cheap local mechanism embeddings for overlap fold decisions.
 *
 * Aggregation runs synchronously on the client, so this uses hashed bag-of-words
 * vectors + cosine similarity — not a remote generation call. Swap
 * `embedMechanismText` later for a Voyage/OpenAI embedding API if needed;
 * fold logic only depends on cosine scores.
 *
 * Loop text at this stage = verbatim evidence quotes (AI mechanism prose is
 * generated later for survivors only, so it cannot drive the fold).
 */

import type { SurfacedPattern } from "@/lib/patterns/types";

/** Cosine gate for mechanism-similarity folds (independent of entry overlap). */
export const MECHANISM_SIMILARITY_THRESHOLD = 0.85;

const EMBED_DIMS = 256;

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "is",
  "it",
  "i",
  "my",
  "me",
  "that",
  "this",
  "was",
  "were",
  "be",
  "as",
  "at",
  "from",
  "have",
  "had",
  "has",
  "not",
  "so",
  "if",
  "just",
  "like",
  "about",
]);

/** Aggregation-stage loop grounding: joined evidence quotes. */
export function buildMechanismLoopText(pattern: SurfacedPattern): string {
  return pattern.evidence
    .flatMap((item) => item.quotes)
    .map((quote) => quote.trim())
    .filter(Boolean)
    .join("\n");
}

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));

/** FNV-1a style hash → bucket index. */
const hashToken = (token: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % EMBED_DIMS;
};

const l2Normalize = (vec: number[]): number[] => {
  let sumSquares = 0;
  for (const value of vec) sumSquares += value * value;
  if (sumSquares === 0) return vec;
  const scale = 1 / Math.sqrt(sumSquares);
  return vec.map((value) => value * scale);
};

/** Hashed bag-of-words embedding (fixed dims, L2-normalized). */
export function embedMechanismText(text: string): number[] {
  const vec = new Array<number>(EMBED_DIMS).fill(0);
  for (const token of tokenize(text)) {
    vec[hashToken(token)]! += 1;
  }
  return l2Normalize(vec);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
  }
  // Vectors are L2-normalized — clamp for float noise.
  if (dot > 1) return 1;
  if (dot < 0) return 0;
  return dot;
}

export function mechanismSimilarity(
  a: SurfacedPattern,
  b: SurfacedPattern,
  embeddings?: ReadonlyMap<string, number[]>,
): number {
  const embA =
    embeddings?.get(a.name) ?? embedMechanismText(buildMechanismLoopText(a));
  const embB =
    embeddings?.get(b.name) ?? embedMechanismText(buildMechanismLoopText(b));
  return cosineSimilarity(embA, embB);
}
