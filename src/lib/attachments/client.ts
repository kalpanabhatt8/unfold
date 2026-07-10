/**
 * Client-side attachment upload. Images go to object storage via
 * /api/attachments; the canvas embeds the returned URL in the snapshot
 * instead of a base64 data URL. Returns null on failure (offline, signed
 * out, no blob storage configured) — callers keep the data URL fallback.
 */

export type UploadedAttachment = {
  id: string;
  url: string;
};

export const uploadEntryImage = async (
  entryId: string,
  file: File,
  ratio?: number,
): Promise<UploadedAttachment | null> => {
  try {
    const form = new FormData();
    form.set("file", file);
    form.set("entryId", entryId);
    if (typeof ratio === "number" && Number.isFinite(ratio)) {
      form.set("ratio", String(ratio));
    }

    const response = await fetch("/api/attachments", {
      method: "POST",
      body: form,
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as Partial<UploadedAttachment>;
    if (typeof payload.id !== "string" || typeof payload.url !== "string") {
      return null;
    }
    return { id: payload.id, url: payload.url };
  } catch {
    return null;
  }
};
