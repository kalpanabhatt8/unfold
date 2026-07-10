-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "display_name" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "last_edited_at" TIMESTAMPTZ(3),
    "sealed_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "search_text" TEXT NOT NULL DEFAULT '',
    "content_hash" TEXT NOT NULL DEFAULT '',
    "content" JSONB,
    "server_updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_analyses" (
    "entry_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topics" TEXT[],
    "patterns" JSONB NOT NULL,
    "model_id" TEXT,
    "prompt_version" TEXT,
    "source_content_hash" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entry_analyses_pkey" PRIMARY KEY ("entry_id")
);

-- CreateTable
CREATE TABLE "pattern_states" (
    "user_id" TEXT NOT NULL,
    "pattern_name" TEXT NOT NULL,
    "lifecycle" TEXT NOT NULL,
    "lifecycle_since" TIMESTAMPTZ(3) NOT NULL,
    "recent_signatures" TEXT[],
    "last_ending_kind" TEXT NOT NULL,
    "plan_epoch" INTEGER NOT NULL,
    "evidence_key" TEXT NOT NULL,
    "last_plan_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pattern_states_pkey" PRIMARY KEY ("user_id","pattern_name")
);

-- CreateTable
CREATE TABLE "pattern_passages" (
    "user_id" TEXT NOT NULL,
    "pattern_name" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "passage" JSONB NOT NULL,
    "model_id" TEXT,
    "prompt_version" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_passages_pkey" PRIMARY KEY ("user_id","pattern_name")
);

-- CreateTable
CREATE TABLE "pattern_displays" (
    "user_id" TEXT NOT NULL,
    "pattern_name" TEXT NOT NULL,
    "evidence_key" TEXT NOT NULL,
    "display_title" TEXT NOT NULL,
    "summary" TEXT,
    "model_id" TEXT,
    "prompt_version" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_displays_pkey" PRIMARY KEY ("user_id","pattern_name","evidence_key")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "ratio" DOUBLE PRECISION,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_entries_user_id_updated_at_idx" ON "journal_entries"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "journal_entries_user_id_server_updated_at_idx" ON "journal_entries"("user_id", "server_updated_at");

-- CreateIndex
CREATE INDEX "journal_entries_user_id_sealed_at_idx" ON "journal_entries"("user_id", "sealed_at");

-- CreateIndex
CREATE INDEX "entry_analyses_user_id_idx" ON "entry_analyses"("user_id");

-- CreateIndex
CREATE INDEX "attachments_entry_id_sort_order_idx" ON "attachments"("entry_id", "sort_order");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_analyses" ADD CONSTRAINT "entry_analyses_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_analyses" ADD CONSTRAINT "entry_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_states" ADD CONSTRAINT "pattern_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_passages" ADD CONSTRAINT "pattern_passages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_displays" ADD CONSTRAINT "pattern_displays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

