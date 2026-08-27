import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { listReadyPatternsForUser } from "@/lib/server/list-ready-patterns";

export const runtime = "nodejs";

/** Read server-ready patterns — generation is triggered by POST /api/patterns/rebuild. */
export async function GET() {
  try {
    const userId = await requireUser();
    const payload = await listReadyPatternsForUser(userId);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[patterns/ready] failed", error);
    return NextResponse.json({ error: "Failed to load patterns" }, { status: 500 });
  }
}
