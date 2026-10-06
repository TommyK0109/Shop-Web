import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  createUser,
  createCategory,
  createApprovedSeller,
  createProductForSeller,
  tokenFor,
  cleanupSeller,
  cleanupCategory,
  cleanupUser,
} from "./fixtures";

const shippingAddress = {
  line1: "1 Test Way",
  city: "Testville",
  postalCode: "00000",
  country: "Testland",
};

describe("POST /api/orders", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let seller: Awaited<ReturnType<typeof createApprovedSeller>>;
  let product: Awaited<ReturnType<typeof createProductForSeller>>;
  let buyer: Awaited<ReturnType<typeof createUser>>;
  let token: string;

  beforeAll(async () => {
    category = await createCategory();
    seller = await createApprovedSeller();
    product = await createProductForSeller(seller.seller.id, category.id, { priceCents: 1000, stockQty: 2 });
    buyer = await createUser("customer");
    token = tokenFor(buyer);
  });

  afterAll(async () => {
    await prisma.cartItem.deleteMany({ where: { cart: { userId: buyer.id } } });
    await prisma.cart.deleteMany({ where: { userId: buyer.id } });
    await prisma.address.deleteMany({ where: { userId: buyer.id } });
    await cleanupUser(buyer.id);
    await cleanupSeller(seller.seller.id, seller.user.id);
    await cleanupCategory(category.id);
  });

  it("rejects requests with no auth token", async () => {
    const res = await request(app).post("/api/orders").send({ shippingAddress });
    expect(res.status).toBe(401);
  });

  it("rejects checkout with an empty cart", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress });

    expect(res.status).toBe(400);
  });

  it("rejects checkout when the cart exceeds available stock, leaving stock untouched", async () => {
    await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product.id, quantity: 99 });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress });

    expect(res.status).toBe(409);

    const unchanged = await prisma.product.findUnique({ where: { id: product.id } });
    expect(unchanged?.stockQty).toBe(2);
  });

  it("rejects checkout when the seller has confirmed an item out of stock", async () => {
    // Different from running out of units: this is the seller's own
    // confirmation, and the cart item survives the refusal either way.
    await prisma.cartItem.updateMany({
      where: { cart: { userId: buyer.id }, productId: product.id },
      data: { quantity: 1 },
    });
    await prisma.product.update({ where: { id: product.id }, data: { status: "out_of_stock" } });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/out of stock/i);

    const items = await prisma.cartItem.findMany({ where: { cart: { userId: buyer.id } } });
    expect(items).toHaveLength(1);

    await prisma.product.update({ where: { id: product.id }, data: { status: "active" } });
  });

  it("writes the order, its payment and the stock decrement in one transaction", async () => {
    // The gateway call that used to happen before any DB write is gone, so
    // there is no longer a window where a payment request exists with no
    // order behind it — this is the whole thing succeeding or nothing.
    await prisma.cartItem.updateMany({
      where: { cart: { userId: buyer.id }, productId: product.id },
      data: { quantity: 1 },
    });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress });

    expect(res.status).toBe(201);
    expect(res.body.orderId).toBeTruthy();
    // No redirect: the buyer stays on the site and pays from the order page.
    expect(res.body.redirectUrl).toBeUndefined();
    expect(res.body.order.payments).toHaveLength(1);
    expect(res.body.order.payments[0]).toMatchObject({ sellerId: seller.seller.id, amountCents: 1000 });
    expect(res.body.order.payments[0].qrSvg).toContain("<svg");

    const decremented = await prisma.product.findUnique({ where: { id: product.id } });
    expect(decremented?.stockQty).toBe(1);

    // The cart is emptied by a successful checkout — the one time the server
    // clears it without a seller confirming anything.
    const items = await prisma.cartItem.findMany({ where: { cart: { userId: buyer.id } } });
    expect(items).toHaveLength(0);

    const orderId = res.body.orderId as string;
    await prisma.payment.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
  });
});
