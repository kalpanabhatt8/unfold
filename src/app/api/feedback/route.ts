import { NextResponse } from "next/server";
import {
  isValidFeedbackPayload,
  normalizeFeedbackCategories,
} from "@/lib/feedback";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export const runtime = "nodejs";

/** Soft cap — allow long notes; reject only pathological payloads. */
const MAX_FEEDBACK_CHARS = 4_000;

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const body = (await request.json()) as {
      text?: unknown;
      categories?: unknown;
    };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const categories = normalizeFeedbackCategories(body.categories);

    if (!isValidFeedbackPayload(categories, text)) {
      return NextResponse.json(
        { error: "Pick a category or add a note" },
        { status: 400 },
      );
    }

    if (text.length > MAX_FEEDBACK_CHARS) {
      return NextResponse.json(
        { error: `Keep feedback under ${MAX_FEEDBACK_CHARS} characters` },
        { status: 400 },
      );
    }

    const row = await db.feedback.create({
      data: { userId, categories, text },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      feedbackId: row.id,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[feedback] create failed", error);
    return NextResponse.json({ error: "Couldn’t save feedback" }, { status: 500 });
  }
}
