import {
  MIN_WORDS_FOR_AI_TITLE,
  UNTITLED_ENTRY,
} from "@/lib/ai/title/constants";
import { countTitleInputWords } from "@/lib/ai/title/input";

/** Writer-voice fallbacks when title generation fails — personal, vague, human. */
const WRITER_VOICE_FALLBACKS = [
  "Again",
  "Not Sure",
  "One of Those Days",
  "Maybe Tomorrow",
  "Hard to Say",
  "I Don't Know",
  "Not Today",
  "Still Thinking",
  "Can't Explain",
  "Trying Anyway",
] as const;

export function hasMeaningfulContentForTitle(text: string): boolean {
  return countTitleInputWords(text) >= MIN_WORDS_FOR_AI_TITLE;
}

function stableFallbackIndex(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % WRITER_VOICE_FALLBACKS.length;
}

/**
 * Title fallback strategy: writer-voice phrase for meaningful entries;
 * "Untitled Entry" only when content is too short to title.
 */
export function fallbackTitle(text: string): string {
  const trimmed = text.trim();
  if (!hasMeaningfulContentForTitle(trimmed)) return UNTITLED_ENTRY;
  return WRITER_VOICE_FALLBACKS[stableFallbackIndex(trimmed)]!;
}
