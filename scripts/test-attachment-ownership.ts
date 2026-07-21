/**
 * In-process ownership check (no live DB).
 * Mocks journalEntry.findUnique / create to simulate cross-user attach.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/test-attachment-ownership.ts
 */

import { db } from "../src/lib/server/db";
import {
  assertEntryOwnedBy,
  ensureEntryStub,
} from "../src/lib/server/entries";

const OWNER_ID = "user_owner_test";
const ATTACKER_ID = "user_attacker_test";
const ENTRY_ID = "entry-owned-by-owner";

const isForbidden = (error: unknown): boolean =>
  error instanceof Response && error.status === 403;

async function expectForbidden(
  label: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  try {
    await fn();
    console.error(`FAIL ${label}: expected 403, resolved ok`);
    return false;
  } catch (error) {
    if (!isForbidden(error)) {
      console.error(`FAIL ${label}: expected 403 Response, got`, error);
      return false;
    }
    console.log(`PASS ${label}: rejected with 403`);
    return true;
  }
}

async function expectOk(label: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    console.log(`PASS ${label}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${label}:`, error);
    return false;
  }
}

async function main() {
  const rows = new Map<string, { userId: string }>([
    [ENTRY_ID, { userId: OWNER_ID }],
  ]);
  let createCalls = 0;

  const findUnique = db.journalEntry.findUnique.bind(db.journalEntry);
  const create = db.journalEntry.create.bind(db.journalEntry);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db.journalEntry as any).findUnique = async (args: {
    where: { id: string };
  }) => {
    const row = rows.get(args.where.id);
    return row ? { userId: row.userId } : null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db.journalEntry as any).create = async (args: {
    data: { id: string; userId: string };
  }) => {
    createCalls += 1;
    rows.set(args.data.id, { userId: args.data.userId });
    return args.data;
  };

  try {
    const results = [
      await expectForbidden("assertEntryOwnedBy (attacker)", () =>
        assertEntryOwnedBy(ATTACKER_ID, ENTRY_ID),
      ),
      await expectForbidden("ensureEntryStub (attacker)", () =>
        ensureEntryStub(ATTACKER_ID, ENTRY_ID),
      ),
      await expectOk("assertEntryOwnedBy (owner)", () =>
        assertEntryOwnedBy(OWNER_ID, ENTRY_ID),
      ),
      await expectOk("ensureEntryStub (owner, existing)", () =>
        ensureEntryStub(OWNER_ID, ENTRY_ID),
      ),
    ];

    // Missing entry may be stubbed by the owner.
    const missingId = "entry-brand-new";
    const stubOk = await expectOk("ensureEntryStub (owner, missing)", () =>
      ensureEntryStub(OWNER_ID, missingId),
    );
    results.push(stubOk);

    if (createCalls !== 1) {
      console.error(
        `FAIL expected exactly 1 create for missing stub, got ${createCalls}`,
      );
      results.push(false);
    } else {
      console.log("PASS stub create only for missing owned path");
      results.push(true);
    }

    // Attacker must not have mutated ownership of the owner's entry.
    if (rows.get(ENTRY_ID)?.userId !== OWNER_ID) {
      console.error("FAIL owner entry userId was changed");
      results.push(false);
    } else {
      console.log("PASS owner entry untouched");
      results.push(true);
    }

    const pass = results.every(Boolean);
    console.log(pass ? "\nALL PASSED" : "\nFAILED");
    process.exitCode = pass ? 0 : 1;
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.journalEntry as any).findUnique = findUnique;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.journalEntry as any).create = create;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
