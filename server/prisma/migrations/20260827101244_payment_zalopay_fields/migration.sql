-- AlterTable
ALTER TABLE "payments" DROP COLUMN "stripe_payment_id",
ADD COLUMN     "zalopay_app_trans_id" TEXT,
ADD COLUMN     "zalopay_txn_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_zalopay_app_trans_id_key" ON "payments"("zalopay_app_trans_id");

