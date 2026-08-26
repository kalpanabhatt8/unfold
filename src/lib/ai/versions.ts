/**
 * Prompt versions per AI feature. Bump a version whenever its prompt changes
 * materially - persisted AI artifacts carry the version they were generated
 * with, so readers can treat mismatches as cache misses instead of shipping
 * ad-hoc staleness checks.
 */
export const PROMPT_VERSIONS = {
  /** Bump whenever extraction prompt, catalog, shared examples, or validation that affects stored patterns changes. */
  extraction: "v4",
  slots: "v2",
  display: "v1",
  title: "v1",
} as const;
