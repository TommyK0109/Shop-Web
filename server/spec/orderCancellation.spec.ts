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

describe("order cancellation restocks unpaid items", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let sellerA: Awaited<ReturnType<typeof createApprovedSeller>>;
  let sellerB: Awaited<ReturnType<typeof createApprovedSeller>>;
  let buyer: Awaited<ReturnType<typeof createUser>>;
  let otherBuyer: Awaited<ReturnType<typeof createUser>>;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let buyerToken: string;
  let otherBuyerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    category = await createCategory();
    sellerA = await createApprovedSeller();
    sellerB = await createApprovedSeller();
    buyer = await createUser("customer");
    otherBuyer = await createUser("customer");
    admin = await createUser("admin");
    buyerToken = tokenFor(buyer);
    otherBuyerToken = tokenFor(otherBuyer);
    adminToken = tokenFor(admin);
  });

  afterAll(async () => {
    await cleanupUser(buyer.id);
    await cleanupUser(otherBuyer.id);
    await cleanupUser(admin.id);
    await cleanupSeller(sellerA.seller.id, sellerA.user.id);
    await cleanupSeller(sellerB.seller.id, sellerB.user.id);
    await cleanupCategory(category.id);
  });

  it("customer cancelling a pending_payment order gets its stock back", async () => {
    const product = await createProductForSeller(sellerA.seller.id, category.id, { stockQty: 2 });
    const order = await createOrder(
      buyer.id,
      [{ productId: product.id, sellerId: sellerA.seller.id, quantity: 3 }],
      "pending_payment",
    );

    const res = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("cancelled");

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stockQty).toBe(5);

    await cleanupOrder(order.id);
    await prisma.product.deleteMany({ where: { id: product.id } });
  });

  it("blocks a customer from cancelling someone else's order", async () => {
    const product = await createProductForSeller(sellerA.seller.id, category.id, { stockQty: 5 });
    const order = await createOrder(
      buyer.id,
      [{ productId: product.id, sellerId: sellerA.seller.id, quantity: 1 }],
      "pending_payment",
    );

    const res = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set("Authorization", `Bearer ${otherBuyerToken}`);

    expect(res.status).toBe(403);

    await cleanupOrder(order.id);
    await prisma.product.deleteMany({ where: { id: product.id } });
  });

  it("blocks a customer from cancelling once any seller has been paid", async () => {
    const product = await createProductForSeller(sellerA.seller.id, category.id, { stockQty: 5 });
    const order = await createOrder(
      buyer.id,
      [{ productId: product.id, sellerId: sellerA.seller.id, quantity: 1 }],
      "paid",
    );

    const res = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(409);

    await cleanupOrder(order.id);
    await prisma.product.deleteMany({ where: { id: product.id } });
  });

  it("admin cancelling a partially_paid order restocks only the unpaid seller's items", async () => {
    const productA = await createProductForSeller(sellerA.seller.id, category.id, { stockQty: 7 });
    const productB = await createProductForSeller(sellerB.seller.id, category.id, { stockQty: 8 });
    // createOrder's "partially_paid" settles exactly the first seller passed.
    const order = await createOrder(
      buyer.id,
      [
        { productId: productA.id, sellerId: sellerA.seller.id, quantity: 3 },
        { productId: productB.id, sellerId: sellerB.seller.id, quantity: 2 },
      ],
      "partially_paid",
    );

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "cancelled" });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("cancelled");

    // Seller A was already paid (settled first) — stock must be untouched.
    const productAAfter = await prisma.product.findUnique({ where: { id: productA.id } });
    expect(productAAfter?.stockQty).toBe(7);

    // Seller B was never paid — its stock comes back.
    const productBAfter = await prisma.product.findUnique({ where: { id: productB.id } });
    expect(productBAfter?.stockQty).toBe(10);

    await cleanupOrder(order.id);
    await prisma.product.deleteMany({ where: { id: { in: [productA.id, productB.id] } } });
  });

  it("refuses to cancel an order that is already fully paid", async () => {
    const product = await createProductForSeller(sellerA.seller.id, category.id, { stockQty: 5 });
    const order = await createOrder(
      buyer.id,
      [{ productId: product.id, sellerId: sellerA.seller.id, quantity: 1 }],
      "paid",
    );

    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "cancelled" });

    expect(res.status).toBe(409);

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stockQty).toBe(5);

    await cleanupOrder(order.id);
    await prisma.product.deleteMany({ where: { id: product.id } });
  });
});
