/**
 * Journal entries repository — the source-of-truth table.
 *
 * Conflict model: last-write-wins at whole-entry granularity, decided by the
 * client-clock `updatedAt` (a journal is effectively single-writer). The
 * server clock (`serverUpdatedAt`) is only the pull-sync cursor.
 */

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/server/db";
import type {
  EntriesPullResponse,
  EntryPushResult,
  WireEntry,
} from "@/lib/sync/wire-types";

type EntryRow = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastEditedAt: Date | null;
  sealedAt: Date | null;
  deletedAt: Date | null;
  crisisFlagged: boolean;
  crisisFlaggedAt: Date | null;
  qualityFlagged: boolean;
  qualityFlaggedAt: Date | null;
  searchText: string;
  contentHash: string;
  content: Prisma.JsonValue;
  serverUpdatedAt: Date;
};

const ms = (d: Date | null): number | null => (d ? d.getTime() : null);

const toWire = (row: EntryRow): WireEntry => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
  lastEditedAt: ms(row.lastEditedAt),
  sealedAt: ms(row.sealedAt),
  deletedAt: ms(row.deletedAt),
  crisisFlagged: row.crisisFlagged === true,
  crisisFlaggedAt: ms(row.crisisFlaggedAt),
  qualityFlagged: row.qualityFlagged === true,
  qualityFlaggedAt: ms(row.qualityFlaggedAt),
  searchText: row.deletedAt ? "" : row.searchText,
  contentHash: row.contentHash,
  // Tombstones never carry board JSON — keep the wire payload small.
  content: row.deletedAt
    ? null
    : ((row.content as WireEntry["content"]) ?? null),
});

const date = (n: number | null | undefined): Date | null =>
  typeof n === "number" && Number.isFinite(n) ? new Date(n) : null;

/** Cap each pull page so large boards don't serialize into a multi-second response. */
const PULL_PAGE_SIZE = 40;

/** All rows (incl. tombstones) the client hasn't seen since `since` (server clock). */
export const pullEntries = async (
  userId: string,
  since: number,
): Promise<EntriesPullResponse> => {
  const rows = await db.journalEntry.findMany({
    where: { userId, serverUpdatedAt: { gt: new Date(since) } },
    orderBy: [{ serverUpdatedAt: "asc" }, { id: "asc" }],
    take: PULL_PAGE_SIZE + 1,
  });

  const hasMore = rows.length > PULL_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PULL_PAGE_SIZE) : rows;
  const last = page[page.length - 1];
  // When more pages remain, advance only past this page. When done, jump to
  // wall clock so concurrent writes during the pull aren't skipped forever.
  const cursor = hasMore && last ? last.serverUpdatedAt.getTime() : Date.now();

  return { entries: page.map(toWire), cursor, hasMore };
};

export const hasAnyEntries = async (userId: string): Promise<boolean> => {
  // EXISTS-style: only need to know if one row is present.
  const row = await db.journalEntry.findFirst({
    where: { userId },
    select: { id: true },
  });
  return row !== null;
};

/** Upsert one entry under LWW. Returns whether the incoming copy won. */
const pushOne = async (
  userId: string,
  entry: WireEntry,
): Promise<EntryPushResult> => {
  const existing = await db.journalEntry.findUnique({
    where: { id: entry.id },
  });

  if (existing && existing.userId !== userId) {
    // Entry ID collision across accounts — reject rather than leak/overwrite.
    return { id: entry.id, accepted: false };
  }

  const isTombstone = Boolean(entry.deletedAt);

  // Deletes are permanent: a live push must never clear an existing soft-delete.
  if (existing?.deletedAt && !isTombstone) {
    return { id: entry.id, accepted: false, server: toWire(existing) };
  }

  // Tombstones always win over live content (even if the client clock is behind),
  // so a delete cannot lose a race to a stale post-delete save.
  if (
    !isTombstone &&
    existing &&
    existing.updatedAt.getTime() > entry.updatedAt
  ) {
    return { id: entry.id, accepted: false, server: toWire(existing) };
  }

  // Once flagged on the server, never clear via a push that omits/false the flag.
  const crisisFlagged =
    existing?.crisisFlagged === true || entry.crisisFlagged === true;
  const crisisFlaggedAt = crisisFlagged
    ? (date(entry.crisisFlaggedAt) ??
      existing?.crisisFlaggedAt ??
      new Date())
    : null;

  const qualityFlagged =
    existing?.qualityFlagged === true || entry.qualityFlagged === true;
  const qualityFlaggedAt = qualityFlagged
    ? (date(entry.qualityFlaggedAt) ??
      existing?.qualityFlaggedAt ??
      new Date())
    : null;

  const data = {
    title: entry.title,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
    lastEditedAt: date(entry.lastEditedAt),
    sealedAt: date(entry.sealedAt),
    deletedAt: date(entry.deletedAt),
    crisisFlagged,
    crisisFlaggedAt,
    qualityFlagged,
    qualityFlaggedAt,
    searchText: entry.deletedAt ? "" : entry.searchText,
    contentHash: entry.contentHash,
    content: entry.deletedAt
      ? Prisma.JsonNull
      : ((entry.content ?? Prisma.JsonNull) as Prisma.InputJsonValue),
  };

  await db.journalEntry.upsert({
    where: { id: entry.id },
    create: { id: entry.id, userId, ...data },
    update: data,
  });

  return { id: entry.id, accepted: true };
};

export const pushEntries = async (
  userId: string,
  entries: WireEntry[],
): Promise<EntryPushResult[]> => {
  const results: EntryPushResult[] = [];
  for (const entry of entries) {
    results.push(await pushOne(userId, entry));
  }
  return results;
};

/**
 * Reject if `entryId` already belongs to a different account.
 * Missing rows are allowed (caller may create a stub next).
 */
export const assertEntryOwnedBy = async (
  userId: string,
  entryId: string,
): Promise<void> => {
  const existing = await db.journalEntry.findUnique({
    where: { id: entryId },
    select: { userId: true },
  });
  if (existing && existing.userId !== userId) {
    // Same collision policy as pushOne — never leak/overwrite across accounts.
    throw new Response("Forbidden", { status: 403 });
  }
};

/**
 * Minimal stub so children (attachments) can reference an entry that hasn't
 * synced yet. The real metadata arrives with the next entries push.
 * Refuses to attach to (or no-op on) another user's entryId.
 */
export const ensureEntryStub = async (
  userId: string,
  entryId: string,
): Promise<void> => {
  const existing = await db.journalEntry.findUnique({
    where: { id: entryId },
    select: { userId: true },
  });

  if (existing && existing.userId !== userId) {
    // Same collision policy as pushOne — never leak/overwrite across accounts.
    throw new Response("Forbidden", { status: 403 });
  }
  if (existing) return;

  const now = new Date();
  try {
    await db.journalEntry.create({
      data: {
        id: entryId,
        userId,
        createdAt: now,
        updatedAt: new Date(0), // any client push wins LWW against the stub
      },
    });
  } catch (error) {
    // Concurrent create won the race — confirm we still own the row.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await assertEntryOwnedBy(userId, entryId);
      return;
    }
    throw error;
  }
};
