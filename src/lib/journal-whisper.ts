/** Discard seal whispers longer than this (prompt targets 2–5 words). */
export const MAX_SEAL_WHISPER_WORDS = 8;

const WHISPER_API_TIMEOUT_MS = 5_000;

export function normalizeSealWhisper(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (!cleaned) return null;

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_SEAL_WHISPER_WORDS) return null;

  return cleaned;
}

/** Fetches a one-line seal reaction. Returns null on any failure — never throws. */
export async function fetchJournalWhisper(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    WHISPER_API_TIMEOUT_MS
  );

  try {
    const res = await fetch("/api/journal-whisper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const body = (await res.json()) as { whisper?: unknown };
    if (typeof body.whisper !== "string" || !body.whisper.trim()) {
      return null;
    }

    return normalizeSealWhisper(body.whisper);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
