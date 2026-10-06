import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { buildProductDocument } from "../src/services/rag/documentBuilder";
import { processNextIndexJob } from "../src/services/rag/indexing";
import { claimIndexJob, enqueueProductIndex, publishIndexDocument, removeProductIndex, removeSellerIndex, updateCategoryProductsIndex } from "../src/repositories/ragIndex.repository";
import { cleanupCategory, cleanupSeller, createApprovedSeller, createCategory, createProductForSeller } from "./fixtures";

const model = "gemini-embedding-2";
const vector = Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0);

describe("durable RAG indexing with PostgreSQL", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let owner: Awaited<ReturnType<typeof createApprovedSeller>>;
  beforeAll(async () => { category = await createCategory(); owner = await createApprovedSeller(); });
  afterAll(async () => {
    if (owner) await cleanupSeller(owner.seller.id, owner.user.id);
    if (category) await cleanupCategory(category.id);
  });

  async function queued() {
    const product = await createProductForSeller(owner.seller.id, category.id);
    await prisma.$transaction((tx) => enqueueProductIndex(tx, product.id));
    return product;
  }
  const options = (productId: string) => ({ productId, model, dimensions: 1536, embed: async () => [vector] });

  it("rolls enqueue back with the product mutation", async () => {
    const product = await createProductForSeller(owner.seller.id, category.id);
    await expect(prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: product.id }, data: { name: "Rolled back", ragRevision: { increment: 1 } } });
      await enqueueProductIndex(tx, product.id);
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    expect(await prisma.ragIndexJob.findUnique({ where: { productId: product.id } })).toBeNull();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).ragRevision).toBe(1);
  });

  it("coalesces repeated edits and publishes vector and generated full-text fields", async () => {
    const product = await queued();
    for (let i = 0; i < 2; i++) await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: product.id }, data: { name: `USB microphone ${i}`, ragRevision: { increment: 1 } } });
      await enqueueProductIndex(tx, product.id);
    });
    expect(await prisma.ragIndexJob.count({ where: { productId: product.id } })).toBe(1);
    expect(await processNextIndexJob(options(product.id))).toBe("indexed");
    const docs = await prisma.$queryRaw<Array<{ revision: number; dimensions: number; matches: boolean }>>`
      SELECT source_revision AS revision, vector_dims(embedding) AS dimensions,
        search_vector @@ plainto_tsquery('english', 'microphone') AS matches
      FROM product_rag_documents WHERE product_id = ${product.id}`;
    expect(docs[0]).toEqual({ revision: 3, dimensions: 1536, matches: true });
    expect(await prisma.ragIndexJob.findUnique({ where: { productId: product.id } })).toBeNull();
  });

  it("allows only one competing claim and recovers an expired lease", async () => {
    const product = await queued();
    const claims = await Promise.all([claimIndexJob(60000, product.id), claimIndexJob(60000, product.id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const first = claims.find(Boolean)!;
    await prisma.ragIndexJob.update({ where: { productId: product.id }, data: { leaseUntil: new Date(0) } });
    const reclaimed = await claimIndexJob(60000, product.id);
    expect(reclaimed?.claimToken).not.toBe(first.claimToken);
    expect(reclaimed?.attemptCount).toBe(2);
    const document = buildProductDocument({ ...product, category });
    expect(await publishIndexDocument(first, { ...document, vector, embeddingModel: model })).toBe(false);
    expect(await publishIndexDocument(reclaimed!, { ...document, vector, embeddingModel: model })).toBe(true);
  });

  it("keeps a newer source edit pending while an older embedding is in flight", async () => {
    const product = await queued();
    let release!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const work = processNextIndexJob({ ...options(product.id), embed: async () => { started(); await barrier; return [vector]; } });
    await ready;
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: product.id }, data: { name: "Latest microphone", ragRevision: { increment: 1 } } });
      await enqueueProductIndex(tx, product.id);
    });
    release();
    expect(await work).toBe("skipped");
    expect(await prisma.productRagDocument.findUnique({ where: { productId: product.id } })).toBeNull();
    expect(await prisma.ragIndexJob.findUnique({ where: { productId: product.id } })).toMatchObject({ state: "pending", desiredRevision: 2 });
    expect(await processNextIndexJob(options(product.id))).toBe("indexed");
  });

  it("cannot resurrect a product archived during embedding", async () => {
    const product = await queued();
    const outcome = await processNextIndexJob({ ...options(product.id), embed: async () => {
      await prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id: product.id }, data: { status: "archived" } });
        await removeProductIndex(tx, product.id);
      });
      return [vector];
    } });
    expect(outcome).toBe("skipped");
    expect(await prisma.productRagDocument.findUnique({ where: { productId: product.id } })).toBeNull();
  });

  it("cannot resurrect a seller suspended during embedding", async () => {
    const product = await queued();
    try {
      expect(await processNextIndexJob({ ...options(product.id), embed: async () => {
        await prisma.$transaction(async (tx) => {
          await tx.seller.update({ where: { id: owner.seller.id }, data: { status: "suspended" } });
          await removeSellerIndex(tx, owner.seller.id);
        });
        return [vector];
      } })).toBe("skipped");
      expect(await prisma.productRagDocument.count({ where: { product: { sellerId: owner.seller.id } } })).toBe(0);
    } finally {
      await prisma.seller.update({ where: { id: owner.seller.id }, data: { status: "approved" } });
    }
  });

  it("marks repeated transient failures and invalid vectors for inspection", async () => {
    const product = await queued();
    for (let i = 0; i < 5; i++) {
      expect(await processNextIndexJob({ ...options(product.id), embed: async () => { throw new Error("private provider body"); } })).toBe("failed");
      await prisma.ragIndexJob.update({ where: { productId: product.id }, data: { nextAttemptAt: new Date(0) } });
    }
    expect(await prisma.ragIndexJob.findUnique({ where: { productId: product.id } })).toMatchObject({ state: "failed", attemptCount: 5, lastErrorCode: "INDEX_DEPENDENCY_FAILURE" });
    const invalid = await queued();
    expect(await processNextIndexJob({ ...options(invalid.id), embed: async () => [[1, 2]] })).toBe("failed");
    expect(await prisma.ragIndexJob.findUnique({ where: { productId: invalid.id } })).toMatchObject({ state: "failed", lastErrorCode: "INVALID_EMBEDDING" });
  });

  it("increments source revisions and queues every affected product on category rename", async () => {
    const product = await queued();
    await processNextIndexJob(options(product.id));
    await prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id: category.id }, data: { name: "Renamed Electronics" } });
      await updateCategoryProductsIndex(tx, category.id);
    });
    const current = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    const document = await prisma.productRagDocument.findUniqueOrThrow({ where: { productId: product.id } });
    expect(current.ragRevision).toBe(2);
    expect(document.sourceRevision).toBe(1);
    expect(await prisma.ragIndexJob.findUnique({ where: { productId: product.id } })).toMatchObject({ state: "pending", desiredRevision: 2 });
  });
});
