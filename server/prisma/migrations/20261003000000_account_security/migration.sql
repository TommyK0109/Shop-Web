ALTER TABLE "users"
  ADD COLUMN "avatar_url" TEXT,
  ADD COLUMN "avatar_public_id" TEXT,
  ADD COLUMN "email_verified_at" TIMESTAMP(3),
  ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "email_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "email_tokens_token_hash_key" ON "email_tokens"("token_hash");
CREATE INDEX "email_tokens_user_id_purpose_idx" ON "email_tokens"("user_id", "purpose");
CREATE INDEX "email_tokens_expires_at_idx" ON "email_tokens"("expires_at");
