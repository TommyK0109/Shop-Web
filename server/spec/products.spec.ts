import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { createApprovedSeller, createCategory, createProductForSeller, cleanupSeller, cleanupCategory } from "./fixtures";

describe("GET /api/products", () => {
  const marker = randomUUID().slice(0, 8);
  let category: Awaited<ReturnType<typeof createCategory>>;
  let approvedSeller: Awaited<ReturnType<typeof createApprovedSeller>>;
  let pendingSeller: Awaited<ReturnType<typeof createApprovedSeller>>;

  beforeAll(async () => {
    category = await createCategory();
    approvedSeller = await createApprovedSeller();
    pendingSeller = await createApprovedSeller({ status: "pending" });

    await createProductForSeller(approvedSeller.seller.id, category.id, {
      name: `Visible Widget ${marker}`,
    });
    await createProductForSeller(pendingSeller.seller.id, category.id, {
      name: `Hidden Widget ${marker}`,
    });
  });

  afterAll(async () => {
    await cleanupSeller(approvedSeller.seller.id, approvedSeller.user.id);
    await cleanupSeller(pendingSeller.seller.id, pendingSeller.user.id);
    await cleanupCategory(category.id);
  });

  it("only returns products from approved sellers", async () => {
    const res = await request(app).get("/api/products").query({ search: marker });

    expect(res.status).toBe(200);
    const names = res.body.products.map((p: { name: string }) => p.name);
    expect(names).toContain(`Visible Widget ${marker}`);
    expect(names).not.toContain(`Hidden Widget ${marker}`);
  });

  it("filters by categoryId and paginates", async () => {
    const res = await request(app)
      .get("/api/products")
      .query({ categoryId: category.id, page: 1, limit: 1 });

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeLessThanOrEqual(1);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 1 });
  });
});

describe("GET /api/products/suggestions", () => {
  const marker = randomUUID().slice(0, 8);
  let category: Awaited<ReturnType<typeof createCategory>>;
  let approvedSeller: Awaited<ReturnType<typeof createApprovedSeller>>;
  let pendingSeller: Awaited<ReturnType<typeof createApprovedSeller>>;

  beforeAll(async () => {
    category = await createCategory();
    approvedSeller = await createApprovedSeller();
    pendingSeller = await createApprovedSeller({ status: "pending" });

    await createProductForSeller(approvedSeller.seller.id, category.id, {
      name: `Suggested Widget A ${marker}`,
    });
    await createProductForSeller(approvedSeller.seller.id, category.id, {
      name: `Suggested Widget B ${marker}`,
    });
    await createProductForSeller(pendingSeller.seller.id, category.id, {
      name: `Suggested Widget C ${marker}`,
    });
  });

  afterAll(async () => {
    await cleanupSeller(approvedSeller.seller.id, approvedSeller.user.id);
    await cleanupSeller(pendingSeller.seller.id, pendingSeller.user.id);
    await cleanupCategory(category.id);
  });

  it("returns matching products from approved sellers only", async () => {
    const res = await request(app).get("/api/products/suggestions").query({ q: marker });

    expect(res.status).toBe(200);
    const names = res.body.products.map((p: { name: string }) => p.name);
    expect(names).toContain(`Suggested Widget A ${marker}`);
    expect(names).toContain(`Suggested Widget B ${marker}`);
    expect(names).not.toContain(`Suggested Widget C ${marker}`);
  });

  it("caps results at the requested limit", async () => {
    const res = await request(app)
      .get("/api/products/suggestions")
      .query({ q: marker, limit: 1 });

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);
  });

  it("requires a non-empty q", async () => {
    const res = await request(app).get("/api/products/suggestions").query({});

    expect(res.status).toBe(400);
  });
});
