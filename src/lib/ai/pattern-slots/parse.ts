const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export type ParsedSlotFill = { index: number; text: string };

/** Parse `[{"index":1,"text":"..."}]` from model output. */
export function parseSlotResponse(raw: string): ParsedSlotFill[] | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) return null;

    const fills: ParsedSlotFill[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) continue;
      const index = item.index;
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (typeof index !== "number" || !text) continue;
      fills.push({ index, text });
    }

    return fills.length > 0 ? fills : null;
  } catch {
    return null;
  }
}
