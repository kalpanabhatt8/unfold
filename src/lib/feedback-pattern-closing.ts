export const PATTERN_CLOSING_PREFIX = "[pattern closing]";

const normalizeApostrophe = (s: string) => s.replace(/\u2019/g, "'");

export const isPatternClosingFeedback = (text: string): boolean =>
  text.trim().toLowerCase().startsWith(PATTERN_CLOSING_PREFIX);

export type ParsedPatternClosingFeedback = {
  patternName: string | null;
  reason: string;
};

/** Parse downvote reason rows stored in the feedback table. */
export const parsePatternClosingFeedback = (
  text: string,
): ParsedPatternClosingFeedback | null => {
  const trimmed = text.trim();
  if (!trimmed.toLowerCase().startsWith(PATTERN_CLOSING_PREFIX)) return null;

  const rest = trimmed.slice(PATTERN_CLOSING_PREFIX.length).trim();
  if (!rest) return null;

  const pipe = rest.indexOf("|");
  if (pipe >= 0) {
    const patternName = rest.slice(0, pipe).trim();
    const reason = normalizeApostrophe(rest.slice(pipe + 1).trim());
    if (!patternName || !reason) return null;
    return { patternName, reason };
  }

  return { patternName: null, reason: normalizeApostrophe(rest) };
};
