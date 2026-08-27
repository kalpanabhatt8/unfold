import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { runFullPatternGeneration } from "@/lib/server/pattern-pipeline";

export const runtime = "nodejs";
/** Voice generation for several patterns can take a few minutes. */
export const maxDuration = 300;

const messageForOutcome = (
  reason: string,
): string => {
  switch (reason) {
    case "ready":
      return "Pattern rebuild finished. Open Patterns to view results.";
    case "no_surface":
      return "Entries are analyzed but no recurring pattern is strong enough yet. Keep writing on the same themes across multiple entries.";
    case "skipped":
      return "Patterns are already up to date.";
    case "incomplete":
      return "Rebuild ran but some patterns are still incomplete. Check server logs and retry.";
    case "no_api_key":
      return "Pattern generation is unavailable (missing API key).";
    default:
      return "Pattern rebuild finished.";
  }
};

/**
 * Run server-side analysis + pattern artifacts for the signed-in user.
 * Awaits completion so the browser fetch knows when it is safe to open Patterns.
 */
export async function POST() {
  try {
    const userId = await requireUser();
    const outcome = await runFullPatternGeneration(userId, { bypassGate: true });
    return NextResponse.json({
      ok: outcome.ok,
      reason: outcome.reason,
      displayCount: outcome.displayCount ?? 0,
      message: messageForOutcome(outcome.reason),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[patterns/rebuild] failed", error);
    return NextResponse.json({ error: "Rebuild failed" }, { status: 500 });
  }
}
