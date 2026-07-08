import {
  DISPLAY_MAX_QUOTE_CHARS,
  DISPLAY_MAX_QUOTES,
} from "@/lib/ai/pattern-display/constants";

export type DisplayInput = {
  patternName: string;
  label: string;
  definition: string;
  quotes: string[];
};

export function prepareDisplayInput(raw: {
  patternName: string;
  label: string;
  definition: string;
  quotes: string[];
}): DisplayInput {
  const quotes = [
    ...new Set(raw.quotes.map((q) => q.trim()).filter(Boolean)),
  ]
    .map((q) =>
      q.length > DISPLAY_MAX_QUOTE_CHARS
        ? q.slice(0, DISPLAY_MAX_QUOTE_CHARS).trim()
        : q,
    )
    .slice(0, DISPLAY_MAX_QUOTES);

  return {
    patternName: raw.patternName,
    label: raw.label,
    definition: raw.definition,
    quotes,
  };
}
