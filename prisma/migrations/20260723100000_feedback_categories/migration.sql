-- Structured feedback chips from the account-menu modal.
ALTER TABLE "feedback" ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "feedback" ALTER COLUMN "text" SET DEFAULT '';
