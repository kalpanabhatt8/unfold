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
 * Ensure the users row exists (first write from a new account creates it)
 * and return the userId. Throws when unauthenticated — middleware should
 * have rejected the request already, so this is a backstop.
 */
export const requireUser = async (): Promise<string> => {
  const userId = await currentUserId();
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  await db.user.upsert({
    where: { id: userId },
    create: { id: userId },
    update: {},
  });
  return userId;
};
