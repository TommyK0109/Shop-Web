import type { Request, Response } from "express";
import type { CreateReviewInput } from "@storefront/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler.middleware";
import { bumpCacheVersion } from "../lib/cache";

const reviewInclude = { user: { select: { id: true, email: true } } };

export async function createReview(req: Request, res: Response) {
  const { rating, comment } = req.body as CreateReviewInput;
  const productId = req.params.id;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, sellerId: true, status: true, seller: { select: { status: true } } },
  });
  // Same visibility rule as GET /api/products/:slug — a product belonging to
  // a seller who isn't approved doesn't exist as far as the public API is
  // concerned, so it can't be reviewed either.
  if (!product || product.seller.status !== "approved" || product.status === "archived") {
    throw new AppError(404, "Product not found");
  }

  // Verified-purchaser check: the reviewer must have an order containing
  // this product whose payment *to this product's seller* has been confirmed.
  //
  // Order-wide status is the wrong test now that an order can be paid to one
  // store and not another: it would let someone review a product they never
  // actually paid for, as long as a co-seller in the same order had been
  // paid. Authorization derived from the data, not from a role.
  const purchase = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: {
        userId: req.user!.id,
        payments: { some: { sellerId: product.sellerId, status: "succeeded" } },
      },
    },
    select: { id: true },
  });
  if (!purchase) {
    throw new AppError(403, "You can only review a product you have bought and paid for");
  }

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId: req.user!.id } },
  });
  if (existing) {
    throw new AppError(409, "You have already reviewed this product");
  }

  const review = await prisma.review.create({
    data: { productId, userId: req.user!.id, rating, comment: comment || null },
    include: reviewInclude,
  });

  // GET /api/products/:slug embeds a product's reviews in its cached response.
  await bumpCacheVersion("products");
  res.status(201).json({ review });
}

export async function listProductReviews(req: Request, res: Response) {
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!product) {
    throw new AppError(404, "Product not found");
  }

  const reviews = await prisma.review.findMany({
    where: { productId: product.id },
    include: reviewInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json({ reviews });
}
