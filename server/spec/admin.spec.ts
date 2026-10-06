import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createApprovedSeller, createUser, tokenFor, cleanupSeller, cleanupUser } from "./fixtures";

describe("admin seller approval", () => {
  let admin: Awaited<ReturnType<typeof createUser>>;
  let customer: Awaited<ReturnType<typeof createUser>>;
  let pendingSeller: Awaited<ReturnType<typeof createApprovedSeller>>;

  beforeAll(async () => {
    admin = await createUser("admin");
    customer = await createUser("customer");
    pendingSeller = await createApprovedSeller({ status: "pending" });
  });

  afterAll(async () => {
    await cleanupSeller(pendingSeller.seller.id, pendingSeller.user.id);
    await cleanupUser(admin.id);
    await cleanupUser(customer.id);
  });

  it("blocks non-admins from listing seller applications", async () => {
    const res = await request(app).get("/api/admin/sellers").set("Authorization", `Bearer ${tokenFor(customer)}`);
    expect(res.status).toBe(403);
  });

  it("lets an admin approve a pending seller", async () => {
    const res = await request(app)
      .patch(`/api/admin/sellers/${pendingSeller.seller.id}/status`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ status: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.seller.status).toBe("approved");

    const updated = await prisma.seller.findUnique({ where: { id: pendingSeller.seller.id } });
    expect(updated?.status).toBe("approved");
  });

  it("rejects an invalid status value", async () => {
    const res = await request(app)
      .patch(`/api/admin/sellers/${pendingSeller.seller.id}/status`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ status: "not-a-real-status" });

    expect(res.status).toBe(400);
  });
});
