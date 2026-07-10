import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { pullEntries, pushEntries } from "@/lib/server/entries";
import type { WireEntry } from "@/lib/sync/wire-types";

export const runtime = "nodejs";

/** Pull: entries changed since the given server-clock cursor (incl. tombstones). */
export async function GET(request: Request) {
  try {
    const userId = await requireUser();
    const sinceRaw = new URL(request.url).searchParams.get("since");
    const since = Number(sinceRaw) || 0;
    return NextResponse.json(await pullEntries(userId, since));
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[sync/entries] pull failed", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

/** Push: batch of locally edited entries, resolved with last-write-wins. */
export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const body = (await request.json()) as { entries?: unknown };
    const entries = Array.isArray(body.entries)
      ? (body.entries as WireEntry[])
      : [];
    const valid = entries.filter(
      (entry) =>
        typeof entry?.id === "string" &&
        entry.id.length > 0 &&
        typeof entry.updatedAt === "number",
    );
    const results = await pushEntries(userId, valid);
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[sync/entries] push failed", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
