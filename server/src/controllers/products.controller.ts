import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import type {
  AdminCreateProductInput,
  ProductQueryInput,
  ProductSuggestQueryInput,
  UpdateProductInput,
} from "@storefront/shared";
import { prisma } from "../lib/prisma";
import { uniqueSlug } from "../lib/slug";
import { AppError } from "../middleware/errorHandler.middleware";
import { removeProductFromCarts } from "../services/cartRemoves.services";
import { canonicalSourceChanged, enqueueProductIndex, lockCategorySource, lockProductSource, productWriteData, removeProductIndex, validateProductSource } from "../services/rag/indexing";
import { publicProductWhere, publiclyVisibleStatuses } from "../services/productAvailability.services";
import { bumpCacheVersion, getCacheVersion, getOrSetCache } from "../lib/cache";

const publicProductInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
  category: true,
  seller: { select: { id: true, slug: true, businessName: true, status: true } },
};

// Short TTLs: these are the two highest-traffic reads in the app (every
// storefront and product-page view), but stock, price and status all
// change often enough that a long cache would visibly lag the catalog.
// The version bump on every write below invalidates immediately anyway —
// the TTL only bounds staleness from writes this cache doesn't know about
// (there are none left uninstrumented, but it's a cheap backstop).
const LIST_TTL_SECONDS = 30;
const DETAIL_TTL_SECONDS = 60;
const SUGGEST_TTL_SECONDS = 30;

export async function listProducts(req: Request, res: Response) {
  const { search, categoryId, categorySlug, sellerId, page, limit } = req.query as unknown as ProductQueryInput;

  // Only approved sellers' products are ever publicly listed (§4 of the
  // plan) — pending/rejected/suspended sellers' catalogs stay invisible —
  // and archived listings are soft-deleted, so they are gone from here too.
  // Out-of-stock listings deliberately stay: that is a normal state for a
  // shop to be in, and hiding the page would break every link to it.
  const where: Prisma.ProductWhereInput = { ...publicProductWhere };
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (categorySlug) {
    where.category = { slug: categorySlug };
  }
  if (sellerId) {
    where.sellerId = sellerId;
  }

  const version = await getCacheVersion("products");
  const cacheKey = `products:list:v${version}:${JSON.stringify({ search, categoryId, categorySlug, sellerId, page, limit })}`;

  const result = await getOrSetCache(cacheKey, LIST_TTL_SECONDS, async () => {
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: publicProductInclude,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return { products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  });

  res.json(result);
}

/**
 * GET /api/products/suggestions?q= — navbar typeahead. Deliberately a
 * separate, cheaper query from listProducts rather than that endpoint with
 * limit=5: it selects only what a dropdown row renders (name, price, one
 * image) instead of the full product+seller include, and matches the same
 * `name`-contains rule the list search uses so a suggestion click and a full
 * search for the same keyword never disagree on what matches.
 */
export async function suggestProducts(req: Request, res: Response) {
  const { q, limit } = req.query as unknown as ProductSuggestQueryInput;

  const where: Prisma.ProductWhereInput = {
    ...publicProductWhere,
    name: { contains: q, mode: "insensitive" },
  };

  const version = await getCacheVersion("products");
  const cacheKey = `products:suggest:v${version}:${JSON.stringify({ q, limit })}`;

  const products = await getOrSetCache(cacheKey, SUGGEST_TTL_SECONDS, () =>
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        priceCents: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
      orderBy: { name: "asc" },
      take: limit,
    }),
  );

  res.json({ products });
}

export async function getProductBySlug(req: Request, res: Response) {
  const version = await getCacheVersion("products");
  const product = await getOrSetCache(
    `products:detail:v${version}:${req.params.slug}`,
    DETAIL_TTL_SECONDS,
    () =>
      prisma.product.findUnique({
        where: { slug: req.params.slug },
        include: {
          ...publicProductInclude,
          reviews: {
            orderBy: { createdAt: "desc" },
            include: { user: { select: { id: true, email: true } } },
          },
        },
      }),
  );

  if (
    !product ||
    product.seller.status !== "approved" ||
    !publiclyVisibleStatuses.includes(product.status)
  ) {
    throw new AppError(404, "Product not found");
  }

  res.json({ product });
}

export async function createProduct(req: Request, res: Response) {
  const { sellerId, ...input } = req.body as AdminCreateProductInput;

  const [category, seller] = await Promise.all([
    prisma.category.findUnique({ where: { id: input.categoryId } }),
    prisma.seller.findUnique({ where: { id: sellerId } }),
  ]);
  if (!category) {
    throw new AppError(400, "Category not found");
  }
  if (!seller) {
    throw new AppError(400, "Seller not found");
  }

  const slug = await uniqueSlug(input.name, async (candidate) => {
    const existing = await prisma.product.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });

  const product = await prisma.$transaction(async (tx) => {
    const currentCategory = await lockCategorySource(tx, input.categoryId);
    validateProductSource(input, currentCategory.slug);
    const created = await tx.product.create({
      data: { ...input, specifications: input.specifications ?? Prisma.DbNull, slug, sellerId },
      include: publicProductInclude,
    });
    await enqueueProductIndex(tx, created.id);
    return created;
  });
  await bumpCacheVersion("products");
  res.status(201).json({ product });
}

export async function updateProduct(req: Request, res: Response) {
  const input = req.body as UpdateProductInput;

  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) {
    throw new AppError(404, "Product not found");
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new AppError(400, "Category not found");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await lockProductSource(tx, product.id, input.categoryId);
    const category = await tx.category.findUniqueOrThrow({ where: { id: input.categoryId ?? current.categoryId } });
    validateProductSource({ ...current, ...input }, category.slug);
    const changed = canonicalSourceChanged(current, input);
    const result = await tx.product.update({
      where: { id: current.id },
      data: { ...productWriteData(input), ...(changed ? { ragRevision: { increment: 1 } } : {}) },
      include: publicProductInclude,
    });
    if (changed) await enqueueProductIndex(tx, result.id);
    return result;
  });
  await bumpCacheVersion("products");
  res.json({ product: updated });
}

/**
 * DELETE /api/products/:id — admin moderation take-down, as a soft delete.
 *
 * Same reasoning as the seller-facing one: order items, reviews and cart
 * items all point here under ON DELETE RESTRICT, so a real delete would
 * either 500 or destroy the record of a real purchase.
 */
export async function deleteProduct(req: Request, res: Response) {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) {
    throw new AppError(404, "Product not found");
  }
  if (product.status === "archived") {
    throw new AppError(409, "This listing has already been withdrawn");
  }

  const removedFromCarts = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { status: "archived", archivedAt: new Date() },
    });
    await removeProductIndex(tx, product.id);
    return removeProductFromCarts(tx, product.id, "archived");
  });

  await bumpCacheVersion("products");
  res.json({ archived: true, removedFromCarts });
}
