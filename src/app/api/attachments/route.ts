import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { createAttachment } from "@/lib/server/attachments";

export const runtime = "nodejs";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Upload one image. Multipart form: `file` (image), `entryId`, optional
 * `ratio` + `caption`. Returns { id, url } — the canvas embeds `url` in the
 * snapshot instead of a base64 data URL.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireUser();

    const form = await request.formData();
    const file = form.get("file");
    const entryId = form.get("entryId");

    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Expected an image file" }, { status: 400 });
    }
    if (typeof entryId !== "string" || !entryId) {
      return NextResponse.json({ error: "Missing entryId" }, { status: 400 });
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const ratioRaw = form.get("ratio");
    const ratio =
      typeof ratioRaw === "string" && Number.isFinite(Number(ratioRaw))
        ? Number(ratioRaw)
        : null;
    const captionRaw = form.get("caption");

    const stored = await createAttachment({
      userId,
      entryId,
      bytes: await file.arrayBuffer(),
      mimeType: file.type,
      ratio,
      caption: typeof captionRaw === "string" ? captionRaw : null,
    });

    return NextResponse.json(stored);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[attachments] upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
