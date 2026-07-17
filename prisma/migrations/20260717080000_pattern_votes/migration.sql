-- CreateTable
CREATE TABLE "pattern_votes" (
    "user_id" TEXT NOT NULL,
    "pattern_name" TEXT NOT NULL,
    "entry_ids" TEXT[],
    "vote" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pattern_votes_pkey" PRIMARY KEY ("user_id","pattern_name")
);

-- AddForeignKey
ALTER TABLE "pattern_votes" ADD CONSTRAINT "pattern_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
