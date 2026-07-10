import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { pullPatterns, pushPatterns } from "@/lib/server/patterns";
import type { PatternsSnapshot } from "@/lib/sync/wire-types";

export const runtime = "nodejs";

/** Pull the full pattern layer (small: analyses + ≤10 states/passages/displays). */
export async function GET() {
  try {
    const userId = await requireUser();
    return NextResponse.json(await pullPatterns(userId));
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[sync/patterns] pull failed", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

/** Push any subset of the pattern layer (client-authoritative upserts). */
export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const body = (await request.json()) as Partial<PatternsSnapshot>;
    const written = await pushPatterns(userId, body);
    return NextResponse.json({ written });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[sync/patterns] push failed", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
