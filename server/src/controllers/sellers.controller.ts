import type { Request, Response } from "express";
import type {
  CreateProductInput,
  SellerApplicationInput,
  SetProductAvailabilityInput,
  UpdatePaymentMethodInput,
  UpdateProductInput,
} from "@storefront/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { uniqueSlug } from "../lib/slug";
import { uploadProductImage } from "../services/cloudinary.services";
import { AppError } from "../middleware/errorHandler.middleware";
import { removeProductFromCarts } from "../services/cartRemoves.services";
import { canonicalSourceChanged, enqueueProductIndex, lockCategorySource, lockProductSource, productWriteData, removeProductIndex, validateProductSource } from "../services/rag/indexing";
import { ensurePaymentMethod } from "../services/payments.services";
import { DEMO_BANKS } from "../services/vietqr.services";
import { publiclyVisibleStatuses } from "../services/productAvailability.services";
import { bumpCacheVersion } from "../lib/cache";

async function productSlugExists(tx: Prisma.TransactionClient, candidate: string) {
  const existing = await tx.product.findUnique({ where: { slug: candidate } });
  return existing !== null;
}

export async function getSellerBySlug(req: Request, res: Response) {
  const seller = await prisma.seller.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true,
      slug: true,
      businessName: true,
      description: true,
      city: true,
      country: true,
      status: true,
      products: {
        // Archived listings are soft-deleted, not visible.
        where: { status: { in: publiclyVisibleStatuses } },
        include: { images: { orderBy: { sortOrder: "asc" } }, category: true },
      },
    },
  });

  if (!seller || seller.status !== "approved") {
    throw new AppError(404, "Seller not found");
  }

  res.json({ seller });
}

export async function applyToSell(req: Request, res: Response) {
  const input = req.body as SellerApplicationInput;

  const existing = await prisma.seller.findUnique({ where: { userId: req.user!.id } });
  if (existing) {
    throw new AppError(409, "You have already submitted a seller application");
  }

  const categoryIds = [...new Set(input.products.map((p) => p.categoryId))];
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
  if (categories.length !== categoryIds.length) {
    throw new AppError(400, "One or more products reference a category that does not exist");
  }

  const sellerSlug = await uniqueSlug(input.businessName, async (candidate) => {
    const found = await prisma.seller.findUnique({ where: { slug: candidate } });
    return found !== null;
  });

  // Application + initial catalog are created in one transaction: if any
  // product row fails to insert, the seller row rolls back with it rather
  // than leaving a pending application with a partial (or empty) catalog.
  const seller = await prisma.$transaction(async (tx) => {
    const created = await tx.seller.create({
      data: {
        userId: req.user!.id,
        applicantName: input.applicantName,
        // Never persist the full national ID — only the last 4 digits, and
        // only ever in this masked form. See PLAN.md §4 security note.
        nationalIdMasked: input.nationalId.slice(-4),
        businessName: input.businessName,
        slug: sellerSlug,
        description: input.description,
        addressLine1: input.addressLine1,
        city: input.city,
        postalCode: input.postalCode,
        country: input.country,
        status: "pending",
      },
    });

    for (const p of input.products) {
      const category = await lockCategorySource(tx, p.categoryId);
      validateProductSource(p, category.slug);
      const productSlug = await uniqueSlug(p.name, (candidate) => productSlugExists(tx, candidate));
      const product = await tx.product.create({
        data: {
          sellerId: created.id,
          categoryId: p.categoryId,
          name: p.name,
          slug: productSlug,
          description: p.description,
          priceCents: p.priceCents,
          stockQty: p.stockQty,
          specifications: p.specifications ?? Prisma.DbNull,
        },
      });
      await enqueueProductIndex(tx, product.id);
    }

    // The store supplies its own payment details, and it gets them the
    // moment it applies rather than at approval — a store that reaches
    // "approved" with no way to receive money would be approved into a state
    // where it cannot trade. Mock values for this demo; editable from the
    // dashboard.
    await ensurePaymentMethod(tx, created.id, created.businessName);

    // Applying is what makes someone a seller in the role model; approval
    // gates what they can *do* (requireApprovedSeller), not what they are.
    // Guarded so an admin who applies isn't demoted out of their own role.
    if (req.user!.role === "customer") {
      await tx.user.update({ where: { id: req.user!.id }, data: { role: "seller" } });
    }

    return created;
  });

  res.status(201).json({ seller });
}

export async function getMySeller(req: Request, res: Response) {
  res.json({ seller: req.seller });
}

export async function listMyProducts(req: Request, res: Response) {
  const products = await prisma.product.findMany({
    // Archived listings are withdrawn, not deleted — they stay in the
    // database because orders and carts point at them, but the seller has
    // finished with them, so they are out of the dashboard too.
    where: { sellerId: req.seller!.id, status: { in: publiclyVisibleStatuses } },
    include: { images: { orderBy: { sortOrder: "asc" } }, category: true },
    orderBy: { name: "asc" },
  });
  res.json({ products });
}

export async function createMyProduct(req: Request, res: Response) {
  const input = req.body as CreateProductInput;

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    throw new AppError(400, "Category not found");
  }

  const slug = await uniqueSlug(input.name, async (candidate) => {
    const existing = await prisma.product.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });

  const product = await prisma.$transaction(async (tx) => {
    const currentCategory = await lockCategorySource(tx, input.categoryId);
    validateProductSource(input, currentCategory.slug);
    const created = await tx.product.create({
      data: { ...input, specifications: input.specifications ?? Prisma.DbNull, slug, sellerId: req.seller!.id },
      include: { images: true, category: true },
    });
    await enqueueProductIndex(tx, created.id);
    return created;
  });
  // Only reaches the public catalog when the seller is already approved
  // (see publicProductWhere), but bumping unconditionally is cheap and
  // correct either way.
  await bumpCacheVersion("products");
  res.status(201).json({ product });
}

export async function updateMyProduct(req: Request, res: Response) {
  const input = req.body as UpdateProductInput;

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new AppError(400, "Category not found");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await lockProductSource(tx, req.product!.id, input.categoryId);
    const category = await tx.category.findUniqueOrThrow({ where: { id: input.categoryId ?? current.categoryId } });
    validateProductSource({ ...current, ...input }, category.slug);
    const changed = canonicalSourceChanged(current, input);
    const result = await tx.product.update({
      where: { id: current.id },
      data: { ...productWriteData(input), ...(changed ? { ragRevision: { increment: 1 } } : {}) },
      include: { images: true, category: true },
    });
    if (changed) await enqueueProductIndex(tx, result.id);
    return result;
  });
  await bumpCacheVersion("products");
  res.json({ product: updated });
}

/**
 * PATCH /api/sellers/me/products/:id/availability
 *
 * The seller confirming whether this listing can still be bought. This is the
 * *only* thing that takes a product out of customers' carts, which is why it
 * is its own explicit endpoint rather than a field on the general update:
 * `stockQty` hitting zero must never empty anyone's cart, because a restock
 * is one edit away.
 */
export async function setMyProductAvailability(req: Request, res: Response) {
  const { status } = req.body as SetProductAvailabilityInput;
  const product = req.product!;

  if (product.status === "archived") {
    throw new AppError(409, "This listing has been withdrawn and can no longer be changed");
  }
  if (product.status === status) {
    throw new AppError(409, `This listing is already ${status === "active" ? "on sale" : "marked out of stock"}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: product.id },
      data: {
        status,
        outOfStockAt: status === "out_of_stock" ? new Date() : null,
      },
      include: { images: true, category: true },
    });

    // Going out of stock clears carts (with a notice); coming back on sale
    // does not restore them — those customers were already told.
    const removedFromCarts =
      status === "out_of_stock" ? await removeProductFromCarts(tx, product.id, "out_of_stock") : 0;

    return { updated, removedFromCarts };
  });

  await bumpCacheVersion("products");
  res.json({ product: result.updated, removedFromCarts: result.removedFromCarts });
}

/**
 * DELETE /api/sellers/me/products/:id — a soft delete.
 *
 * The row is never removed. Order items, reviews and cart items all hold
 * foreign keys to it under ON DELETE RESTRICT, so a real delete either failed
 * outright with a 500 (which is what it did before) or would have taken the
 * record of what someone actually bought with it.
 */
export async function deleteMyProduct(req: Request, res: Response) {
  const product = req.product!;
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

// --- How this store gets paid ----------------------------------------------

/** GET /api/sellers/me/payment-method */
export async function getMyPaymentMethod(req: Request, res: Response) {
  const method = await prisma.$transaction((tx) =>
    ensurePaymentMethod(tx, req.seller!.id, req.seller!.businessName),
  );
  res.json({ paymentMethod: method, banks: DEMO_BANKS });
}

/**
 * PUT /api/sellers/me/payment-method
 *
 * Changing these details only affects *future* orders: every Payment row
 * snapshots the account it was created against, so a buyer who has already
 * been shown a QR keeps being shown that same QR.
 */
export async function updateMyPaymentMethod(req: Request, res: Response) {
  const input = req.body as UpdatePaymentMethodInput;

  const bank = DEMO_BANKS.find((b) => b.bin === input.bankBin);
  if (!bank) {
    throw new AppError(400, "Unknown bank");
  }

  await prisma.$transaction((tx) => ensurePaymentMethod(tx, req.seller!.id, req.seller!.businessName));
  const method = await prisma.sellerPaymentMethod.update({
    where: { sellerId: req.seller!.id },
    data: {
      bankBin: bank.bin,
      // Derived from the BIN rather than taken from the client, so the name
      // and the number a buyer's app resolves can never disagree.
      bankName: bank.name,
      accountNumber: input.accountNumber,
      accountName: input.accountName.toUpperCase(),
    },
  });

  res.json({ paymentMethod: method });
}

export async function uploadMyProductImage(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, "No image file provided");
  }

  const { url } = await uploadProductImage(req.file.buffer);

  const sortOrder = await prisma.productImage.count({ where: { productId: req.product!.id } });
  const image = await prisma.productImage.create({
    data: { productId: req.product!.id, url, sortOrder },
  });
  res.status(201).json({ image });
}
