"use client";

import { AppLoader } from "@/components/ui/app-loader";
import { useSignOutPending } from "@/lib/sign-out-state";

/** Full-viewport loader while sign-out saves, clears local data, and redirects. */
export function SignOutOverlay() {
  const pending = useSignOutPending();
  if (!pending) return null;
  return <AppLoader />;
}
