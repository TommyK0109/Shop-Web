import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  cleanupCategory,
  cleanupOrder,
  cleanupSeller,
  cleanupUser,
  createApprovedSeller,
  createCategory,
  createProductForSeller,
  createUser,
  tokenFor,
} from "./fixtures";

/**
 * Money moves directly between the buyer's bank and each seller's, so there is
 * no gateway callback to trust and no platform-held balance. Settlement is a
 * two-party claim, and these tests pin down who is allowed to assert what.
 */
describe("direct seller payments", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let sellerA: Awaited<ReturnType<typeof createApprovedSeller>>;
  let sellerB: Awaited<ReturnType<typeof createApprovedSeller>>;
  let productA: Awaited<ReturnType<typeof createProductForSeller>>;
  let productB: Awaited<ReturnType<typeof createProductForSeller>>;
  let buyer: Awaited<ReturnType<typeof createUser>>;
  let buyerToken: string;
  let orderId: string;
  // Every test places a fresh order, so they all have to be torn down — not
  // just whichever one ran last.
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    category = await createCategory();
    sellerA = await createApprovedSeller();
    sellerB = await createApprovedSeller();
    // Generous stock: each test below places its own order, and checkout
    // decrements for real.
    productA = await createProductForSeller(sellerA.seller.id, category.id, { priceCents: 5000, stockQty: 200 });
    productB = await createProductForSeller(sellerB.seller.id, category.id, { priceCents: 2500, stockQty: 200 });
    buyer = await createUser("customer");
    buyerToken = tokenFor(buyer);
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await cleanupOrder(id);
    }
    await prisma.cartItem.deleteMany({ where: { cart: { userId: buyer.id } } });
    await prisma.cart.deleteMany({ where: { userId: buyer.id } });
    await cleanupUser(buyer.id);
    await cleanupSeller(sellerA.seller.id, sellerA.user.id);
    await cleanupSeller(sellerB.seller.id, sellerB.user.id);
    await cleanupCategory(category.id);
  });

  /** Places a real order through the API, spanning both sellers. */
  beforeEach(async () => {
    await prisma.cartItem.deleteMany({ where: { cart: { userId: buyer.id } } });
    for (const product of [productA, productB]) {
      await request(app)
        .post("/api/cart/items")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({ productId: product.id, quantity: 1 });
    }

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        shippingAddress: { line1: "1 Test Way", city: "Testville", postalCode: "00000", country: "Testland" },
      });
    orderId = res.body.orderId;
    createdOrderIds.push(orderId);
  });

  it("splits a two-seller order into one payment per seller", async () => {
    const res = await request(app).get(`/api/orders/${orderId}`).set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.order.payments).toHaveLength(2);

    const bySeller = Object.fromEntries(
      res.body.order.payments.map((p: { sellerId: string; amountCents: number }) => [p.sellerId, p.amountCents]),
    );
    // Each seller is owed exactly their own line items, not a share of the
    // order total.
    expect(bySeller[sellerA.seller.id]).toBe(5000);
    expect(bySeller[sellerB.seller.id]).toBe(2500);
  });

  it("gives every payment a scannable QR and its own transfer reference", async () => {
    const res = await request(app).get(`/api/orders/${orderId}`).set("Authorization", `Bearer ${buyerToken}`);

    const references = new Set<string>();
    for (const payment of res.body.order.payments) {
      expect(payment.qrSvg).toContain("<svg");
      // EMVCo payload: starts with the format indicator, ends with a CRC.
      expect(payment.qrPayload.startsWith("000201")).toBe(true);
      expect(payment.reference).toMatch(/^SF-[0-9A-F]{8}$/);
      expect(payment.bank.accountNumber).toMatch(/^\d+$/);
      references.add(payment.reference);
    }
    // The reference is the only link between a bank transfer and an order, so
    // two stores in one order must never share one.
    expect(references.size).toBe(2);
  });

  it("drops the QR once a payment is confirmed, since there is nothing left to pay", async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: sellerA.seller.id } });
    await request(app)
      .post(`/api/sellers/me/payments/${payment.id}/confirm`)
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`);

    const res = await request(app).get(`/api/orders/${orderId}`).set("Authorization", `Bearer ${buyerToken}`);
    const settled = res.body.order.payments.find((p: { id: string }) => p.id === payment.id);
    expect(settled.status).toBe("succeeded");
    expect(settled.qrSvg).toBeNull();
    expect(settled.qrPayload).toBeNull();
  });

  it("creates the order as pending with nothing paid", async () => {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("pending_payment");

    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.every((p) => p.status === "pending")).toBe(true);
  });

  // --- Buyer's half ---------------------------------------------------------

  it("lets the buyer declare a transfer, which does not by itself settle it", async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: sellerA.seller.id } });

    const res = await request(app)
      .post(`/api/payments/${payment.id}/mark-paid`)
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe("awaiting_confirmation");
    // Still not paid: only the seller can see the money arrive.
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("pending_payment");
  });

  it("refuses to let one buyer touch another buyer's payment", async () => {
    const stranger = await createUser("customer");
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });

    const res = await request(app)
      .post(`/api/payments/${payment.id}/mark-paid`)
      .set("Authorization", `Bearer ${tokenFor(stranger)}`);

    expect(res.status).toBe(403);
    await cleanupUser(stranger.id);
  });

  // --- Seller's half --------------------------------------------------------

  it("moves the order to partially_paid when one of two sellers confirms", async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: sellerA.seller.id } });

    const res = await request(app)
      .post(`/api/sellers/me/payments/${payment.id}/confirm`)
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`);

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe("succeeded");

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("partially_paid");
  });

  it("moves the order to paid only once every seller has confirmed", async () => {
    for (const seller of [sellerA, sellerB]) {
      const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: seller.seller.id } });
      await request(app)
        .post(`/api/sellers/me/payments/${payment.id}/confirm`)
        .set("Authorization", `Bearer ${tokenFor(seller.user)}`);
    }

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("paid");
  });

  it("refuses to let one seller confirm another seller's payment", async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: sellerB.seller.id } });

    const res = await request(app)
      .post(`/api/sellers/me/payments/${payment.id}/confirm`)
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`);

    // 404, not 403: a payment that isn't mine doesn't exist as far as my
    // store is concerned.
    expect(res.status).toBe(404);
    const untouched = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(untouched.status).toBe("pending");
  });

  it("only lets a seller see their own transfers", async () => {
    const res = await request(app)
      .get("/api/sellers/me/payments")
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`);

    expect(res.status).toBe(200);
    expect(res.body.payments.length).toBeGreaterThan(0);
    expect(res.body.payments.every((p: { sellerId: string }) => p.sellerId === sellerA.seller.id)).toBe(true);
  });

  it("records the seller's reason when a transfer is rejected, and tells the buyer", async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: sellerA.seller.id } });

    const res = await request(app)
      .post(`/api/sellers/me/payments/${payment.id}/reject`)
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`)
      .send({ reason: "Nothing arrived with this reference" });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe("failed");

    const asBuyer = await request(app).get(`/api/orders/${orderId}`).set("Authorization", `Bearer ${buyerToken}`);
    const rejected = asBuyer.body.order.payments.find((p: { id: string }) => p.id === payment.id);
    expect(rejected.failureReason).toBe("Nothing arrived with this reference");
  });

  it("requires a reason to reject, so the buyer is never left with nothing to act on", async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: sellerA.seller.id } });

    const res = await request(app)
      .post(`/api/sellers/me/payments/${payment.id}/reject`)
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`)
      .send({ reason: "   " });

    expect(res.status).toBe(400);
  });

  it("lets a buyer re-declare after a rejection, clearing the stale reason", async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: sellerA.seller.id } });
    await request(app)
      .post(`/api/sellers/me/payments/${payment.id}/reject`)
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`)
      .send({ reason: "Wrong amount" });

    const res = await request(app)
      .post(`/api/payments/${payment.id}/mark-paid`)
      .set("Authorization", `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe("awaiting_confirmation");
    expect(res.body.payment.failureReason).toBeNull();
  });

  it("refuses to confirm the same payment twice", async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: sellerA.seller.id } });
    const token = tokenFor(sellerA.user);

    await request(app).post(`/api/sellers/me/payments/${payment.id}/confirm`).set("Authorization", `Bearer ${token}`);
    const second = await request(app)
      .post(`/api/sellers/me/payments/${payment.id}/confirm`)
      .set("Authorization", `Bearer ${token}`);

    expect(second.status).toBe(409);
  });

  // --- What settlement unlocks ---------------------------------------------

  it("keeps an order out of a seller's fulfilment queue until they confirm their own payment", async () => {
    const queueBefore = await request(app)
      .get("/api/sellers/me/orders")
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`);
    expect(queueBefore.body.orders.map((o: { orderId: string }) => o.orderId)).not.toContain(orderId);

    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: sellerA.seller.id } });
    await request(app)
      .post(`/api/sellers/me/payments/${payment.id}/confirm`)
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`);

    const queueAfter = await request(app)
      .get("/api/sellers/me/orders")
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`);
    expect(queueAfter.body.orders.map((o: { orderId: string }) => o.orderId)).toContain(orderId);
  });

  it("does not make one seller's confirmation unlock a co-seller's fulfilment", async () => {
    // The whole point of splitting payments: seller B being unpaid must not
    // hold up seller A, and seller A being paid must not release seller B.
    const paymentA = await prisma.payment.findFirstOrThrow({ where: { orderId, sellerId: sellerA.seller.id } });
    await request(app)
      .post(`/api/sellers/me/payments/${paymentA.id}/confirm`)
      .set("Authorization", `Bearer ${tokenFor(sellerA.user)}`);

    const queueB = await request(app)
      .get("/api/sellers/me/orders")
      .set("Authorization", `Bearer ${tokenFor(sellerB.user)}`);
    expect(queueB.body.orders.map((o: { orderId: string }) => o.orderId)).not.toContain(orderId);

    const shipB = await request(app)
      .post("/api/sellers/me/shipments")
      .set("Authorization", `Bearer ${tokenFor(sellerB.user)}`)
      .send({ orderId });
    expect(shipB.status).toBe(409);
  });
});
