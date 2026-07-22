import type { UserResource } from "@clerk/types";

const PREFERRED_NAME_KEY = "preferredName";

type MetadataRecord = Record<string, unknown>;

function readPreferredName(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as MetadataRecord)[PREFERRED_NAME_KEY];
  return typeof value === "string" ? value.trim() : "";
}

/** Display name for chrome (sidebar, account). Prefers app-owned metadata. */
export function resolvePreferredName(
  user: Pick<
    UserResource,
    "unsafeMetadata" | "firstName" | "lastName" | "fullName" | "username"
  > | null | undefined,
): string {
  if (!user) return "";

  const fromMeta = readPreferredName(user.unsafeMetadata);
  if (fromMeta) return fromMeta;

  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;

  const fromFull = user.fullName?.trim();
  if (fromFull) return fromFull;

  return user.username?.trim() ?? "";
}

/** First letter for avatar fallback — always uppercase. */
export function avatarInitial(source: string | null | undefined): string {
  const word = source?.trim().split(/\s+/)[0];
  const letter = word?.[0];
  return letter ? letter.toUpperCase() : "U";
}

export function preferredNameMetadata(
  existing: UserResource["unsafeMetadata"] | null | undefined,
  preferredName: string,
): MetadataRecord {
  const base =
    existing && typeof existing === "object"
      ? { ...(existing as MetadataRecord) }
      : {};
  const trimmed = preferredName.trim();
  if (trimmed) base[PREFERRED_NAME_KEY] = trimmed;
  else delete base[PREFERRED_NAME_KEY];
  return base;
}
