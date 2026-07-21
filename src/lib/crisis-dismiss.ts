/**
 * Local dismiss for CrisisResponse — survives reload so returning to a
 * flagged entry does not feel like a lock-out after the user chose to go back.
 * Does not clear crisisFlagged on the entry itself.
 */

const DISMISS_PREFIX = "keeps-crisis-dismissed:";

export function isCrisisDismissed(entryId: string): boolean {
  if (typeof window === "undefined" || !entryId) return false;
  try {
    return window.localStorage.getItem(`${DISMISS_PREFIX}${entryId}`) === "1";
  } catch {
    return false;
  }
}

export function dismissCrisisView(entryId: string): void {
  if (typeof window === "undefined" || !entryId) return;
  try {
    window.localStorage.setItem(`${DISMISS_PREFIX}${entryId}`, "1");
  } catch {
    // ignore quota / private mode
  }
}
