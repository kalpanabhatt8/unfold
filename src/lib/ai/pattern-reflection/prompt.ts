import type { ReflectionInput } from "@/lib/ai/pattern-reflection/input";

/** Pattern reflection prompt — curiosity and self-reflection grounded in evidence. */
export function buildReflectionPrompt(input: ReflectionInput): string {
  const { patternName, label, definition, quotes, topics } = input;

  return `You read evidence from several private journal entries where the same mental pattern appeared. Write two short reflections grounded ONLY in the quotes and topics below — nothing invented.

Pattern: ${patternName} (${label})
Definition (for your reference only — do not repeat or paraphrase as the observation): ${definition}

Evidence quotes (verbatim snippets from different entries):
${quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Topics across those entries: ${topics.length > 0 ? topics.join(", ") : "(none listed)"}

Return:
1. observation — ONE sentence, second person ("You…"), describing the SPECIFIC way this pattern shows up in THESE entries. Spark curiosity — something the writer might notice about themselves. Not a label, not advice, not therapy. Must be grounded in the quotes above.
2. commonThread — ONE sentence starting with "Each one" or "All of them" that states what these specific entries have in common regarding this pattern. Grounded in the quotes. No advice.

Output ONLY valid JSON:
{"observation":"<sentence>","commonThread":"<sentence>"}`;
}

export function buildReflectionRetryPrompt(
  input: ReflectionInput,
  rejectionReason: string,
): string {
  return `${buildReflectionPrompt(input)}

Your previous response was rejected: ${rejectionReason}

Write a new JSON response that fixes the problem. Stay grounded in the quotes. Do not repeat the pattern definition.`;
}

export const REFLECTION_REJECTION_MESSAGES: Record<string, string> = {
  empty: "One or both fields were empty.",
  parsing_error: "The response was not valid JSON.",
  too_long: "One or both sentences were too long.",
  not_grounded: "The observation was not grounded in the provided quotes.",
  definition_echo: "The observation repeated the pattern definition instead of reflecting on these entries.",
  advice_voice: "The text sounded like advice or therapy rather than a curious observation.",
  invalid_common_thread: "commonThread must start with 'Each one' or 'All of them'.",
};
