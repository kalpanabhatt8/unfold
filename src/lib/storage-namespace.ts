/**
 * Product storage namespace. Legacy keys used `keeps-`; rename once so existing
 * local/session data survives the rebrand.
 */

export const STORAGE_NS = "unfold";
export const LEGACY_STORAGE_NS = "keeps";

const MIGRATED_FLAG = "unfold-storage-migrated-v1";

function renamePrefixedKeys(storage: Storage, from: string, to: string) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(from)) keys.push(key);
  }
  for (const key of keys) {
    const next = `${to}${key.slice(from.length)}`;
    if (storage.getItem(next) == null) {
      storage.setItem(next, storage.getItem(key) ?? "");
    }
    storage.removeItem(key);
  }
}

/** Idempotent — safe to call from multiple modules on client boot. */
export function migrateKeepsStorageNamespace(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(MIGRATED_FLAG) === "1") return;
    renamePrefixedKeys(window.localStorage, `${LEGACY_STORAGE_NS}-`, `${STORAGE_NS}-`);
    renamePrefixedKeys(window.sessionStorage, `${LEGACY_STORAGE_NS}-`, `${STORAGE_NS}-`);
    window.localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {
    /* private mode / quota */
  }
}

migrateKeepsStorageNamespace();
