-- When pattern artifacts were last fully generated for this account.
-- Compared against the latest sealed entry to avoid redundant Claude runs.
ALTER TABLE "users" ADD COLUMN "patterns_generated_at" TIMESTAMPTZ(3);
