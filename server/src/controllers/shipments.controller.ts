import type { Request, Response } from "express";
import type { ShipmentStatus } from "@prisma/client";
import type { CreateShipmentInput, UpdateShipmentInput } from "@storefront/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler.middleware";

// The seller only ever moves a shipment forward, one step at a time. There
// is no carrier feeding status in here (see PLAN.md §4) — the store
// self-reports, so the server is the only thing guarding the order.
const NEXT_STATUS: Record<ShipmentStatus, ShipmentStatus | null> = {
  confirmed: "packed",
  packed: "received",
  received: null,
};

const sellerOrderItemInclude = {
  product: {
    select: { id: true, name: true, slug: true, images: { take: 1, orderBy: { sortOrder: "asc" as const } } },
  },
  shipment: true,
  order: {
    select: {
      id: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, email: true } },
      shippingAddress: true,
    },
  },
};

// GET /api/sellers/me/orders — only the caller's own line items, grouped by
// the order they belong to. A seller never sees another seller's items in a
// shared order, or the order's overall total.
export async function listMySellerOrders(req: Request, res: Response) {
  const items = await prisma.orderItem.findMany({
    where: {
      sellerId: req.seller!.id,
      // Fulfilment now turns on *this* seller having been paid, not on the
      // whole order settling: buyers transfer to each store separately, so
      // waiting for a co-seller in the same order to be paid would hold up
      // a shipment for a reason that has nothing to do with this store.
      order: {
        payments: { some: { sellerId: req.seller!.id, status: "succeeded" } },
      },
    },
    include: sellerOrderItemInclude,
    orderBy: { order: { createdAt: "desc" } },
  });

  const grouped = new Map<string, {
    orderId: string;
    orderStatus: string;
    createdAt: Date;
    customerEmail: string;
    shippingAddress: (typeof items)[number]["order"]["shippingAddress"];
    shipment: (typeof items)[number]["shipment"];
    items: Omit<(typeof items)[number], "order">[];
    subtotalCents: number;
  }>();

  for (const { order, ...item } of items) {
    let group = grouped.get(order.id);
    if (!group) {
      group = {
        orderId: order.id,
        orderStatus: order.status,
        createdAt: order.createdAt,
        customerEmail: order.user.email,
        shippingAddress: order.shippingAddress,
        // One shipment per (order, seller), so every item in a group shares
        // the same one — taking it from the first item is not a shortcut.
        shipment: item.shipment,
        items: [],
        subtotalCents: 0,
      };
      grouped.set(order.id, group);
    }
    group.items.push(item);
    group.subtotalCents += item.unitPriceCents * item.quantity;
  }

  res.json({ orders: [...grouped.values()] });
}

// POST /api/sellers/me/shipments — "confirm this order." Creates one
// shipment covering every unshipped item this seller owns in that order.
export async function createShipment(req: Request, res: Response) {
  const { orderId, carrier, trackingNumber } = req.body as CreateShipmentInput;

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true } });
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  if (order.status === "cancelled") {
    throw new AppError(409, "This order has been cancelled");
  }

  // Gated on my own payment only — see listMySellerOrders.
  const myPayment = await prisma.payment.findUnique({
    where: { orderId_sellerId: { orderId: order.id, sellerId: req.seller!.id } },
    select: { status: true },
  });
  if (!myPayment) {
    throw new AppError(404, "You have no items in this order");
  }
  if (myPayment.status !== "succeeded") {
    throw new AppError(409, "Confirm you've received this buyer's transfer before shipping");
  }

  const myItems = await prisma.orderItem.findMany({
    where: { orderId: order.id, sellerId: req.seller!.id },
    select: { id: true, shipmentId: true },
  });
  // Ownership boundary: no items of mine in this order means, as far as this
  // seller is concerned, the order doesn't exist.
  if (myItems.length === 0) {
    throw new AppError(404, "You have no items in this order");
  }
  if (myItems.some((item) => item.shipmentId !== null)) {
    throw new AppError(409, "You have already confirmed this order");
  }

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        orderId: order.id,
        sellerId: req.seller!.id,
        carrier: carrier || null,
        trackingNumber: trackingNumber || null,
        status: "confirmed",
        confirmedAt: new Date(),
      },
    });

    // Scoped by sellerId as well as orderId so a bug here could never sweep
    // another seller's line items into this shipment.
    await tx.orderItem.updateMany({
      where: { orderId: order.id, sellerId: req.seller!.id, shipmentId: null },
      data: { shipmentId: created.id },
    });

    return tx.shipment.findUniqueOrThrow({ where: { id: created.id }, include: { items: true } });
  });

  res.status(201).json({ shipment });
}

// PATCH /api/sellers/me/shipments/:id — advance confirmed → packed → received.
export async function updateShipment(req: Request, res: Response) {
  const { status, carrier, trackingNumber } = req.body as UpdateShipmentInput;
  const shipment = req.shipment!;

  const expected = NEXT_STATUS[shipment.status];
  if (expected === null) {
    throw new AppError(409, "This shipment is already marked received");
  }
  if (status !== expected) {
    throw new AppError(409, `A ${shipment.status} shipment can only move to ${expected}`);
  }

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status,
      ...(status === "packed" ? { packedAt: new Date() } : { receivedAt: new Date() }),
      ...(carrier !== undefined ? { carrier: carrier || null } : {}),
      ...(trackingNumber !== undefined ? { trackingNumber: trackingNumber || null } : {}),
    },
    include: { items: true },
  });

  res.json({ shipment: updated });
}

// GET /api/sellers/me/shipments — my shipments across every order.
export async function listMyShipments(req: Request, res: Response) {
  const shipments = await prisma.shipment.findMany({
    where: { sellerId: req.seller!.id },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, slug: true } } },
      },
      order: { select: { id: true, createdAt: true, status: true } },
    },
    orderBy: { confirmedAt: "desc" },
  });
  res.json({ shipments });
}
