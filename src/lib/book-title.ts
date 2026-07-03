/** Canvas header placeholder — not persisted as the draft title. */
export const BOOK_TITLE_PLACEHOLDER = "New book";

/** Max characters for AI-generated seal titles on the cover stamp. */
export const MAX_BOOK_TITLE_CHARS = 24;

export function hasBookTitle(title: string | undefined | null): boolean {
  return typeof title === "string" && title.trim().length > 0;
}

export function resolveBookDisplayTitle(title: string | undefined | null): string {
  return hasBookTitle(title) ? title!.trim() : BOOK_TITLE_PLACEHOLDER;
}

export function clampBookTitle(raw: string): string {
  return raw.replace(/\s+/g, " ");
}

/** Trim edges for persisted / displayed titles — use on blur, not while typing. */
export function commitBookTitle(raw: string): string {
  return clampBookTitle(raw).trim();
}
