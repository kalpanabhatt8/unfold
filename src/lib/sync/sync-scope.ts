/**
 * Gate that holds the sync engine until we know which account the local caches
 * belong to.
 *
 * `ensureAuthUserScope` can wipe every `unfold-*` key - drafts, board
 * snapshots, dirty queues and the pull cursor - and it can only run once Clerk
 * has resolved the signed-in user on the client. A sync pass that starts before
 * that has its pulled entries and its cursor erased mid-flight, which leaves
 * the store looking empty to `resolveEntryOpenTarget` and mints a duplicate
 * blank draft on every sign-in.
 *
 * `SyncProvider` opens the gate; nothing else should.
 */

let scopeReady = false;
let readyPromise: Promise<void> | null = null;
let resolveReady: (() => void) | null = null;

export const isSyncScopeReady = (): boolean => scopeReady;

/** Called once Clerk has loaded and the local store has been re-scoped. */
export const markSyncScopeReady = (): void => {
  if (scopeReady) return;
  scopeReady = true;
  resolveReady?.();
  resolveReady = null;
};

/** Resolves as soon as the local store's owning account is known. */
export const waitForSyncScope = async (): Promise<void> => {
  if (scopeReady) return;
  if (!readyPromise) {
    readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
  }
  await readyPromise;
};
