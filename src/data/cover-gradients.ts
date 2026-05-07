/**
 * Book cover color slots live in `app/book.css` as `--book-cover-gradient-*` (solid fills).
 * Use these helpers so drafts/localStorage and TS stay aligned with CSS.
 */
export const COVER_GRADIENT_IDS = [
  "g1",
  "g2",
  "g3",
  "g4",
  "g5",
  "g6",
  "g7",
  "g8",
  "g9",
  "g10",
] as const;

export type CoverGradientCanonicalId = (typeof COVER_GRADIENT_IDS)[number];
export type CoverGradientId = CoverGradientCanonicalId;

const VAR_RE = /var\(\s*--book-cover-gradient-([a-z0-9-]+)\s*\)/i;

export function normalizeCoverGradientId(
  id: string | undefined | null
): CoverGradientCanonicalId | undefined {
  if (typeof id !== "string") return undefined;
  const trimmed = id.trim();
  return (COVER_GRADIENT_IDS as readonly string[]).includes(trimmed)
    ? (trimmed as CoverGradientCanonicalId)
    : undefined;
}

export function isCoverGradientCssVar(background: string | undefined | null) {
  return Boolean(coverGradientIdFromBackground(background));
}

export function coverGradientIdFromBackground(
  background: string | undefined | null
): CoverGradientCanonicalId | undefined {
  if (typeof background !== "string") return undefined;
  const m = background.trim().match(VAR_RE);
  if (!m) return undefined;
  return normalizeCoverGradientId(m[1]) ?? "g1";
}

export function coverBackgroundVar(id: CoverGradientId): string {
  const normalized = normalizeCoverGradientId(id);
  return `var(--book-cover-gradient-${normalized ?? "g1"})`;
}
