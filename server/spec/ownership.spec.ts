import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createApprovedSeller, createCategory, createProductForSeller, tokenFor, cleanupSeller, cleanupCategory } from "./fixtures";

describe("product ownership boundary", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let sellerA: Awaited<ReturnType<typeof createApprovedSeller>>;
  let sellerB: Awaited<ReturnType<typeof createApprovedSeller>>;
  let productA: Awaited<ReturnType<typeof createProductForSeller>>;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    category = await createCategory();
    sellerA = await createApprovedSeller();
    sellerB = await createApprovedSeller();
    productA = await createProductForSeller(sellerA.seller.id, category.id);
    tokenA = tokenFor(sellerA.user);
    tokenB = tokenFor(sellerB.user);
  });

  afterAll(async () => {
    await cleanupSeller(sellerA.seller.id, sellerA.user.id);
    await cleanupSeller(sellerB.seller.id, sellerB.user.id);
    await cleanupCategory(category.id);
  });

  it("blocks seller B from updating seller A's product", async () => {
    const res = await request(app)
      .patch(`/api/sellers/me/products/${productA.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hijacked name" });

    expect(res.status).toBe(403);

    const unchanged = await prisma.product.findUnique({ where: { id: productA.id } });
    expect(unchanged?.name).toBe(productA.name);
  });

  it("blocks seller B from deleting seller A's product", async () => {
    const res = await request(app)
      .delete(`/api/sellers/me/products/${productA.id}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(403);

    const stillExists = await prisma.product.findUnique({ where: { id: productA.id } });
    expect(stillExists).not.toBeNull();
  });

  it("allows seller A to update their own product", async () => {
    const res = await request(app)
      .patch(`/api/sellers/me/products/${productA.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Updated by owner" });

    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe("Updated by owner");
  });

  it("rejects requests with no auth token at all", async () => {
    const res = await request(app).patch(`/api/sellers/me/products/${productA.id}`).send({ name: "x" });
    expect(res.status).toBe(401);
  });
});
