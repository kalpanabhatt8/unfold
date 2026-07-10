/**
 * Prompt versions per AI feature. Bump a version whenever its prompt changes
 * materially — persisted AI artifacts carry the version they were generated
 * with, so readers can treat mismatches as cache misses instead of shipping
 * ad-hoc staleness checks.
 */
export const PROMPT_VERSIONS = {
  extraction: "v1",
  slots: "v1",
  display: "v1",
  title: "v1",
} as const;
