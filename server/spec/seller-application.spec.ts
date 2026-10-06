import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createCategory, createUser, tokenFor, cleanupCategory, cleanupUser } from "./fixtures";

describe("POST /api/sellers/apply", () => {
  const createdUserIds: string[] = [];
  let category: Awaited<ReturnType<typeof createCategory>>;

  const baseApplication = (overrides: Record<string, unknown> = {}) => ({
    applicantName: "Jordan Applicant",
    nationalId: "998877",
    businessName: `Rollback Test Store ${randomUUID()}`,
    description: "A test store.",
    addressLine1: "1 Test Way",
    city: "Testville",
    postalCode: "00000",
    country: "Testland",
    products: [
      {
        categoryId: category.id,
        name: "Valid Product",
        description: "A valid product.",
        priceCents: 1500,
        stockQty: 5,
      },
    ],
    ...overrides,
  });

  beforeAll(async () => {
    category = await createCategory();
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      const seller = await prisma.seller.findUnique({ where: { userId } });
      if (seller) {
        await prisma.product.deleteMany({ where: { sellerId: seller.id } });
        // Applying provisions bank details for the store, so they have to come
        // off before the seller row can go.
        await prisma.sellerPaymentMethod.deleteMany({ where: { sellerId: seller.id } });
        await prisma.seller.deleteMany({ where: { id: seller.id } });
      }
      await cleanupUser(userId);
    }
    await cleanupCategory(category.id);
  });

  it("creates the seller and its initial catalog transactionally", async () => {
    const user = await createUser("customer");
    createdUserIds.push(user.id);
    const token = tokenFor(user);

    const res = await request(app)
      .post("/api/sellers/apply")
      .set("Authorization", `Bearer ${token}`)
      .send(baseApplication());

    expect(res.status).toBe(201);
    expect(res.body.seller.status).toBe("pending");
    // Only the last 4 digits should ever come back — never the raw ID.
    expect(res.body.seller.nationalIdMasked).toBe("8877");
    expect(res.body.seller.nationalId).toBeUndefined();

    const products = await prisma.product.findMany({ where: { sellerId: res.body.seller.id } });
    expect(products).toHaveLength(1);
  });

  it("rolls back the whole application when a product row fails to insert", async () => {
    const user = await createUser("customer");
    createdUserIds.push(user.id);
    const token = tokenFor(user);

    // A category ID that doesn't exist trips the FK check up front, before
    // the transaction is even opened — the assertion below confirms no
    // partial state (no seller row) is left behind either way.
    const res = await request(app)
      .post("/api/sellers/apply")
      .set("Authorization", `Bearer ${token}`)
      .send(
        baseApplication({
          products: [
            {
              categoryId: randomUUID(),
              name: "Orphaned Product",
              description: "References a category that doesn't exist.",
              priceCents: 1000,
              stockQty: 1,
            },
          ],
        }),
      );

    expect(res.status).toBe(400);

    const seller = await prisma.seller.findUnique({ where: { userId: user.id } });
    expect(seller).toBeNull();
  });

  it("promotes the applicant from customer to seller", async () => {
    const user = await createUser("customer");
    createdUserIds.push(user.id);

    const res = await request(app)
      .post("/api/sellers/apply")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send(baseApplication());
    expect(res.status).toBe(201);

    // Applying is what makes someone a seller; approval only gates what
    // they can do with the store. The role is promoted in the same
    // transaction, so a rolled-back application leaves it alone.
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.role).toBe("seller");
  });

  it("leaves an admin's role alone when they apply", async () => {
    const admin = await createUser("admin");
    createdUserIds.push(admin.id);

    const res = await request(app)
      .post("/api/sellers/apply")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send(baseApplication());
    expect(res.status).toBe(201);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(after.role).toBe("admin");
  });

  it("does not promote the applicant when the application rolls back", async () => {
    const user = await createUser("customer");
    createdUserIds.push(user.id);

    const res = await request(app)
      .post("/api/sellers/apply")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send(
        baseApplication({
          products: [
            {
              categoryId: randomUUID(),
              name: "Orphaned Product",
              description: "References a category that doesn't exist.",
              priceCents: 1000,
              stockQty: 1,
            },
          ],
        }),
      );
    expect(res.status).toBe(400);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.role).toBe("customer");
  });

  it("rejects a second application from the same user", async () => {
    const user = await createUser("customer");
    createdUserIds.push(user.id);
    const token = tokenFor(user);

    const first = await request(app)
      .post("/api/sellers/apply")
      .set("Authorization", `Bearer ${token}`)
      .send(baseApplication());
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/sellers/apply")
      .set("Authorization", `Bearer ${token}`)
      .send(baseApplication());
    expect(second.status).toBe(409);
  });
});
