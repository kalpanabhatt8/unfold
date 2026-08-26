import { NextResponse } from "next/server";
import { runBackfillPatternPipeline } from "@/lib/server/pattern-pipeline";

export const runtime = "nodejs";
/** Cron may analyze many entries — allow up to 5 minutes on Vercel Pro. */
export const maxDuration = 300;

const authorizeCron = (request: Request): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
};

/** Vercel cron backfill — only accounts with unprocessed sealed entries. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runBackfillPatternPipeline();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[cron/reconcile-analyses] failed", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
