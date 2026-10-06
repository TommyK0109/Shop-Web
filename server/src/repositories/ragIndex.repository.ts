import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export interface ClaimedIndexJob {
  productId: string;
  desiredRevision: number;
  claimToken: string;
  attemptCount: number;
}

/** Call only inside the same transaction as the source mutation. */
export async function enqueueProductIndex(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO rag_index_jobs (product_id, desired_revision, state, attempt_count, next_attempt_at, created_at, updated_at)
    SELECT id, rag_revision, 'pending', 0, NOW(), NOW(), NOW() FROM products WHERE id = ${productId} AND status <> 'archived'
    ON CONFLICT (product_id) DO UPDATE SET desired_revision = GREATEST(rag_index_jobs.desired_revision, EXCLUDED.desired_revision),
      state = 'pending', attempt_count = 0, next_attempt_at = NOW(), claim_token = NULL,
      lease_until = NULL, last_error_code = NULL, updated_at = NOW()`;
}

export async function removeProductIndex(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  await tx.productRagDocument.deleteMany({ where: { productId } });
  await tx.ragIndexJob.deleteMany({ where: { productId } });
}

export async function removeSellerIndex(tx: Prisma.TransactionClient, sellerId: string): Promise<void> {
  await tx.productRagDocument.deleteMany({ where: { product: { sellerId } } });
  await tx.ragIndexJob.deleteMany({ where: { product: { sellerId } } });
}

export async function enqueueSellerProducts(tx: Prisma.TransactionClient, sellerId: string): Promise<void> {
  const products = await tx.product.findMany({ where: { sellerId, status: { not: "archived" } }, select: { id: true } });
  for (const product of products) await enqueueProductIndex(tx, product.id);
}

export async function updateCategoryProductsIndex(tx: Prisma.TransactionClient, categoryId: string): Promise<void> {
  // Updating Product first establishes the same lock order as source writes and publication.
  await tx.product.updateMany({ where: { categoryId }, data: { ragRevision: { increment: 1 } } });
  const products = await tx.product.findMany({ where: { categoryId, status: { not: "archived" } }, select: { id: true } });
  for (const product of products) await enqueueProductIndex(tx, product.id);
}

export async function claimIndexJob(leaseMs: number, productId?: string): Promise<ClaimedIndexJob | null> {
  const token = randomUUID();
  const rows = await prisma.$queryRaw<ClaimedIndexJob[]>`
    WITH next_job AS (
      SELECT j.product_id FROM rag_index_jobs j
      WHERE ((j.state = 'pending' AND j.next_attempt_at <= NOW())
         OR (j.state = 'processing' AND j.lease_until <= NOW()))
        ${productId ? Prisma.sql`AND j.product_id = ${productId}` : Prisma.empty}
      ORDER BY j.next_attempt_at, j.product_id
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE rag_index_jobs j SET state = 'processing', claim_token = ${token},
      lease_until = NOW() + (${leaseMs} * INTERVAL '1 millisecond'),
      attempt_count = j.attempt_count + 1, updated_at = NOW()
    FROM next_job n WHERE j.product_id = n.product_id
    RETURNING j.product_id AS "productId", j.desired_revision AS "desiredRevision",
      j.claim_token AS "claimToken", j.attempt_count AS "attemptCount"`;
  return rows[0] ?? null;
}

export async function completeSkippedJob(job: ClaimedIndexJob): Promise<void> {
  await prisma.ragIndexJob.deleteMany({ where: { productId: job.productId, claimToken: job.claimToken } });
}

export async function failIndexJob(job: ClaimedIndexJob, errorCode: string, retryable: boolean): Promise<void> {
  const retry = retryable && job.attemptCount < 5;
  const delayMs = Math.min(300000, 1000 * 2 ** job.attemptCount) + Math.floor(Math.random() * 1000);
  await prisma.ragIndexJob.updateMany({
    where: { productId: job.productId, claimToken: job.claimToken },
    data: { state: retry ? "pending" : "failed", claimToken: null, leaseUntil: null,
      lastErrorCode: errorCode, nextAttemptAt: new Date(Date.now() + delayMs), updatedAt: new Date() },
  });
}

export async function publishIndexDocument(job: ClaimedIndexJob, document: {
  text: string; contentHash: string; embeddingModel: string; vector: number[];
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Seller status changes lock Seller before removing derived rows. The same
    // ordering prevents a worker from reinserting a document after suspension.
    const owners = await tx.$queryRaw<Array<{ sellerId: string }>>`
      SELECT seller_id AS "sellerId" FROM products WHERE id = ${job.productId}`;
    if (!owners.length) return false;
    const sellers = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status::text FROM sellers WHERE id = ${owners[0].sellerId} FOR SHARE`;
    const products = await tx.$queryRaw<Array<{ ragRevision: number; status: string }>>`
      SELECT rag_revision AS "ragRevision", status::text FROM products WHERE id = ${job.productId} FOR UPDATE`;
    const ownedJobs = await tx.$queryRaw<Array<{ productId: string }>>`
      SELECT product_id AS "productId" FROM rag_index_jobs
      WHERE product_id = ${job.productId} AND claim_token = ${job.claimToken}
        AND state = 'processing' AND desired_revision = ${job.desiredRevision} AND lease_until > NOW()
      FOR UPDATE`;
    if (!ownedJobs.length) return false;
    if (sellers[0]?.status !== "approved" || products[0]?.status === "archived") {
      await removeProductIndex(tx, job.productId);
      return false;
    }
    if (products[0]?.ragRevision !== job.desiredRevision) {
      await enqueueProductIndex(tx, job.productId);
      return false;
    }
    const vector = JSON.stringify(document.vector);
    await tx.$executeRaw`
      INSERT INTO product_rag_documents (product_id, document_text, source_revision, content_hash, embedding_model, embedding, indexed_at)
      VALUES (${job.productId}, ${document.text}, ${job.desiredRevision}, ${document.contentHash}, ${document.embeddingModel}, ${vector}::vector, NOW())
      ON CONFLICT (product_id) DO UPDATE SET document_text = EXCLUDED.document_text,
        source_revision = EXCLUDED.source_revision, content_hash = EXCLUDED.content_hash,
        embedding_model = EXCLUDED.embedding_model, embedding = EXCLUDED.embedding, indexed_at = NOW()`;
    await tx.ragIndexJob.deleteMany({ where: { productId: job.productId, claimToken: job.claimToken } });
    return true;
  });
}
