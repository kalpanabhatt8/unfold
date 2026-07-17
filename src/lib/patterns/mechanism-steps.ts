import { stripCitationBrackets } from "@/lib/ai/pattern-slots/citations";

/** Split mechanism prose into sequential event steps (one sentence each). */
export function splitMechanismSteps(text: string): string[] {
  const trimmed = stripCitationBrackets(text);
  if (!trimmed) return [];

  const sentences = trimmed.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length === 0) return [trimmed];

  return sentences
    .map((s) => stripCitationBrackets(s))
    .filter(Boolean);
}
