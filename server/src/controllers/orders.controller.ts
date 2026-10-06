import type { Request, Response } from "express";
import type { CreateOrderInput, UpdateOrderStatusInput } from "@storefront/shared";
import { prisma } from "../lib/prisma";
import { calculateCartTotal } from "../lib/cartTotal";
import { AppError } from "../middleware/errorHandler.middleware";
import { unavailableMessage, unavailableReason } from "../services/productAvailability.services";
import { createPaymentsForOrder, refreshOrderStatus, serializePayments } from "../services/payments.services";
import { restockUnpaidItems } from "../services/orderCancellation.services";
import { bumpCacheVersion } from "../lib/cache";

const orderInclude = {
  shippingAddress: true,
  payments: true,
  items: {
    include: {
      product: {
        select: { id: true, name: true, slug: true, images: { take: 1, orderBy: { sortOrder: "asc" as const } } },
      },
      seller: { select: { id: true, slug: true, businessName: true } },
      shipment: true,
    },
  },
};

type OrderWithPayments = Awaited<ReturnType<typeof prisma.order.findFirstOrThrow<{ include: typeof orderInclude }>>>;

/** Replaces the raw payment rows with the buyer-facing shape (QR included). */
async function serializeOrder(order: OrderWithPayments) {
  return { ...order, payments: await serializePayments(order.payments) };
}

export async function createOrder(req: Request, res: Response) {
  const { shippingAddress } = req.body as CreateOrderInput;

  const cart = await prisma.cart.findUnique({ where: { userId: req.user!.id } });
  const cartItems = cart
    ? await prisma.cartItem.findMany({
        where: { cartId: cart.id },
        include: { product: { include: { seller: true } } },
      })
    : [];

  if (cartItems.length === 0) {
    throw new AppError(400, "Your cart is empty");
  }

  // Unbuyable lines are reported, not silently dropped and not allowed to
  // block the rest of the cart forever: the customer is told exactly which
  // items are in the way, and those items stay in their cart afterwards.
  const blocked = cartItems
    .map((item) => ({ item, reason: unavailableReason(item.product, item.quantity) }))
    .filter((entry): entry is { item: (typeof cartItems)[number]; reason: NonNullable<typeof entry.reason> } =>
      entry.reason !== null,
    );

  if (blocked.length > 0) {
    const detail = blocked.map((b) => `"${b.item.product.name}" — ${unavailableMessage(b.reason)}`).join("; ");
    throw new AppError(409, `Some items can't be ordered right now: ${detail}`);
  }

  const totalCents = calculateCartTotal(
    cartItems.map((i) => ({ quantity: i.quantity, priceCents: i.product.priceCents })),
  );

  // One payment per seller, so the amounts have to be grouped before the
  // order is written.
  const slices = new Map<string, { sellerId: string; businessName: string; amountCents: number }>();
  for (const item of cartItems) {
    const existing = slices.get(item.product.sellerId);
    const lineTotal = item.product.priceCents * item.quantity;
    if (existing) {
      existing.amountCents += lineTotal;
    } else {
      slices.set(item.product.sellerId, {
        sellerId: item.product.sellerId,
        businessName: item.product.seller.businessName,
        amountCents: lineTotal,
      });
    }
  }

  // Everything below is one transaction. There is no external gateway call
  // to sequence against any more, so an order, its line items, its stock
  // decrements and its payment rows now either all exist or none do — the
  // old flow could leave a payment request live at the gateway with no order
  // behind it.
  const order = await prisma.$transaction(async (tx) => {
    const address = await tx.address.create({
      data: { userId: req.user!.id, ...shippingAddress },
    });

    const createdOrder = await tx.order.create({
      data: {
        userId: req.user!.id,
        shippingAddressId: address.id,
        status: "pending_payment",
        totalCents,
      },
    });

    for (const item of cartItems) {
      // Compare-and-swap: rejects the order if another buyer took the last
      // unit between the check above and here.
      const decremented = await tx.product.updateMany({
        where: { id: item.productId, stockQty: { gte: item.quantity } },
        data: { stockQty: { decrement: item.quantity } },
      });
      if (decremented.count === 0) {
        throw new AppError(409, `Not enough stock for "${item.product.name}"`);
      }
      await tx.orderItem.create({
        data: {
          orderId: createdOrder.id,
          productId: item.productId,
          sellerId: item.product.sellerId,
          quantity: item.quantity,
          unitPriceCents: item.product.priceCents,
        },
      });
    }

    await createPaymentsForOrder(tx, createdOrder.id, [...slices.values()]);
    await tx.cartItem.deleteMany({ where: { cartId: cart!.id } });

    return tx.order.findUniqueOrThrow({ where: { id: createdOrder.id }, include: orderInclude });
  });

  // Checkout just decremented stockQty on every line item, which the
  // cached product list/detail responses embed.
  await bumpCacheVersion("products");

  // No redirect any more: the buyer stays on the site and pays each store
  // from the order page, which is where the QR codes live.
  res.status(201).json({ orderId: order.id, order: await serializeOrder(order) });
}

export async function listMyOrders(req: Request, res: Response) {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders: await Promise.all(orders.map(serializeOrder)) });
}

export async function getOrderById(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude });
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  if (order.userId !== req.user!.id && req.user!.role !== "admin") {
    throw new AppError(403, "You do not have access to this order");
  }
  res.json({ order: await serializeOrder(order) });
}

/**
 * PATCH /api/orders/:id/status — cancel an order, or hand it back to the
 * derivation.
 *
 * There is no "mark this paid" here on purpose. Paid-ness is a fact about the
 * per-seller payments, and a seller confirming their own transfer is the only
 * thing that establishes it; letting an admin assert it directly would both
 * be silently recomputed away and give the platform a way to fake a
 * settlement no seller ever saw.
 */
export async function updateOrderStatus(req: Request, res: Response) {
  const { status } = req.body as UpdateOrderStatusInput;

  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  // Every seller has already been paid — cancelling from here is a refund
  // problem, not a stock one, and out of scope for this endpoint.
  if (status === "cancelled" && order.status === "paid") {
    throw new AppError(409, "This order is fully paid and can no longer be cancelled");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (status === "cancelled") {
      await restockUnpaidItems(tx, order.id);
      await tx.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    } else {
      await tx.order.update({ where: { id: order.id }, data: { status: "pending_payment" } });
      await refreshOrderStatus(tx, order.id);
    }
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  });

  // A cancellation may have just put stock back, which the cached product
  // list/detail responses embed.
  if (status === "cancelled") {
    await bumpCacheVersion("products");
  }

  res.json({ order: await serializeOrder(updated) });
}

/**
 * POST /api/orders/:id/cancel — a customer backing out of their own order.
 *
 * Scoped to `pending_payment` only: that is the one state that means zero
 * sellers have been paid yet, so restocking every line is always correct.
 * The moment any seller confirms a transfer the order becomes `partially_paid`
 * or `paid`, and backing out turns into a refund problem instead of a
 * cancellation one — out of scope here, so it is simply refused.
 */
export async function cancelMyOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  if (order.userId !== req.user!.id) {
    throw new AppError(403, "You do not have access to this order");
  }
  if (order.status !== "pending_payment") {
    throw new AppError(409, "This order can no longer be cancelled — a seller has already confirmed a payment");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await restockUnpaidItems(tx, order.id);
    await tx.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  });

  await bumpCacheVersion("products");
  res.json({ order: await serializeOrder(updated) });
}
