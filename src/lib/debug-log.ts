/**
 * Client/server debug logging — on by default in local development, always
 * silent in production (hard deny). No .env flag required for local visibility.
 */

/** Production builds / Vercel production — never log debug content. */
export function isDebugLoggingHardDenied(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.VERCEL_ENV === "production") return true;
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") return true;
  return false;
}

/** True when passage / pipeline debug console output should print. */
export function isDebugLoggingEnabled(): boolean {
  if (isDebugLoggingHardDenied()) return false;
  return process.env.NODE_ENV === "development";
}

export function debugLog(...args: unknown[]): void {
  if (!isDebugLoggingEnabled()) return;
  console.log(...args);
}

export function debugWarn(...args: unknown[]): void {
  if (!isDebugLoggingEnabled()) return;
  console.warn(...args);
}

export function debugInfo(...args: unknown[]): void {
  if (!isDebugLoggingEnabled()) return;
  console.info(...args);
}

export function debugGroup(...args: unknown[]): void {
  if (!isDebugLoggingEnabled()) return;
  console.group(...args);
}

export function debugGroupEnd(): void {
  if (!isDebugLoggingEnabled()) return;
  console.groupEnd();
}

export function debugTable(data: unknown): void {
  if (!isDebugLoggingEnabled()) return;
  console.table(data);
}
