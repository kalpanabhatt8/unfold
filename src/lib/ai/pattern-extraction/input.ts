import {
  EXTRACTION_HEAD_WORDS,
  EXTRACTION_INPUT_WORD_CAP,
  EXTRACTION_TAIL_WORDS,
} from "@/lib/ai/pattern-extraction/constants";

/** Prepare entry text for pattern extraction — favors tail for recent context. */
export function prepareExtractionInput(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= EXTRACTION_INPUT_WORD_CAP) return text.trim();
  const head = words.slice(0, EXTRACTION_HEAD_WORDS).join(" ");
  const tail = words.slice(-EXTRACTION_TAIL_WORDS).join(" ");
  return `${head}\n[…]\n${tail}`;
}
