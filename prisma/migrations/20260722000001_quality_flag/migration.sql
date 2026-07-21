-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN "quality_flagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "journal_entries" ADD COLUMN "quality_flagged_at" TIMESTAMPTZ(3);
