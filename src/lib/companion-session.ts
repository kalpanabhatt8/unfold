const COMPANION_RESPONDED_PREFIX = "keeps-companion-responded-";

const respondedKey = (bookId: string) => `${COMPANION_RESPONDED_PREFIX}${bookId}`;

export const hasCompanionResponded = (bookId: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(respondedKey(bookId)) === "1";
  } catch {
    return false;
  }
};

export const markCompanionResponded = (bookId: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(respondedKey(bookId), "1");
  } catch {
    /* quota / private mode */
  }
};

export const clearCompanionSession = (bookId: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(respondedKey(bookId));
  } catch {
    /* noop */
  }
};
