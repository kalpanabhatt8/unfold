/**
 * Attachments repository — image bytes go to Vercel Blob, Postgres keeps the
 * reference + display metadata. Storage key layout: {userId}/{entryId}/{id}.
 */

import { put, del } from "@vercel/blob";
import { db } from "@/lib/server/db";
import { ensureEntryStub } from "@/lib/server/entries";

export type StoredAttachment = {
  id: string;
  url: string;
};

const extensionFor = (mimeType: string): string => {
  const subtype = mimeType.split("/")[1] ?? "bin";
  return subtype.split("+")[0];
};

export const createAttachment = async (params: {
  userId: string;
  entryId: string;
  bytes: ArrayBuffer | Buffer;
  mimeType: string;
  ratio?: number | null;
  caption?: string | null;
  sortOrder?: number;
}): Promise<StoredAttachment> => {
  const { userId, entryId, bytes, mimeType } = params;

  // The entry may not have synced yet — create a stub so the FK holds.
  await ensureEntryStub(userId, entryId);

  const id = crypto.randomUUID();
  const storageKey = `${userId}/${entryId}/${id}.${extensionFor(mimeType)}`;

  const blob = await put(storageKey, bytes as Buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
  });

  await db.attachment.create({
    data: {
      id,
      userId,
      entryId,
      storageKey: blob.pathname,
      url: blob.url,
      mimeType,
      sizeBytes:
        bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.length,
      ratio: params.ratio ?? null,
      caption: params.caption ?? null,
      sortOrder: params.sortOrder ?? 0,
    },
  });

  return { id, url: blob.url };
};

/** Remove blobs for entries that were hard-deleted. Best-effort. */
export const deleteAttachmentBlobs = async (
  userId: string,
  entryId: string,
): Promise<void> => {
  const rows = await db.attachment.findMany({
    where: { userId, entryId },
    select: { url: true },
  });
  if (rows.length === 0) return;
  try {
    await del(rows.map((row) => row.url));
  } catch (error) {
    console.error("Failed to delete attachment blobs", error);
  }
};
