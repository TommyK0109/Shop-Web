import type { Request, Response } from "express";
import type { SellerStatus } from "@prisma/client";
import type { AdminOrderQueryInput, UpdateSellerStatusInput } from "@storefront/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler.middleware";
import { bumpCacheVersion } from "../lib/cache";
import { enqueueSellerProducts, removeSellerIndex } from "../services/rag/indexing";

const VALID_STATUSES: SellerStatus[] = ["pending", "approved", "rejected", "suspended"];

export async function listSellerApplications(req: Request, res: Response) {
  const statusParam = req.query.status;
  const status = typeof statusParam === "string" && VALID_STATUSES.includes(statusParam as SellerStatus)
    ? (statusParam as SellerStatus)
    : undefined;

  const sellers = await prisma.seller.findMany({
    where: status ? { status } : undefined,
    include: {
      // The account behind the application — an approval screen that can't
      // say who applied isn't much of a review.
      user: { select: { id: true, email: true } },
      products: { where: { status: { not: "archived" } }, include: { category: true } },
      paymentMethod: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ sellers });
}

export async function updateSellerStatus(req: Request, res: Response) {
  const { status } = req.body as UpdateSellerStatusInput;

  const seller = await prisma.seller.findUnique({ where: { id: req.params.id } });
  if (!seller) {
    throw new AppError(404, "Seller not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.seller.update({ where: { id: seller.id }, data: { status } });
    if (status === "approved") await enqueueSellerProducts(tx, seller.id);
    else await removeSellerIndex(tx, seller.id);
    return result;
  });
  // Public product visibility is gated on the seller's status
  // (publicProductWhere), not just on the product row itself.
  await bumpCacheVersion("products");
  res.json({ seller: updated });
}

// GET /api/admin/orders — the cross-seller view. Unlike
// GET /api/sellers/me/orders, this is deliberately *not* scoped: an admin
// sees every order whole, including items from sellers who can't see each
// other's. Paginated because the seeded catalog can produce a lot of rows.
export async function listAllOrders(req: Request, res: Response) {
  const { status, page, limit } = req.query as unknown as AdminOrderQueryInput;
  const where = status ? { status } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, email: true } },
        shippingAddress: true,
        payments: { include: { seller: { select: { id: true, businessName: true } } } },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            seller: { select: { id: true, slug: true, businessName: true } },
            shipment: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
