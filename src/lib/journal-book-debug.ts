/** Dev-only tracing for journal book pagination / flip. */
export type BookDebugEvent =
  | "flip:start"
  | "flip:blocked"
  | "flip:complete"
  | "flip:stale-timer"
  | "flip:carry-split"
  | "paginate:start"
  | "paginate:blocked"
  | "paginate:left-to-right"
  | "paginate:right-flip"
  | "paginate:cascade-flip"
  | "overflow:editor"
  | "overflow:capacity-plugin"
  | "commit:bounds-not-ready"
  | "commit:local-trim";

let flipSeq = 0;

export function bookDebug(
  event: BookDebugEvent,
  data?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "production") return;
  if (typeof window !== "undefined" && !(window as KeepsBookDebugWindow).__keepsBookDebug) {
    return;
  }

  const payload = {
    t: performance.now().toFixed(1),
    ...(data ?? {}),
  };

  if (event === "flip:start") {
    flipSeq += 1;
    (payload as Record<string, unknown>).flipSeq = flipSeq;
  }

  console.log(`[keeps:book] ${event}`, payload);
}

type KeepsBookDebugWindow = Window & { __keepsBookDebug?: boolean };

/** Enable in browser console: `window.__keepsBookDebug = true` */
export function enableBookDebug(): void {
  if (typeof window !== "undefined") {
    (window as KeepsBookDebugWindow).__keepsBookDebug = true;
    console.log("[keeps:book] debug enabled — type on the journal to trace flips");
  }
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as KeepsBookDebugWindow).__keepsBookDebug =
    (window as KeepsBookDebugWindow).__keepsBookDebug ?? true;
}
