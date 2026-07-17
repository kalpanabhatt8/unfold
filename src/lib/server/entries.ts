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
  searchText: row.searchText,
  contentHash: row.contentHash,
  content: (row.content as WireEntry["content"]) ?? null,
});

const date = (n: number | null | undefined): Date | null =>
  typeof n === "number" && Number.isFinite(n) ? new Date(n) : null;

/** All rows (incl. tombstones) the client hasn't seen since `since` (server clock). */
export const pullEntries = async (
  userId: string,
  since: number,
): Promise<EntriesPullResponse> => {
  const cursor = Date.now();
  const rows = await db.journalEntry.findMany({
    where: { userId, serverUpdatedAt: { gt: new Date(since) } },
    orderBy: { serverUpdatedAt: "asc" },
  });
  return { entries: rows.map(toWire), cursor };
};

export const hasAnyEntries = async (userId: string): Promise<boolean> => {
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

  const data = {
    title: entry.title,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
    lastEditedAt: date(entry.lastEditedAt),
    sealedAt: date(entry.sealedAt),
    deletedAt: date(entry.deletedAt),
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
 * Minimal stub so children (attachments) can reference an entry that hasn't
 * synced yet. The real metadata arrives with the next entries push.
 */
export const ensureEntryStub = async (
  userId: string,
  entryId: string,
): Promise<void> => {
  const now = new Date();
  await db.journalEntry.upsert({
    where: { id: entryId },
    create: {
      id: entryId,
      userId,
      createdAt: now,
      updatedAt: new Date(0), // any client push wins LWW against the stub
    },
    update: {},
  });
};
