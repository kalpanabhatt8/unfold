-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN "crisis_flagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "journal_entries" ADD COLUMN "crisis_flagged_at" TIMESTAMPTZ(3);
