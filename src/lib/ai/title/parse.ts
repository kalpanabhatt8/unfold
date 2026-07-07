const PARSING_ARTIFACT_PATTERN =
  /^(title|journal title|entry title)\s*[:.\-–—]/i;

/** Strip labels and punctuation from raw model title output. */
export function cleanTitleText(raw: string): string {
  return raw
    .trim()
    .replace(PARSING_ARTIFACT_PATTERN, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/[.,;:!]+$/g, (match) => (match.includes("?") ? "?" : ""))
    .replace(/[,;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse model output — first line only, no labels or quotes. */
export function parseTitleModelResponse(raw: string): string {
  const firstLine = raw.trim().split(/\r?\n/)[0]?.trim() ?? "";
  return cleanTitleText(firstLine);
}
