/**
 * TEMPORARY — Pattern pipeline debug page.
 * Open at /dashboard/pattern-debug — delete after the experiment.
 * Locked: local flag + Clerk userId allowlist; hard-denied in production (404).
 */

import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { canUseInternalDebugTools } from "@/lib/patterns/pattern-pipeline-debug-access";
import PatternDebugClient from "./pattern-debug-client";

export default async function PatternDebugPage() {
  const { userId } = await auth();
  if (!canUseInternalDebugTools(userId)) {
    notFound();
  }
  return <PatternDebugClient />;
}
