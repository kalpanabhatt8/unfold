export const FEEDBACK_CATEGORIES = [
  { id: "bug", label: "🐞 Found a bug" },
  { id: "feature", label: "💡 Feature request" },
  { id: "confusing", label: "🤔 Confusing" },
  { id: "slow", label: "⚡ Slow" },
  { id: "loved", label: "❤️ Loved it" },
] as const;

export type FeedbackCategoryId = (typeof FEEDBACK_CATEGORIES)[number]["id"];

/** Alias for modal chip picker — same ids as FEEDBACK_CATEGORIES. */
export type FeedbackChipId = FeedbackCategoryId;

export const FEEDBACK_CHIPS = FEEDBACK_CATEGORIES;

const CATEGORY_ID_SET = new Set<string>(
  FEEDBACK_CATEGORIES.map((category) => category.id),
);

export const isFeedbackCategoryId = (
  value: string,
): value is FeedbackCategoryId => CATEGORY_ID_SET.has(value);

export const feedbackCategoryLabel = (id: string): string =>
  FEEDBACK_CATEGORIES.find((category) => category.id === id)?.label ?? id;

export const labelForFeedbackChip = feedbackCategoryLabel;

/** Dedupe and keep canonical category order from FEEDBACK_CATEGORIES. */
export const parseFeedbackCategories = (raw: unknown): FeedbackCategoryId[] => {
  if (!Array.isArray(raw)) return [];

  const selected = new Set<FeedbackCategoryId>();
  for (const item of raw) {
    if (typeof item === "string" && isFeedbackCategoryId(item)) {
      selected.add(item);
    }
  }

  return FEEDBACK_CATEGORIES.filter((category) =>
    selected.has(category.id),
  ).map((category) => category.id);
};

export const normalizeFeedbackCategories = parseFeedbackCategories;

export const isValidFeedbackPayload = (
  categories: FeedbackCategoryId[],
  text: string,
): boolean => {
  const trimmed = text.trim();
  if (categories.includes("feature")) return Boolean(trimmed);
  return categories.length > 0 || Boolean(trimmed);
};

export const feedbackChipStyle = {
  fontSize: "var(--text-sm)",
  lineHeight: "var(--text-sm--line-height)",
  fontFamily: "var(--font-body)",
} as const;

export const feedbackChipClass =
  "inline-flex items-center gap-1 rounded-full border border-(--sidebar-border) bg-(--surface-raised) px-3 py-1.5 font-normal text-primary transition-colors duration-150 " +
  "hover:bg-(--surface-chrome) " +
  "data-[active=true]:bg-(--surface-chrome-hover) " +
  "data-[active=true]:hover:bg-(--surface-chrome-active)";
