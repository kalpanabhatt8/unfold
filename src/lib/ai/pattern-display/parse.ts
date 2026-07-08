export type ParsedDisplay = {
  displayTitle: string;
  summary: string | null;
};

export function parseDisplayResponse(raw: string): ParsedDisplay | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  const displayTitle =
    typeof record.displayTitle === "string"
      ? record.displayTitle.trim()
      : typeof record.title === "string"
        ? record.title.trim()
        : "";

  if (!displayTitle) return null;

  const summary =
    typeof record.summary === "string" && record.summary.trim()
      ? record.summary.trim()
      : null;

  return { displayTitle, summary };
}
