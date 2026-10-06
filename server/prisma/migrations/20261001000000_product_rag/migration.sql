-- Additive migration. pgvector must be installed on the PostgreSQL 16 host.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "products" ADD COLUMN "specifications" JSONB;
ALTER TABLE "products" ADD COLUMN "rag_revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "product_rag_documents" (
  "product_id" TEXT PRIMARY KEY REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "document_text" TEXT NOT NULL,
  "source_revision" INTEGER NOT NULL,
  "content_hash" TEXT NOT NULL,
  "embedding_model" TEXT NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, "document_text")) STORED,
  "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "product_rag_documents_search_vector_idx" ON "product_rag_documents" USING GIN ("search_vector");

CREATE TABLE "rag_index_jobs" (
  "product_id" TEXT PRIMARY KEY REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "desired_revision" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending' CHECK ("state" IN ('pending', 'processing', 'failed')),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claim_token" TEXT,
  "lease_until" TIMESTAMP(3),
  "last_error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "rag_index_jobs_state_next_attempt_at_idx" ON "rag_index_jobs" ("state", "next_attempt_at");

CREATE TABLE "rag_provider_days" (
  "day" TEXT PRIMARY KEY,
  "calls" INTEGER NOT NULL DEFAULT 0,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0
);
