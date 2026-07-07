import {
  MAX_TITLE_CHARS,
  MAX_TITLE_WORDS,
  MIN_WORDS_FOR_AI_TITLE,
  PREFERRED_TITLE_WORDS_MAX,
  PREFERRED_TITLE_WORDS_MIN,
  TITLE_CLIENT_TIMEOUT_MS,
  TITLE_INPUT_WORD_CAP,
  UNTITLED_ENTRY,
} from "@/lib/ai/title/constants";
import { fallbackTitle } from "@/lib/ai/title/fallback";
import { prepareTitleInput } from "@/lib/ai/title/input";
import { parseTitleModelResponse } from "@/lib/ai/title/parse";
import { validateTitle } from "@/lib/ai/title/validation";

export {
  MAX_TITLE_CHARS as MAX_SEAL_TITLE_CHARS,
  MAX_TITLE_WORDS as MAX_SEAL_TITLE_WORDS,
  MIN_WORDS_FOR_AI_TITLE,
  PREFERRED_TITLE_WORDS_MAX as PREFERRED_SEAL_TITLE_WORDS_MAX,
  PREFERRED_TITLE_WORDS_MIN as PREFERRED_SEAL_TITLE_WORDS_MIN,
  TITLE_INPUT_WORD_CAP,
  UNTITLED_ENTRY,
};

export { fallbackTitle as fallbackSealTitle };
export { hasMeaningfulContentForTitle } from "@/lib/ai/title/fallback";
export { generateTitle as generateJournalTitle } from "@/lib/ai/title/generate";

function resolveTitleFromApi(
  rawModelOutput: string | null | undefined,
  sourceText: string,
): string {
  const trimmed = sourceText.trim();
  if (!trimmed) return UNTITLED_ENTRY;

  if (rawModelOutput?.trim()) {
    const validation = validateTitle(rawModelOutput, trimmed, {
      fromModelResponse: true,
    });
    if (validation.ok) return validation.title;
  }

  return fallbackTitle(trimmed);
}

function titlePrefetchSignature(text: string): string {
  const prepared = prepareTitleInput(text);
  if (!prepared) return "";
  const words = prepared.split(/\s+/).filter(Boolean).length;
  return `${words}:${prepared.slice(-64)}`;
}

export type TitlePrefetch = {
  signature: string;
  promise: Promise<string>;
};

let activeTitlePrefetch: TitlePrefetch | null = null;

export const warmJournalTitleRoute = async (): Promise<void> => {
  try {
    await fetch("/api/journal-title");
  } catch {
    /* noop */
  }
};

export function prefetchSealTitle(text: string): Promise<string> | null {
  const prepared = prepareTitleInput(text);
  if (!prepared) return null;

  const signature = titlePrefetchSignature(prepared);
  if (activeTitlePrefetch?.signature === signature) {
    return activeTitlePrefetch.promise;
  }

  const promise = fetchJournalTitle(prepared).catch(() =>
    fallbackTitle(prepared),
  );
  activeTitlePrefetch = { signature, promise };
  return promise;
}

export function clearSealTitlePrefetch(): void {
  activeTitlePrefetch = null;
}

export function normalizeSealTitle(raw: string): string {
  return parseTitleModelResponse(raw) || UNTITLED_ENTRY;
}

export function isValidSealTitle(title: string, sourceText?: string): boolean {
  if (title === UNTITLED_ENTRY) return false;
  return validateTitle(title, sourceText).ok;
}

export function sealTitleNeedsShortening(raw: string): boolean {
  const cleaned = parseTitleModelResponse(raw);
  if (!cleaned) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  return cleaned.length > MAX_TITLE_CHARS || words.length > MAX_TITLE_WORDS;
}

export async function fetchJournalTitle(text: string): Promise<string> {
  const prepared = prepareTitleInput(text);
  if (!prepared) return UNTITLED_ENTRY;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    TITLE_CLIENT_TIMEOUT_MS,
  );

  try {
    const res = await fetch("/api/journal-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: prepared }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Title API failed (${res.status})`);

    const body = (await res.json()) as { title?: unknown };
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw new Error("Invalid title response");
    }

    if (body.title === UNTITLED_ENTRY) return UNTITLED_ENTRY;
    return resolveTitleFromApi(body.title, prepared);
  } catch {
    return fallbackTitle(prepared);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/** @deprecated Use prepareTitleInput — kept for callers migrating from journal-title. */
export const truncateTextForTitle = prepareTitleInput;

/** @deprecated Use resolveTitleFromApi internally — kept for external callers. */
export const resolveSealTitle = resolveTitleFromApi;

export const TITLE_API_TIMEOUT_MS = TITLE_CLIENT_TIMEOUT_MS;
