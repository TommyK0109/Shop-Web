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

describe("POST /api/products/:id/reviews", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let seller: Awaited<ReturnType<typeof createApprovedSeller>>;
  let product: Awaited<ReturnType<typeof createProductForSeller>>;
  let buyer: Awaited<ReturnType<typeof createUser>>;
  let stranger: Awaited<ReturnType<typeof createUser>>;
  let pendingBuyer: Awaited<ReturnType<typeof createUser>>;
  let paidOrder: Awaited<ReturnType<typeof createOrder>>;
  let unpaidOrder: Awaited<ReturnType<typeof createOrder>>;
  let buyerToken: string;
  let strangerToken: string;
  let pendingBuyerToken: string;

  beforeAll(async () => {
    category = await createCategory();
    seller = await createApprovedSeller();
    product = await createProductForSeller(seller.seller.id, category.id);

    buyer = await createUser("customer");
    stranger = await createUser("customer");
    pendingBuyer = await createUser("customer");

    paidOrder = await createOrder(buyer.id, [{ productId: product.id, sellerId: seller.seller.id }], "paid");
    unpaidOrder = await createOrder(
      pendingBuyer.id,
      [{ productId: product.id, sellerId: seller.seller.id }],
      "pending_payment",
    );

    buyerToken = tokenFor(buyer);
    strangerToken = tokenFor(stranger);
    pendingBuyerToken = tokenFor(pendingBuyer);
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { productId: product.id } });
    await cleanupOrder(paidOrder.id);
    await cleanupOrder(unpaidOrder.id);
    await cleanupUser(buyer.id);
    await cleanupUser(stranger.id);
    await cleanupUser(pendingBuyer.id);
    await cleanupSeller(seller.seller.id, seller.user.id);
    await cleanupCategory(category.id);
  });

  it("rejects requests with no auth token", async () => {
    const res = await request(app).post(`/api/products/${product.id}/reviews`).send({ rating: 5 });
    expect(res.status).toBe(401);
  });

  it("blocks a user who never bought the product", async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/reviews`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ rating: 5, comment: "Never bought this." });

    expect(res.status).toBe(403);
    const reviews = await prisma.review.findMany({ where: { productId: product.id, userId: stranger.id } });
    expect(reviews).toHaveLength(0);
  });

  // An order that exists but hasn't been paid for doesn't make you a
  // verified buyer — otherwise anyone could check out, never pay, and review.
  it("blocks a user whose order is still awaiting payment", async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/reviews`)
      .set("Authorization", `Bearer ${pendingBuyerToken}`)
      .send({ rating: 4 });

    expect(res.status).toBe(403);
  });

  it("rejects a rating outside 1-5", async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/reviews`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 6 });

    expect(res.status).toBe(400);
  });

  it("lets a verified buyer post a review", async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/reviews`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 5, comment: "Exactly as described." });

    expect(res.status).toBe(201);
    expect(res.body.review.rating).toBe(5);
    expect(res.body.review.user.email).toBe(buyer.email);
  });

  it("shows the new review on the product detail response", async () => {
    const res = await request(app).get(`/api/products/${product.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.product.reviews).toHaveLength(1);
    expect(res.body.product.reviews[0].comment).toBe("Exactly as described.");
  });

  it("blocks the same buyer from reviewing the product twice", async () => {
    const res = await request(app)
      .post(`/api/products/${product.id}/reviews`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 1, comment: "Changed my mind." });

    expect(res.status).toBe(409);
    const reviews = await prisma.review.findMany({ where: { productId: product.id, userId: buyer.id } });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].rating).toBe(5);
  });

  it("404s for a product that does not exist", async () => {
    const res = await request(app)
      .post("/api/products/00000000-0000-0000-0000-000000000000/reviews")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ rating: 5 });

    expect(res.status).toBe(404);
  });
});
