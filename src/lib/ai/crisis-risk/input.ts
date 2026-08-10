import {
  CRISIS_HEAD_WORDS,
  CRISIS_INPUT_WORD_CAP,
  CRISIS_TAIL_WORDS,
} from "@/lib/ai/crisis-risk/constants";

/**
 * Cap classifier input size without dropping the end of the entry (where
 * crisis language often appears). Full entry when under the cap.
 */
export function prepareCrisisRiskInput(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= CRISIS_INPUT_WORD_CAP) return text.trim();
  const head = words.slice(0, CRISIS_HEAD_WORDS).join(" ");
  const tail = words.slice(-CRISIS_TAIL_WORDS).join(" ");
  return `${head}\n[…]\n${tail}`;
}
