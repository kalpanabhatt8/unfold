/**
 * All /dev/* tools require a signed-in allowlisted account.
 * Production is hard-denied via canUseInternalDebugTools (404).
 */

import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { canUseInternalDebugTools } from "@/lib/patterns/pattern-pipeline-debug-access";

export default async function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!canUseInternalDebugTools(userId)) {
    notFound();
  }
  return children;
}
