import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { listReadyPatternsForUser } from "@/lib/server/list-ready-patterns";

export const runtime = "nodejs";

/** Direct read of server-ready patterns — list UI source of truth fallback. */
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
