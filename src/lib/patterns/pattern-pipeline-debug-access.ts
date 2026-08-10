/**
 * Shared access gate for internal debug tools:
 *   - /dashboard/pattern-debug
 *   - /dev/* (feedback inbox, playgrounds)
 *   - POST /api/entry-analysis `{ debug: true }` → `_debug` payload
 *   - localStorage debug capture store
 *
 * Hard-deny on production (NODE_ENV / VERCEL_ENV) cannot be overridden by the
 * env flag or allowlist. Local unlock still requires BOTH:
 *   NEXT_PUBLIC_PATTERN_PIPELINE_DEBUG=1
 *   and a Clerk userId on the allowlist.
 */

/** Clerk userIds allowed to use internal debug tools (local only). */
export const PATTERN_PIPELINE_DEBUG_USER_IDS = [
  "user_3Hh7UizmYEr42VMNuvpDn5Pdlh1", // kalpanabhatt8888
  "user_3HV7zuLS3lu362uJYOnj2UBnO2w", // kalpanabhatt9999
  "user_3HV5dgIL3QdpPZXWab7bOzzCI6K", // kannubhatt9999
] as const;

const ALLOWLIST = new Set<string>(PATTERN_PIPELINE_DEBUG_USER_IDS);

type ClerkWindow = Window & {
  Clerk?: { user?: { id?: string } | null };
};

/** Production builds / Vercel production — never allow, even with flag + allowlist. */
export function isPatternPipelineDebugHardDenied(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.VERCEL_ENV === "production") return true;
  // Client-safe Vercel system var (when exposed to the browser).
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") return true;
  return false;
}

export function resolveBrowserClerkUserId(): string | null {
  if (typeof window === "undefined") return null;
  const id = (window as ClerkWindow).Clerk?.user?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Shared gate for page, /dev/*, live capture, localStorage store, and API `_debug`.
 * Pass the signed-in Clerk userId (or null when unknown / signed out).
 */
export function canUsePatternPipelineDebug(
  userId: string | null | undefined,
): boolean {
  if (isPatternPipelineDebugHardDenied()) return false;
  if (process.env.NEXT_PUBLIC_PATTERN_PIPELINE_DEBUG !== "1") return false;
  if (!userId) return false;
  return ALLOWLIST.has(userId);
}

/** Alias — same gate; prefer this name for /dev and other internal tools. */
export const canUseInternalDebugTools = canUsePatternPipelineDebug;

/** Client helper when a React/Clerk hook userId is not available. */
export function canUsePatternPipelineDebugClient(): boolean {
  return canUsePatternPipelineDebug(resolveBrowserClerkUserId());
}
