import { Prisma } from "@prisma/client";
import type { RagFilters, RagProduct } from "@storefront/shared";
import { productSpecificationsSchema } from "@storefront/shared";
import { prisma } from "../lib/prisma";
import { env } from "../env";
import { unavailableReason } from "../services/productAvailability.services";
import { validateEmbedding } from "../services/rag/documentBuilder";

export interface AttributeConstraints { microphone?: boolean; wireless?: boolean; connectivity?: string; compatibility?: string[]; kind?: string }
export interface RankedProduct { id: string; score: number }

export async function hybridCandidates(query: string, vector: number[], filters: RagFilters, attributes: AttributeConstraints): Promise<RankedProduct[]> {
  validateEmbedding(vector, env.RAG_EMBEDDING_DIMENSIONS);
  const parts: Prisma.Sql[] = [Prisma.sql`s.status = 'approved'`, Prisma.sql`p.status IN ('active', 'out_of_stock')`,
    Prisma.sql`d.source_revision = p.rag_revision`, Prisma.sql`d.embedding_model = ${env.RAG_EMBEDDING_MODEL}`];
  if (filters.purchasableOnly) parts.push(Prisma.sql`p.status = 'active' AND p.stock_qty >= 1`);
  if (filters.categorySlug) parts.push(Prisma.sql`c.slug = ${filters.categorySlug}`);
  if (filters.sellerId) parts.push(Prisma.sql`p.seller_id = ${filters.sellerId}`);
  if (filters.minPriceCents !== undefined) parts.push(Prisma.sql`p.price_cents >= ${filters.minPriceCents}`);
  if (filters.maxPriceCents !== undefined) parts.push(Prisma.sql`p.price_cents <= ${filters.maxPriceCents}`);
  if (attributes.microphone !== undefined) parts.push(Prisma.sql`p.specifications @> ${JSON.stringify({ microphone: attributes.microphone })}::jsonb`);
  // `kind` is useful as a semantic hint, but a missing optional specification
  // must not make an otherwise relevant listing disappear from discovery.
  if (attributes.connectivity) parts.push(Prisma.sql`p.specifications @> ${JSON.stringify({ connectivity: [attributes.connectivity] })}::jsonb`);
  if (attributes.compatibility?.length) parts.push(Prisma.sql`p.specifications @> ${JSON.stringify({ compatibility: attributes.compatibility })}::jsonb`);
  if (attributes.wireless) parts.push(Prisma.sql`((p.specifications->'connectivity') ?| ARRAY['bluetooth', 'wireless-2.4ghz'])`);
  // Both ranking branches see exactly the same live filters and revision checks.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '4000ms'`;
    return tx.$queryRaw<RankedProduct[]>(Prisma.sql`
      WITH eligible AS MATERIALIZED (
        SELECT p.id, d.search_vector, d.embedding
        FROM product_rag_documents d JOIN products p ON p.id = d.product_id
        JOIN sellers s ON s.id = p.seller_id JOIN categories c ON c.id = p.category_id
        WHERE ${Prisma.join(parts, " AND ")}
      ), lexical AS (
        SELECT id, row_number() OVER (ORDER BY ts_rank_cd(search_vector, websearch_to_tsquery('english', ${query})) DESC, id) AS rank
        FROM eligible WHERE search_vector @@ websearch_to_tsquery('english', ${query})
        ORDER BY ts_rank_cd(search_vector, websearch_to_tsquery('english', ${query})) DESC, id LIMIT 30
      ), semantic AS (
        SELECT id, row_number() OVER (ORDER BY embedding <=> ${JSON.stringify(vector)}::vector, id) AS rank
        FROM eligible ORDER BY embedding <=> ${JSON.stringify(vector)}::vector, id LIMIT 30
      ), ranked AS (
        SELECT id, 1.0 / (60 + rank) AS score FROM lexical UNION ALL
        SELECT id, 1.0 / (60 + rank) AS score FROM semantic
      ) SELECT id, SUM(score)::double precision AS score FROM ranked
        GROUP BY id ORDER BY SUM(score) DESC, id LIMIT 6`);
  }, { timeout: 6000 });
}

/** Explicit select is the privacy boundary: no user/review/contact/payment records. */
export async function hydrateProducts(ids: string[], indexedOnly: boolean): Promise<RagProduct[]> {
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, status: { in: ["active", "out_of_stock"] }, seller: { status: "approved" } },
    select: { id: true, name: true, slug: true, description: true, priceCents: true, stockQty: true, status: true, specifications: true, ragRevision: true,
      category: { select: { id: true, name: true, slug: true } },
      seller: { select: { id: true, businessName: true, slug: true, status: true } },
      images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
      ragDocument: { select: { sourceRevision: true, embeddingModel: true } },
    } });
  const products: RagProduct[] = [];
  for (const row of rows) {
    if (indexedOnly && (row.ragDocument?.sourceRevision !== row.ragRevision || row.ragDocument?.embeddingModel !== env.RAG_EMBEDDING_MODEL)) continue;
    const specifications = productSpecificationsSchema.nullable().safeParse(row.specifications);
    if (!specifications.success || row.description.length > 12000) continue;
    products.push({ id: row.id, name: row.name, slug: row.slug, description: row.description, priceCents: row.priceCents, stockQty: row.stockQty,
      status: row.status as "active" | "out_of_stock", category: row.category,
      seller: { id: row.seller.id, businessName: row.seller.businessName, slug: row.seller.slug },
      imageUrl: row.images[0]?.url ?? null, specifications: specifications.data, sourceRevision: row.ragRevision,
      unavailableReason: unavailableReason(row, 1) });
  }
  return ids.flatMap((id) => products.find((product) => product.id === id) ?? []);
}

export function matchesConstraints(product: RagProduct, filters: RagFilters, attributes: AttributeConstraints): boolean {
  const spec = product.specifications;
  const compatibility = attributes.compatibility;
  return (!filters.purchasableOnly || product.unavailableReason === null) &&
    (!filters.categorySlug || product.category.slug === filters.categorySlug) && (!filters.sellerId || product.seller.id === filters.sellerId) &&
    (filters.minPriceCents === undefined || product.priceCents >= filters.minPriceCents) &&
    (filters.maxPriceCents === undefined || product.priceCents <= filters.maxPriceCents) &&
    (attributes.microphone === undefined || spec?.microphone === attributes.microphone) &&
    // An absent optional `kind` is unknown, not a failed hard constraint.
    (!attributes.kind || spec?.kind === undefined || spec.kind === attributes.kind) &&
    (!attributes.connectivity || spec?.connectivity?.some((value) => value === attributes.connectivity) === true) &&
    (!compatibility?.length || compatibility.every((value) => spec?.compatibility?.some((candidate) => candidate === value) === true)) &&
    (!attributes.wireless || spec?.connectivity?.some((value) => value === "bluetooth" || value === "wireless-2.4ghz") === true);
}
