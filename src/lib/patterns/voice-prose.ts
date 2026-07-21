/**
 * Normalize AI voice punctuation for mechanism / question display.
 * Em/en dashes read as essay-like; prefer commas in short journal beats.
 */

/** Replace typographic dashes with a comma (and tidy spacing). */
export function stripTypographicDashes(text: string): string {
  return text
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}
