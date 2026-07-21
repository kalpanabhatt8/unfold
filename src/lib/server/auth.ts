/**
 * Server-side auth helpers. Every data route resolves the Clerk userId here;
 * all queries are scoped to it — there is no cross-user data path.
 */

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/server/db";

/** Clerk userId for the current request, or null when signed out. */
export const currentUserId = async (): Promise<string | null> => {
  const { userId } = await auth();
  return userId;
};

/**
 * Process-local set of user ids whose `users` row is known to exist.
 * Avoids a Neon round-trip on every sync/AI call after the first ensure
 * in this server isolate (fullSync hits import → entries → patterns).
 */
const globalForAuth = globalThis as unknown as {
  keepsEnsuredUserIds?: Set<string>;
};

const ensuredUserIds = (): Set<string> => {
  if (!globalForAuth.keepsEnsuredUserIds) {
    globalForAuth.keepsEnsuredUserIds = new Set();
  }
  return globalForAuth.keepsEnsuredUserIds;
};

/** Insert the users row if missing; no-op when it already exists. */
const ensureUserRow = async (userId: string): Promise<void> => {
  if (ensuredUserIds().has(userId)) return;

  // Single round-trip; skipDuplicates avoids the upsert update path.
  await db.user.createMany({
    data: [{ id: userId }],
    skipDuplicates: true,
  });
  ensuredUserIds().add(userId);
};

/**
 * Ensure the users row exists (first write from a new account creates it)
 * and return the userId. Throws when unauthenticated — middleware should
 * have rejected the request already, so this is a backstop.
 */
export const requireUser = async (): Promise<string> => {
  const userId = await currentUserId();
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  await ensureUserRow(userId);
  return userId;
};
