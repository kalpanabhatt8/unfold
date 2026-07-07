import {
  REFLECTION_MAX_QUOTE_CHARS,
  REFLECTION_MAX_QUOTES,
} from "@/lib/ai/pattern-reflection/constants";

export type ReflectionInput = {
  patternName: string;
  label: string;
  definition: string;
  quotes: string[];
  topics: string[];
};

/** Sanitize quotes and topics before sending to the reflection model. */
export function prepareReflectionInput(input: {
  patternName: string;
  label: string;
  definition: string;
  quotes: string[];
  topics: string[];
}): ReflectionInput {
  return {
    patternName: input.patternName.trim(),
    label: input.label.trim(),
    definition: input.definition.trim(),
    quotes: input.quotes
      .map((q) => q.trim())
      .filter(Boolean)
      .map((q) =>
        q.length > REFLECTION_MAX_QUOTE_CHARS
          ? q.slice(0, REFLECTION_MAX_QUOTE_CHARS).trim()
          : q,
      )
      .slice(0, REFLECTION_MAX_QUOTES),
    topics: input.topics
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  };
}
