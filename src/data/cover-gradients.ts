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

/** Dashboard “create new” tile — also the default blank-book cover on first open. */
export const CREATE_NEW_COVER_BG = "var(--create-new-cover-bg)";

const LEGACY_BLANK_COVER_BG = coverBackgroundVar("g1");

/** g10 matches the canvas page — use create-new on covers so they don't disappear into the bg. */
export function resolveBookCoverBackground(
  background: string | undefined | null
): string {
  const trimmed = background?.trim();
  if (!trimmed) return CREATE_NEW_COVER_BG;
  const id = coverGradientIdFromBackground(trimmed);
  if (id === "g10") return CREATE_NEW_COVER_BG;
  return trimmed;
}

/** Blank books that still carry the old g1 default get the create-new cover instead. */
export function migrateBlankBookCoverBackground(
  background: string | undefined | null,
  sourceTemplateId?: string | null
): string {
  const resolved = resolveBookCoverBackground(background);
  const isBlank =
    sourceTemplateId === undefined ||
    sourceTemplateId === null ||
    sourceTemplateId === "blank";
  if (isBlank && resolved === LEGACY_BLANK_COVER_BG) {
    return CREATE_NEW_COVER_BG;
  }
  return resolved;
}
