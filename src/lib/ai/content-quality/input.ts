import {
  QUALITY_HEAD_WORDS,
  QUALITY_INPUT_WORD_CAP,
  QUALITY_TAIL_WORDS,
} from "@/lib/ai/content-quality/constants";

/**
 * Cap classifier input size. Same head+tail strategy as crisis — quality
 * signals can appear late in long entries.
 */
export function prepareContentQualityInput(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= QUALITY_INPUT_WORD_CAP) return text.trim();
  const head = words.slice(0, QUALITY_HEAD_WORDS).join(" ");
  const tail = words.slice(-QUALITY_TAIL_WORDS).join(" ");
  return `${head}\n[…]\n${tail}`;
}
