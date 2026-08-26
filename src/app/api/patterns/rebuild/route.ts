import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { runFullPatternGeneration } from "@/lib/server/pattern-pipeline";

export const runtime = "nodejs";
/** Voice generation for several patterns can take a few minutes. */
export const maxDuration = 300;

/**
 * Run server-side analysis + pattern artifacts for the signed-in user.
 * Awaits completion so the browser fetch knows when it is safe to open Patterns.
 */
export async function POST() {
  try {
    const userId = await requireUser();
    const ok = await runFullPatternGeneration(userId, { bypassGate: true });
    return NextResponse.json({
      ok,
      message: ok
        ? "Pattern rebuild finished. Open Patterns to view results."
        : "Rebuild ran but some patterns are still incomplete (voice text missing). Check server logs and retry.",
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[patterns/rebuild] failed", error);
    return NextResponse.json({ error: "Rebuild failed" }, { status: 500 });
  }
}
