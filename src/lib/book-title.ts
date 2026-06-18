/** Canvas header placeholder — not persisted as the draft title. */
export const BOOK_TITLE_PLACEHOLDER = "New book";

export function hasBookTitle(title: string | undefined | null): boolean {
  return typeof title === "string" && title.trim().length > 0;
}

export function resolveBookDisplayTitle(title: string | undefined | null): string {
  return hasBookTitle(title) ? title!.trim() : BOOK_TITLE_PLACEHOLDER;
}
