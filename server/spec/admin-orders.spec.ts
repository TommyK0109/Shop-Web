import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
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

describe("GET /api/admin/orders", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let sellerA: Awaited<ReturnType<typeof createApprovedSeller>>;
  let sellerB: Awaited<ReturnType<typeof createApprovedSeller>>;
  let productA: Awaited<ReturnType<typeof createProductForSeller>>;
  let productB: Awaited<ReturnType<typeof createProductForSeller>>;
  let buyer: Awaited<ReturnType<typeof createUser>>;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let paidOrder: Awaited<ReturnType<typeof createOrder>>;
  let cancelledOrder: Awaited<ReturnType<typeof createOrder>>;
  let adminToken: string;
  let buyerToken: string;

  beforeAll(async () => {
    category = await createCategory();
    sellerA = await createApprovedSeller();
    sellerB = await createApprovedSeller();
    productA = await createProductForSeller(sellerA.seller.id, category.id);
    productB = await createProductForSeller(sellerB.seller.id, category.id);
    buyer = await createUser("customer");
    admin = await createUser("admin");

    paidOrder = await createOrder(
      buyer.id,
      [
        { productId: productA.id, sellerId: sellerA.seller.id },
        { productId: productB.id, sellerId: sellerB.seller.id },
      ],
      "paid",
    );
    cancelledOrder = await createOrder(
      buyer.id,
      [{ productId: productA.id, sellerId: sellerA.seller.id }],
      "cancelled",
    );

    adminToken = tokenFor(admin);
    buyerToken = tokenFor(buyer);
  });

  afterAll(async () => {
    await cleanupOrder(paidOrder.id);
    await cleanupOrder(cancelledOrder.id);
    await cleanupUser(buyer.id);
    await cleanupUser(admin.id);
    await cleanupSeller(sellerA.seller.id, sellerA.user.id);
    await cleanupSeller(sellerB.seller.id, sellerB.user.id);
    await cleanupCategory(category.id);
  });

  it("rejects requests with no auth token", async () => {
    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(401);
  });

  it("blocks a customer from the cross-seller view", async () => {
    const res = await request(app).get("/api/admin/orders").set("Authorization", `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
  });

  // The point of this endpoint: unlike a seller, an admin sees an order
  // whole, including items belonging to sellers who cannot see each other.
  it("returns an order with every seller's items in it", async () => {
    const res = await request(app).get("/api/admin/orders").set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const order = res.body.orders.find((o: { id: string }) => o.id === paidOrder.id);
    expect(order).toBeDefined();
    expect(order.user.email).toBe(buyer.email);
    expect(order.items).toHaveLength(2);

    const sellerIds = order.items.map((item: { sellerId: string }) => item.sellerId);
    expect(sellerIds).toContain(sellerA.seller.id);
    expect(sellerIds).toContain(sellerB.seller.id);
  });

  it("filters by order status", async () => {
    const res = await request(app)
      .get("/api/admin/orders?status=cancelled")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.orders.every((o: { status: string }) => o.status === "cancelled")).toBe(true);
    expect(res.body.orders.some((o: { id: string }) => o.id === cancelledOrder.id)).toBe(true);
    expect(res.body.orders.some((o: { id: string }) => o.id === paidOrder.id)).toBe(false);
  });

  it("rejects an invalid status filter", async () => {
    const res = await request(app)
      .get("/api/admin/orders?status=not-a-status")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("paginates", async () => {
    const res = await request(app)
      .get("/api/admin/orders?page=1&limit=1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.pagination.limit).toBe(1);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
  });
});
