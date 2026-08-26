"use client";

/**
 * Tracks an in-flight sign-out so dashboard chrome (sidebar entries) can show a
 * loader instead of an empty list while local data is wiped and Clerk redirects.
 */

import { useLayoutEffect, useState } from "react";

export const SIGN_OUT_PENDING_EVENT = "unfold-sign-out-pending";

let signOutPending = false;

export function beginSignOut(): void {
  if (signOutPending) return;
  signOutPending = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIGN_OUT_PENDING_EVENT));
  }
}

export function isSignOutPending(): boolean {
  return signOutPending;
}

export function useSignOutPending(): boolean {
  const [pending, setPending] = useState(false);

  useLayoutEffect(() => {
    const refresh = () => setPending(isSignOutPending());
    refresh();
    window.addEventListener(SIGN_OUT_PENDING_EVENT, refresh);
    return () => window.removeEventListener(SIGN_OUT_PENDING_EVENT, refresh);
  }, []);

  return pending;
}
