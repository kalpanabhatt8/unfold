import { TITLE_INPUT_WORD_CAP } from "@/lib/ai/title/constants";

/** Prepare entry text for the title model — full entry when possible. */
export function prepareTitleInput(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= TITLE_INPUT_WORD_CAP) return trimmed;

  const headWords = Math.ceil(TITLE_INPUT_WORD_CAP * 0.4);
  const tailWords = TITLE_INPUT_WORD_CAP - headWords;
  const head = words.slice(0, headWords).join(" ");
  const tail = words.slice(-tailWords).join(" ");
  return `${head}\n\n[...]\n\n${tail}`;
}

export function countTitleInputWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
