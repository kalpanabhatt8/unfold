/**
 * One-time localStorage → cloud import.
 *
 * Entries arrive one per request (base64 images make payloads large). Any
 * base64 data URL inside the snapshot is uploaded to blob storage and
 * rewritten to an attachment URL before the row is written, so Postgres never
 * stores image bytes.
 */

import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import { createAttachment } from "@/lib/server/attachments";
import { pushEntries } from "@/lib/server/entries";
import type { WireEntry } from "@/lib/sync/wire-types";

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

const rewriteImages = async (
  userId: string,
  entryId: string,
  snapshot: CanvasSnapshot,
): Promise<CanvasSnapshot> => {
  const imageBlocks = [...snapshot.imageBlocks];

  for (let i = 0; i < imageBlocks.length; i += 1) {
    const image = imageBlocks[i];
    const match = DATA_URL_PATTERN.exec(image.src);
    if (!match) continue;

    try {
      const [, mimeType, base64] = match;
      const stored = await createAttachment({
        userId,
        entryId,
        bytes: Buffer.from(base64, "base64"),
        mimeType,
        ratio: image.ratio,
        caption: image.caption ?? null,
        sortOrder: image.order ?? i,
      });
      imageBlocks[i] = { ...image, src: stored.url };
    } catch (error) {
      // Blob storage unavailable — keep the data URL so no image is lost;
      // a future save re-attempts the rewrite.
      console.error("[import] image upload failed, keeping data URL", error);
    }
  }

  return { ...snapshot, imageBlocks };
};

export const importEntry = async (
  userId: string,
  entry: WireEntry,
): Promise<void> => {
  const content = entry.content
    ? await rewriteImages(userId, entry.id, entry.content)
    : null;
  await pushEntries(userId, [{ ...entry, content }]);
};
