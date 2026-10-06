import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  createUser,
  createCategory,
  createApprovedSeller,
  createProductForSeller,
  createOrder,
  tokenFor,
  cleanupOrder,
  cleanupSeller,
  cleanupCategory,
  cleanupUser,
} from "./fixtures";

describe("seller fulfilment: /api/sellers/me/orders and /api/sellers/me/shipments", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let sellerA: Awaited<ReturnType<typeof createApprovedSeller>>;
  let sellerB: Awaited<ReturnType<typeof createApprovedSeller>>;
  let productA: Awaited<ReturnType<typeof createProductForSeller>>;
  let productB: Awaited<ReturnType<typeof createProductForSeller>>;
  let buyer: Awaited<ReturnType<typeof createUser>>;
  // One order holding items from two different sellers — the case the whole
  // shipment model exists for.
  let sharedOrder: Awaited<ReturnType<typeof createOrder>>;
  let unpaidOrder: Awaited<ReturnType<typeof createOrder>>;
  let tokenA: string;
  let tokenB: string;
  let shipmentId: string;

  beforeAll(async () => {
    category = await createCategory();
    sellerA = await createApprovedSeller();
    sellerB = await createApprovedSeller();
    productA = await createProductForSeller(sellerA.seller.id, category.id);
    productB = await createProductForSeller(sellerB.seller.id, category.id);
    buyer = await createUser("customer");

    sharedOrder = await createOrder(
      buyer.id,
      [
        { productId: productA.id, sellerId: sellerA.seller.id, quantity: 2 },
        { productId: productB.id, sellerId: sellerB.seller.id, quantity: 1 },
      ],
      "paid",
    );
    unpaidOrder = await createOrder(
      buyer.id,
      [{ productId: productA.id, sellerId: sellerA.seller.id }],
      "pending_payment",
    );

    tokenA = tokenFor(sellerA.user);
    tokenB = tokenFor(sellerB.user);
  });

  afterAll(async () => {
    await cleanupOrder(sharedOrder.id);
    await cleanupOrder(unpaidOrder.id);
    await cleanupUser(buyer.id);
    await cleanupSeller(sellerA.seller.id, sellerA.user.id);
    await cleanupSeller(sellerB.seller.id, sellerB.user.id);
    await cleanupCategory(category.id);
  });

  it("shows a seller only their own line items in a shared order", async () => {
    const res = await request(app).get("/api/sellers/me/orders").set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const order = res.body.orders.find((o: { orderId: string }) => o.orderId === sharedOrder.id);
    expect(order).toBeDefined();
    expect(order.items).toHaveLength(1);
    expect(order.items[0].productId).toBe(productA.id);
    expect(order.subtotalCents).toBe(2000);
    expect(order.shipment).toBeNull();
  });

  it("does not surface orders that have not been paid for", async () => {
    const res = await request(app).get("/api/sellers/me/orders").set("Authorization", `Bearer ${tokenA}`);

    const unpaid = res.body.orders.find((o: { orderId: string }) => o.orderId === unpaidOrder.id);
    expect(unpaid).toBeUndefined();
  });

  it("refuses to confirm an order that has not been paid for", async () => {
    const res = await request(app)
      .post("/api/sellers/me/shipments")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ orderId: unpaidOrder.id });

    expect(res.status).toBe(409);
  });

  it("creates a shipment covering only the confirming seller's items", async () => {
    const res = await request(app)
      .post("/api/sellers/me/shipments")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ orderId: sharedOrder.id, carrier: "Demo Post", trackingNumber: "TRK123" });

    expect(res.status).toBe(201);
    expect(res.body.shipment.status).toBe("confirmed");
    expect(res.body.shipment.confirmedAt).not.toBeNull();
    expect(res.body.shipment.items).toHaveLength(1);
    shipmentId = res.body.shipment.id;

    // Seller B's line item in the same order is untouched — their half of
    // the order is still unconfirmed.
    const itemB = await prisma.orderItem.findFirst({
      where: { orderId: sharedOrder.id, sellerId: sellerB.seller.id },
    });
    expect(itemB?.shipmentId).toBeNull();
  });

  it("blocks a second confirmation of the same order by the same seller", async () => {
    const res = await request(app)
      .post("/api/sellers/me/shipments")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ orderId: sharedOrder.id });

    expect(res.status).toBe(409);
  });

  it("blocks seller B from advancing seller A's shipment", async () => {
    const res = await request(app)
      .patch(`/api/sellers/me/shipments/${shipmentId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ status: "packed" });

    expect(res.status).toBe(403);
    const unchanged = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    expect(unchanged?.status).toBe("confirmed");
  });

  it("refuses to skip a step in the confirmed to packed to received sequence", async () => {
    const res = await request(app)
      .patch(`/api/sellers/me/shipments/${shipmentId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "received" });

    expect(res.status).toBe(409);
    const unchanged = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    expect(unchanged?.status).toBe("confirmed");
  });

  it("advances confirmed to packed, stamping packedAt", async () => {
    const res = await request(app)
      .patch(`/api/sellers/me/shipments/${shipmentId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "packed" });

    expect(res.status).toBe(200);
    expect(res.body.shipment.status).toBe("packed");
    expect(res.body.shipment.packedAt).not.toBeNull();
  });

  it("advances packed to received, then refuses to move any further", async () => {
    const received = await request(app)
      .patch(`/api/sellers/me/shipments/${shipmentId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "received" });

    expect(received.status).toBe(200);
    expect(received.body.shipment.receivedAt).not.toBeNull();

    const again = await request(app)
      .patch(`/api/sellers/me/shipments/${shipmentId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "received" });

    expect(again.status).toBe(409);
  });

  it("404s when a seller tries to confirm an order holding none of their items", async () => {
    const otherOrder = await createOrder(
      buyer.id,
      [{ productId: productB.id, sellerId: sellerB.seller.id }],
      "paid",
    );

    const res = await request(app)
      .post("/api/sellers/me/shipments")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ orderId: otherOrder.id });

    expect(res.status).toBe(404);
    await cleanupOrder(otherOrder.id);
  });

  it("surfaces the per-seller shipment status on the customer's own order", async () => {
    const res = await request(app)
      .get(`/api/orders/${sharedOrder.id}`)
      .set("Authorization", `Bearer ${tokenFor(buyer)}`);

    expect(res.status).toBe(200);
    const items = res.body.order.items as Array<{ sellerId: string; shipment: { status: string } | null }>;
    expect(items.find((i) => i.sellerId === sellerA.seller.id)?.shipment?.status).toBe("received");
    expect(items.find((i) => i.sellerId === sellerB.seller.id)?.shipment).toBeNull();
  });

  it("lists the seller's shipments across orders", async () => {
    const res = await request(app).get("/api/sellers/me/shipments").set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.shipments.some((s: { id: string }) => s.id === shipmentId)).toBe(true);
  });
});
