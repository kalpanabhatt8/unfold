import { after, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import {
  listReadyPatternsForUser,
  shouldSchedulePatternGeneration,
} from "@/lib/server/list-ready-patterns";
import {
  isPatternGenerationInflight,
  runFullPatternGeneration,
} from "@/lib/server/pattern-pipeline";

export const runtime = "nodejs";
/** Pattern generation can take a few minutes when kicked off from this route. */
export const maxDuration = 300;

/** Direct read of server-ready patterns — starts generation automatically when due. */
export async function GET() {
  try {
    const userId = await requireUser();
    const payload = await listReadyPatternsForUser(userId);
    const needsGeneration = shouldSchedulePatternGeneration(payload);

    if (needsGeneration) {
      after(async () => {
        await runFullPatternGeneration(userId, { bypassGate: true });
      });
    }

    return NextResponse.json({
      ...payload,
      generating: needsGeneration || isPatternGenerationInflight(userId),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[patterns/ready] failed", error);
    return NextResponse.json({ error: "Failed to load patterns" }, { status: 500 });
  }
}
