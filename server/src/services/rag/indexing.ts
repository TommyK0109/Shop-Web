import type { Prisma, Product } from "@prisma/client";
import { Prisma as PrismaValues } from "@prisma/client";
import { createProductSchema, supportsProductSpecifications, type UpdateProductInput } from "@storefront/shared";
import { env } from "../../env";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/errorHandler.middleware";
import { buildProductDocument, validateEmbedding } from "./documentBuilder";
import { getEmbeddingProvider } from "./providers";
import { claimIndexJob, completeSkippedJob, enqueueProductIndex, failIndexJob, publishIndexDocument } from "../../repositories/ragIndex.repository";

export { enqueueProductIndex, enqueueSellerProducts, removeProductIndex, removeSellerIndex, updateCategoryProductsIndex } from "../../repositories/ragIndex.repository";

export async function lockCategorySource(tx: Prisma.TransactionClient, categoryId: string) {
  await tx.$queryRaw`SELECT id FROM categories WHERE id = ${categoryId} FOR SHARE`;
  const category = await tx.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError(400, "Category not found");
  return category;
}

export async function lockProductSource(tx: Prisma.TransactionClient, id: string, categoryId?: string) {
  const snapshot = await tx.product.findUnique({ where: { id } });
  if (!snapshot) throw new AppError(404, "Product not found");
  // Category rename locks Category before Product. Use the same order so a
  // newly inserted/moved product cannot miss the rename's revision fan-out.
  const categoryIds = [...new Set([snapshot.categoryId, categoryId ?? snapshot.categoryId])].sort();
  for (const category of categoryIds) await lockCategorySource(tx, category);
  await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
  const product = await tx.product.findUnique({ where: { id } });
  if (!product) throw new AppError(404, "Product not found");
  if (product.categoryId !== snapshot.categoryId) throw new AppError(409, "Product category changed. Please retry the update.");
  return product;
}

/** Contextual validation runs against the complete PATCH record, not only input fields. */
export function validateProductSource(input: {
  categoryId: string; name: string; description: string; priceCents: number; stockQty: number; specifications?: unknown;
}, categorySlug: string): void {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? "Invalid product");
  if (input.specifications != null && !supportsProductSpecifications(categorySlug)) {
    throw new AppError(400, "Structured specifications are currently supported for Electronics. Clear them before changing category.");
  }
}

export function productWriteData(input: UpdateProductInput): Prisma.ProductUncheckedUpdateInput {
  const { specifications, ...rest } = input;
  return { ...rest, ...(specifications === undefined ? {} : {
    specifications: specifications === null ? PrismaValues.DbNull : specifications,
  }) };
}

export function canonicalSourceChanged(current: Product, input: UpdateProductInput): boolean {
  return (input.name !== undefined && input.name !== current.name) ||
    (input.description !== undefined && input.description !== current.description) ||
    (input.categoryId !== undefined && input.categoryId !== current.categoryId) ||
    (input.specifications !== undefined &&
      JSON.stringify(input.specifications) !== JSON.stringify(current.specifications));
}

export interface IndexWorkerOptions {
  signal?: AbortSignal;
  embed?: (texts: string[], signal?: AbortSignal) => Promise<number[][]>;
  model?: string;
  dimensions?: number;
  leaseMs?: number;
  productId?: string;
}

/** One lease; provider I/O deliberately happens outside all DB transactions. */
export async function processNextIndexJob(options: IndexWorkerOptions = {}): Promise<"idle" | "indexed" | "skipped" | "failed"> {
  const leaseMs = options.leaseMs ?? Math.max(120000, env.RAG_PROVIDER_TIMEOUT_MS * 2);
  const job = await claimIndexJob(leaseMs, options.productId);
  if (!job) return "idle";
  try {
    const product = await prisma.product.findUnique({ where: { id: job.productId },
      include: { category: true, seller: { select: { status: true } } } });
    if (!product || product.status === "archived" || product.seller.status !== "approved") {
      await completeSkippedJob(job);
      return "skipped";
    }
    // A source mutation always replaces the claim; publishing will repeat this
    // check under locks, including visibility and claim ownership.
    if (product.ragRevision !== job.desiredRevision) {
      await prisma.$transaction((tx) => enqueueProductIndex(tx, product.id));
      return "skipped";
    }
    const document = buildProductDocument(product, env.RAG_MAX_SOURCE_BYTES);
    const model = options.model ?? env.RAG_EMBEDDING_MODEL;
    const existing = await prisma.productRagDocument.findUnique({ where: { productId: product.id },
      select: { contentHash: true, embeddingModel: true, sourceRevision: true } });
    if (existing?.contentHash === document.contentHash && existing.embeddingModel === model && existing.sourceRevision === product.ragRevision) {
      await completeSkippedJob(job);
      return "skipped";
    }
    const embed = options.embed ?? ((texts, signal) => getEmbeddingProvider().embed(texts, signal));
    const vectors = await embed([document.text], options.signal);
    validateEmbedding(vectors[0], options.dimensions ?? env.RAG_EMBEDDING_DIMENSIONS);
    if (vectors.length !== 1) throw new Error("INVALID_EMBEDDING");
    return await publishIndexDocument(job, { ...document, embeddingModel: model, vector: vectors[0] }) ? "indexed" : "skipped";
  } catch (error) {
    const code = error instanceof Error && ["SOURCE_TOO_LARGE", "INVALID_EMBEDDING"].includes(error.message)
      ? error.message : "INDEX_DEPENDENCY_FAILURE";
    await failIndexJob(job, code, code === "INDEX_DEPENDENCY_FAILURE");
    return "failed";
  }
}
