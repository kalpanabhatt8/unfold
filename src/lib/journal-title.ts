import { MAX_BOOK_TITLE_CHARS } from "@/lib/book-title";

/** Fallback when journal content is too short for AI title generation. */
export const UNTITLED_ENTRY = "Untitled Entry";

/** Minimum word count before calling the title model. */
export const MIN_WORDS_FOR_AI_TITLE = 3;

/** Preferred word count range for Claude-generated cover titles. */
export const PREFERRED_SEAL_TITLE_WORDS_MIN = 3;
export const PREFERRED_SEAL_TITLE_WORDS_MAX = 4;

/** Hard max words for a generated seal title. */
export const MAX_SEAL_TITLE_WORDS = PREFERRED_SEAL_TITLE_WORDS_MAX;

/** Hard max characters (including spaces) — matches cover title input limit. */
export const MAX_SEAL_TITLE_CHARS = MAX_BOOK_TITLE_CHARS;

/** Tail sent to the title model — keeps requests small and fast. */
export const TITLE_INPUT_WORD_CAP = 100;

const TITLE_API_TIMEOUT_MS = 2_500;

export function truncateTextForTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= TITLE_INPUT_WORD_CAP) return trimmed;
  return words.slice(-TITLE_INPUT_WORD_CAP).join(" ");
}

function sealTitleSignature(text: string): string {
  const trimmed = truncateTextForTitle(text);
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  return `${words}:${trimmed.slice(-64)}`;
}

export type SealTitlePrefetch = {
  signature: string;
  promise: Promise<string>;
};

let activeSealTitlePrefetch: SealTitlePrefetch | null = null;

/** Ping the route so Next.js compiles it before the first seal. */
export const warmJournalTitleRoute = async (): Promise<void> => {
  try {
    await fetch("/api/journal-title");
  } catch {
    /* noop */
  }
};

/** Start (or reuse) a title fetch for the current journal text. */
export function prefetchSealTitle(text: string): Promise<string> | null {
  const trimmed = truncateTextForTitle(text);
  if (!trimmed) return null;

  const signature = sealTitleSignature(trimmed);
  if (
    activeSealTitlePrefetch &&
    activeSealTitlePrefetch.signature === signature
  ) {
    return activeSealTitlePrefetch.promise;
  }

  const promise = fetchJournalTitle(trimmed).catch(() => UNTITLED_ENTRY);
  activeSealTitlePrefetch = { signature, promise };
  return promise;
}

export function clearSealTitlePrefetch(): void {
  activeSealTitlePrefetch = null;
}

function cleanSealTitleRaw(raw: string): string {
  return raw
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeSealTitle(raw: string): string {
  const cleaned = cleanSealTitleRaw(raw);
  if (!cleaned) return UNTITLED_ENTRY;

  let words = cleaned.split(" ").filter(Boolean).slice(0, MAX_SEAL_TITLE_WORDS);
  let title = words.join(" ");

  while (title.length > MAX_SEAL_TITLE_CHARS && words.length > 1) {
    words = words.slice(0, -1);
    title = words.join(" ");
  }

  if (title.length > MAX_SEAL_TITLE_CHARS) {
    title = title.slice(0, MAX_SEAL_TITLE_CHARS).trimEnd();
  }

  if (!title) return UNTITLED_ENTRY;
  return title;
}

export function isValidSealTitle(title: string): boolean {
  const words = title.split(/\s+/).filter(Boolean);
  return (
    words.length >= 1 &&
    words.length <= MAX_SEAL_TITLE_WORDS &&
    title.length <= MAX_SEAL_TITLE_CHARS
  );
}

export function sealTitleNeedsShortening(raw: string): boolean {
  const cleaned = cleanSealTitleRaw(raw);
  if (!cleaned) return false;
  const words = cleaned.split(" ").filter(Boolean);
  return (
    cleaned.length > MAX_SEAL_TITLE_CHARS || words.length > MAX_SEAL_TITLE_WORDS
  );
}

export async function fetchJournalTitle(text: string): Promise<string> {
  const trimmed = truncateTextForTitle(text);
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
