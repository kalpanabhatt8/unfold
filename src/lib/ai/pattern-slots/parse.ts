const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** One Loop sentence with supporting evidence quote indexes (1-based). */
export type LoopStepFill = {
  text: string;
  /** 1-based indexes into the chronological evidence quote list. */
  quoteIndexes: number[];
};

export type ParsedSlotFill = {
  index: number;
  text: string;
  /** Present on Loop/mechanism fills — retained for user-facing evidence. */
  steps?: LoopStepFill[];
};

const parseQuoteIndexes = (raw: unknown): number[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    .map((n) => Math.trunc(n))
    .filter((n) => n >= 1);
};

const parseSteps = (raw: unknown): LoopStepFill[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const steps: LoopStepFill[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) continue;
    steps.push({
      text,
      quoteIndexes: parseQuoteIndexes(item.quoteIndexes),
    });
  }
  return steps.length > 0 ? steps : undefined;
};

const joinSteps = (steps: LoopStepFill[]): string =>
  steps
    .map((s) => {
      const t = s.text.trim();
      if (!t) return "";
      return /[.!?]$/.test(t) ? t : `${t}.`;
    })
    .filter(Boolean)
    .join(" ");

/** Parse `[{"index":1,"text":"...","steps":[...]}]` from model output. */
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
      if (typeof index !== "number") continue;

      const steps = parseSteps(item.steps);
      let text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text && steps) text = joinSteps(steps);
      if (!text) continue;

      fills.push(steps ? { index, text, steps } : { index, text });
    }

    return fills.length > 0 ? fills : null;
  } catch {
    return null;
  }
}
