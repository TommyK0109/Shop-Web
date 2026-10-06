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

describe("cart API", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let seller: Awaited<ReturnType<typeof createApprovedSeller>>;
  let product: Awaited<ReturnType<typeof createProductForSeller>>;
  let buyer: Awaited<ReturnType<typeof createUser>>;
  let token: string;
  let itemId: string;

  beforeAll(async () => {
    category = await createCategory();
    seller = await createApprovedSeller();
    product = await createProductForSeller(seller.seller.id, category.id, { priceCents: 2000, stockQty: 5 });
    buyer = await createUser("customer");
    token = tokenFor(buyer);
  });

  afterAll(async () => {
    await prisma.cartItem.deleteMany({ where: { cart: { userId: buyer.id } } });
    await prisma.cart.deleteMany({ where: { userId: buyer.id } });
    await cleanupUser(buyer.id);
    await cleanupSeller(seller.seller.id, seller.user.id);
    await cleanupCategory(category.id);
  });

  it("rejects requests with no auth token", async () => {
    const res = await request(app).get("/api/cart");
    expect(res.status).toBe(401);
  });

  it("starts empty and lazily creates a cart", async () => {
    const res = await request(app).get("/api/cart").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
    expect(res.body.cart.totalCents).toBe(0);
  });

  it("adds an item and computes the total", async () => {
    const res = await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product.id, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.totalCents).toBe(4000);
    itemId = res.body.cart.items[0].id;
  });

  it("adding the same product again increments quantity instead of duplicating the line", async () => {
    const res = await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product.id, quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].quantity).toBe(3);
    expect(res.body.cart.totalCents).toBe(6000);
  });

  it("updates quantity", async () => {
    const res = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.cart.totalCents).toBe(2000);
  });

  it("rejects a zero quantity", async () => {
    const res = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
  });

  it("blocks acting on another user's cart item", async () => {
    const otherUser = await createUser("customer");
    const otherToken = tokenFor(otherUser);

    const res = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(404);
    // The PATCH attempt lazily created a cart for otherUser before the
    // ownership check rejected it — clean that up before deleting the user.
    await prisma.cart.deleteMany({ where: { userId: otherUser.id } });
    await cleanupUser(otherUser.id);
  });

  it("removes an item", async () => {
    const res = await request(app).delete(`/api/cart/items/${itemId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
  });
});
