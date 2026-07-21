/**
 * Defense-in-depth gate for Anthropic-backed routes: Clerk session +
 * per-user rate limit (not middleware alone).
 */

import { requireUser } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const requireAiUser = async (): Promise<string> => {
  const userId = await requireUser();
  const limited = checkRateLimit(`ai:${userId}`);
  if (!limited.ok) {
    throw new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec) },
    });
  }
  return userId;
};
