/** Fallback when journal content is too short for AI title generation. */
export const UNTITLED_ENTRY = "Untitled Entry";

/** Minimum word count before calling the title model. */
export const MIN_WORDS_FOR_AI_TITLE = 3;

/** Max words allowed in a generated seal title. */
export const MAX_SEAL_TITLE_WORDS = 5;

const TITLE_API_TIMEOUT_MS = 4_000;

export function normalizeSealTitle(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ");
  if (!cleaned) return UNTITLED_ENTRY;

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= MAX_SEAL_TITLE_WORDS) return words.join(" ");
  return words.slice(0, MAX_SEAL_TITLE_WORDS).join(" ");
}

export async function fetchJournalTitle(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return UNTITLED_ENTRY;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    TITLE_API_TIMEOUT_MS
  );

  try {
    const res = await fetch("/api/journal-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Title API failed (${res.status})`);

    const body = (await res.json()) as { title?: unknown };
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw new Error("Invalid title response");
    }

    return normalizeSealTitle(body.title);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
