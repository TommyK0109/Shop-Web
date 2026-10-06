-- Two changes that go together:
--   1. Products are soft-deleted, so a cart item can never be orphaned by a
--      seller removing a listing (every FK here is ON DELETE RESTRICT, so a
--      real DELETE either failed with a 500 or would have destroyed order
--      history).
--   2. Payment moves from one-per-order (a single ZaloPay gateway charge) to
--      one-per-(order, seller): buyers transfer directly to each store.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "ProductStatus" AS ENUM ('active', 'out_of_stock', 'archived');

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'partially_paid' BEFORE 'paid';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'awaiting_confirmation' BEFORE 'succeeded';

-- ---------------------------------------------------------------------------
-- 2. Products: soft-delete state
-- ---------------------------------------------------------------------------
ALTER TABLE "products"
  ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "out_of_stock_at" TIMESTAMP(3),
  ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "products_status_idx" ON "products"("status");

-- ---------------------------------------------------------------------------
-- 3. Cart integrity
-- ---------------------------------------------------------------------------
ALTER TABLE "cart_items"
  ADD COLUMN "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Collapse any duplicate (cart, product) rows that the old read-then-write
-- add-to-cart could produce, keeping the summed quantity, before the unique
-- index goes on.
UPDATE "cart_items" ci
SET "quantity" = totals.total
FROM (
  SELECT "cart_id", "product_id", SUM("quantity") AS total, MIN("id") AS keep_id
  FROM "cart_items"
  GROUP BY "cart_id", "product_id"
  HAVING COUNT(*) > 1
) totals
WHERE ci."id" = totals.keep_id;

DELETE FROM "cart_items" ci
USING (
  SELECT "cart_id", "product_id", MIN("id") AS keep_id
  FROM "cart_items"
  GROUP BY "cart_id", "product_id"
  HAVING COUNT(*) > 1
) dupes
WHERE ci."cart_id" = dupes."cart_id"
  AND ci."product_id" = dupes."product_id"
  AND ci."id" <> dupes.keep_id;

CREATE UNIQUE INDEX "cart_items_cart_id_product_id_key" ON "cart_items"("cart_id", "product_id");
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

CREATE TABLE "cart_removal_notices" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen_at" TIMESTAMP(3),
    CONSTRAINT "cart_removal_notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cart_removal_notices_cart_id_seen_at_idx" ON "cart_removal_notices"("cart_id", "seen_at");

ALTER TABLE "cart_removal_notices" ADD CONSTRAINT "cart_removal_notices_cart_id_fkey"
  FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cart_removal_notices" ADD CONSTRAINT "cart_removal_notices_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Seller payment methods
-- ---------------------------------------------------------------------------
CREATE TABLE "seller_payment_methods" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "bank_bin" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seller_payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_payment_methods_seller_id_key" ON "seller_payment_methods"("seller_id");

ALTER TABLE "seller_payment_methods" ADD CONSTRAINT "seller_payment_methods_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every existing seller gets mock bank details, so historical orders can be
-- expanded into per-seller payments below and so the demo catalog is
-- immediately payable. Bank is picked round-robin from the real Napas BIN
-- list; the account number is synthetic.
INSERT INTO "seller_payment_methods" ("id", "seller_id", "bank_bin", "bank_name", "account_number", "account_name")
SELECT
  gen_random_uuid()::text,
  s."id",
  banks.bin,
  banks.name,
  -- 10 synthetic digits, stable per seller so re-running the seed does not
  -- reshuffle what a buyer already scanned.
  LPAD((('x' || SUBSTR(MD5(s."id"), 1, 8))::bit(32)::bigint % 1000000000)::text, 10, '0'),
  UPPER(s."business_name")
FROM "sellers" s
CROSS JOIN LATERAL (
  SELECT bin, name FROM (
    VALUES
      (0, '970436', 'Vietcombank'),
      (1, '970418', 'BIDV'),
      (2, '970405', 'Agribank'),
      (3, '970415', 'VietinBank'),
      (4, '970422', 'MB Bank'),
      (5, '970407', 'Techcombank'),
      (6, '970423', 'TPBank'),
      (7, '970432', 'VPBank'),
      (8, '970403', 'Sacombank'),
      (9, '970416', 'ACB')
  ) AS t(idx, bin, name)
  WHERE t.idx = ABS(('x' || SUBSTR(MD5(s."id"), 1, 8))::bit(32)::int) % 10
) banks;

-- ---------------------------------------------------------------------------
-- 5. Payments: one per order -> one per (order, seller)
-- ---------------------------------------------------------------------------
CREATE TABLE "payments_new" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "bank_bin" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marked_paid_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    CONSTRAINT "payments_new_pkey" PRIMARY KEY ("id")
);

-- Expand each old order-wide payment into one row per seller in that order,
-- splitting the amount by that seller's own line items and carrying the old
-- settlement state across.
INSERT INTO "payments_new" (
  "id", "order_id", "seller_id", "amount_cents", "reference", "status",
  "bank_bin", "bank_name", "account_number", "account_name", "confirmed_at"
)
SELECT
  gen_random_uuid()::text,
  oi."order_id",
  oi."seller_id",
  SUM(oi."unit_price_cents" * oi."quantity")::int,
  -- Same shape the application generates: SF-<8 hex>.
  'SF-' || UPPER(SUBSTR(MD5(oi."order_id" || oi."seller_id"), 1, 8)),
  COALESCE(p."status", 'pending'),
  spm."bank_bin",
  spm."bank_name",
  spm."account_number",
  spm."account_name",
  CASE WHEN p."status" = 'succeeded' THEN o."created_at" ELSE NULL END
FROM "order_items" oi
JOIN "orders" o ON o."id" = oi."order_id"
JOIN "seller_payment_methods" spm ON spm."seller_id" = oi."seller_id"
LEFT JOIN "payments" p ON p."order_id" = oi."order_id"
GROUP BY oi."order_id", oi."seller_id", p."status", o."created_at",
         spm."bank_bin", spm."bank_name", spm."account_number", spm."account_name";

DROP TABLE "payments";
ALTER TABLE "payments_new" RENAME TO "payments";
ALTER TABLE "payments" RENAME CONSTRAINT "payments_new_pkey" TO "payments_pkey";

CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");
CREATE UNIQUE INDEX "payments_order_id_seller_id_key" ON "payments"("order_id", "seller_id");
CREATE INDEX "payments_seller_id_status_idx" ON "payments"("seller_id", "status");
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. Indexes the new per-seller queries depend on
-- ---------------------------------------------------------------------------
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX "order_items_seller_id_idx" ON "order_items"("seller_id");
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");
