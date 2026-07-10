import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { hasAnyEntries } from "@/lib/server/entries";
import { importEntry } from "@/lib/server/import";
import { pushPatterns } from "@/lib/server/patterns";
import type { ImportPayload, WireEntry } from "@/lib/sync/wire-types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Whether this account already has cloud data (import should be skipped). */
export async function GET() {
  try {
    const userId = await requireUser();
    return NextResponse.json({ hasServerData: await hasAnyEntries(userId) });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[import] status failed", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

/**
 * Import a slice of local data. The client sends entries one per request
 * (base64 images make payloads large) and the pattern layer once at the end.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const body = (await request.json()) as ImportPayload;

    let imported = 0;
    for (const entry of body.entries ?? []) {
      if (typeof (entry as WireEntry)?.id !== "string") continue;
      await importEntry(userId, entry as WireEntry);
      imported += 1;
    }

    const written = body.patterns
      ? await pushPatterns(userId, body.patterns)
      : null;

    return NextResponse.json({ imported, written });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[import] failed", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
