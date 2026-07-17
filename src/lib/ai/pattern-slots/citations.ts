/**
 * Quote indexes are internal grounding only — never visible prose.
 * Models sometimes leak "[1,2,3]" into mechanism sentences; strip them.
 */

/** Matches bare citation lists like [1], [1,2], [1, 2, 3, 4]. */
const CITATION_BRACKET_RE = /\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g;

export const hasCitationBrackets = (text: string): boolean =>
  /\[\s*\d+(?:\s*,\s*\d+)*\s*\]/.test(text);

export const stripCitationBrackets = (text: string): string =>
  text
    .replace(CITATION_BRACKET_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
