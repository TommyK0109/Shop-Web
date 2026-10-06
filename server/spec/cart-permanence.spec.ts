import { afterAll, beforeEach, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import {
  cleanupCategory,
  cleanupSeller,
  cleanupUser,
  createApprovedSeller,
  createCategory,
  createProductForSeller,
  createUser,
  tokenFor,
} from "./fixtures";

/**
 * The rule under test: a product stays in a cart permanently, and the *only*
 * thing that takes it out is the seller confirming it is gone.
 *
 * Everything else a marketplace throws at a cart — the last unit selling,
 * the price moving, the store being suspended, the listing being edited — has
 * to leave the row exactly where it is.
 */
describe("cart permanence", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let seller: Awaited<ReturnType<typeof createApprovedSeller>>;
  let product: Awaited<ReturnType<typeof createProductForSeller>>;
  let buyer: Awaited<ReturnType<typeof createUser>>;
  let token: string;
  let sellerToken: string;

  beforeAll(async () => {
    category = await createCategory();
    seller = await createApprovedSeller();
    buyer = await createUser("customer");
    token = tokenFor(buyer);
    sellerToken = tokenFor(seller.user);
  });

  beforeEach(async () => {
    product = await createProductForSeller(seller.seller.id, category.id, { priceCents: 2000, stockQty: 5 });
    await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product.id, quantity: 2 });
  });

  afterEach(async () => {
    await prisma.cartRemovalNotice.deleteMany({ where: { cart: { userId: buyer.id } } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: buyer.id } } });
    await prisma.product.deleteMany({ where: { id: product.id } });
  });

  afterAll(async () => {
    await prisma.cart.deleteMany({ where: { userId: buyer.id } });
    await cleanupUser(buyer.id);
    await cleanupSeller(seller.seller.id, seller.user.id);
    await cleanupCategory(category.id);
  });

  function getCart() {
    return request(app).get("/api/cart").set("Authorization", `Bearer ${token}`);
  }

  // --- What must NOT remove an item ----------------------------------------

  it("keeps the item when the product sells out down to zero stock", async () => {
    // The distinction the whole feature turns on: no units left is not the
    // same as the seller saying it's gone, and only the second empties a cart.
    await prisma.product.update({ where: { id: product.id }, data: { stockQty: 0 } });

    const res = await getCart();
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].unavailableReason).toBe("insufficient_stock");
    // Not counted in the money, but still the buyer's.
    expect(res.body.cart.totalCents).toBe(0);
    expect(res.body.cart.unavailableCount).toBe(1);
  });

  it("keeps the item when the seller raises the price", async () => {
    await prisma.product.update({ where: { id: product.id }, data: { priceCents: 9999 } });

    const res = await getCart();
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].unavailableReason).toBeNull();
    // The cart prices live, so the total follows the new price.
    expect(res.body.cart.totalCents).toBe(9999 * 2);
  });

  it("keeps the item when the seller's store is suspended", async () => {
    await prisma.seller.update({ where: { id: seller.seller.id }, data: { status: "suspended" } });

    const res = await getCart();
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].unavailableReason).toBe("store_unavailable");

    await prisma.seller.update({ where: { id: seller.seller.id }, data: { status: "approved" } });
  });

  it("restores buyability when a suspended store is reinstated", async () => {
    await prisma.seller.update({ where: { id: seller.seller.id }, data: { status: "suspended" } });
    await prisma.seller.update({ where: { id: seller.seller.id }, data: { status: "approved" } });

    const res = await getCart();
    expect(res.body.cart.items[0].unavailableReason).toBeNull();
    expect(res.body.cart.purchasableCount).toBe(1);
  });

  // --- What DOES remove an item --------------------------------------------

  it("removes the item only when the seller confirms it out of stock, and says why", async () => {
    const res = await request(app)
      .patch(`/api/sellers/me/products/${product.id}/availability`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "out_of_stock" });

    expect(res.status).toBe(200);
    expect(res.body.removedFromCarts).toBe(1);

    const cart = await getCart();
    expect(cart.body.cart.items).toHaveLength(0);
    // Removed, but not silently: the customer never asked for this.
    expect(cart.body.cart.removalNotices).toHaveLength(1);
    expect(cart.body.cart.removalNotices[0]).toMatchObject({
      productName: product.name,
      quantity: 2,
      reason: "The seller confirmed this product is out of stock.",
    });
  });

  it("removes the item when the seller withdraws the listing", async () => {
    const res = await request(app)
      .delete(`/api/sellers/me/products/${product.id}`)
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ archived: true, removedFromCarts: 1 });

    const cart = await getCart();
    expect(cart.body.cart.items).toHaveLength(0);
    expect(cart.body.cart.removalNotices[0].reason).toBe("The seller withdrew this listing.");
  });

  it("shows each removal notice once, then stops", async () => {
    await request(app)
      .patch(`/api/sellers/me/products/${product.id}/availability`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "out_of_stock" });

    expect((await getCart()).body.cart.removalNotices).toHaveLength(1);

    const dismissed = await request(app)
      .post("/api/cart/notices/dismiss")
      .set("Authorization", `Bearer ${token}`);
    expect(dismissed.status).toBe(200);

    expect((await getCart()).body.cart.removalNotices).toHaveLength(0);
  });

  it("does not restore a cart when the seller puts the product back on sale", async () => {
    // Those buyers were already told it was gone. Silently putting it back in
    // their cart would be a second surprise, not a fix.
    await request(app)
      .patch(`/api/sellers/me/products/${product.id}/availability`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "out_of_stock" });

    await request(app)
      .patch(`/api/sellers/me/products/${product.id}/availability`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "active" });

    expect((await getCart()).body.cart.items).toHaveLength(0);
  });

  // --- Withdrawal is a soft delete -----------------------------------------

  it("withdraws a listing that has order history instead of failing on the foreign key", async () => {
    // The bug this replaces: every FK into products is ON DELETE RESTRICT, so
    // a real delete of a product anyone had ever bought returned a 500.
    const otherBuyer = await createUser("customer");
    const address = await prisma.address.create({
      data: { userId: otherBuyer.id, line1: "1 Way", city: "T", postalCode: "0", country: "T" },
    });
    const order = await prisma.order.create({
      data: {
        userId: otherBuyer.id,
        shippingAddressId: address.id,
        status: "pending_payment",
        totalCents: 2000,
        items: { create: [{ productId: product.id, sellerId: seller.seller.id, quantity: 1, unitPriceCents: 2000 }] },
      },
    });

    const res = await request(app)
      .delete(`/api/sellers/me/products/${product.id}`)
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(res.status).toBe(200);
    // The row survives, so the order still knows what was bought.
    const stillThere = await prisma.product.findUnique({ where: { id: product.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere!.status).toBe("archived");
    expect(stillThere!.archivedAt).not.toBeNull();

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.deleteMany({ where: { id: order.id } });
    await prisma.address.deleteMany({ where: { id: address.id } });
    await cleanupUser(otherBuyer.id);
  });

  it("hides a withdrawn listing from the storefront but keeps its page out of the catalog", async () => {
    await request(app)
      .delete(`/api/sellers/me/products/${product.id}`)
      .set("Authorization", `Bearer ${sellerToken}`);

    const list = await request(app).get(`/api/products?sellerId=${seller.seller.id}`);
    expect(list.body.products.map((p: { id: string }) => p.id)).not.toContain(product.id);

    const detail = await request(app).get(`/api/products/${product.slug}`);
    expect(detail.status).toBe(404);
  });

  it("keeps an out-of-stock listing visible on the storefront", async () => {
    // Out of stock is a normal state for a shop to be in — hiding the page
    // would break every link and every cart row pointing at it.
    await request(app)
      .patch(`/api/sellers/me/products/${product.id}/availability`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "out_of_stock" });

    const detail = await request(app).get(`/api/products/${product.slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.product.status).toBe("out_of_stock");
  });

  it("refuses to add a confirmed out-of-stock product to a cart in the first place", async () => {
    await request(app)
      .patch(`/api/sellers/me/products/${product.id}/availability`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "out_of_stock" });

    const res = await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product.id, quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/out of stock/i);
  });

  // --- Concurrency ----------------------------------------------------------

  it("merges concurrent adds of the same product into one line", async () => {
    // The (cart_id, product_id) unique index plus an upsert. The old
    // read-then-write created two rows and split the quantity between them.
    await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post("/api/cart/items")
          .set("Authorization", `Bearer ${token}`)
          .send({ productId: product.id, quantity: 1 }),
      ),
    );

    const res = await getCart();
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].quantity).toBe(7); // 2 from beforeEach + 5
  });
});

/**
 * The seller-facing side of the same rule: only the owner can confirm a
 * product gone, and only for their own listings.
 */
describe("product availability ownership", () => {
  let category: Awaited<ReturnType<typeof createCategory>>;
  let mine: Awaited<ReturnType<typeof createApprovedSeller>>;
  let theirs: Awaited<ReturnType<typeof createApprovedSeller>>;
  let theirProduct: Awaited<ReturnType<typeof createProductForSeller>>;

  beforeAll(async () => {
    category = await createCategory();
    mine = await createApprovedSeller();
    theirs = await createApprovedSeller();
    theirProduct = await createProductForSeller(theirs.seller.id, category.id);
  });

  afterAll(async () => {
    await cleanupSeller(mine.seller.id, mine.user.id);
    await cleanupSeller(theirs.seller.id, theirs.user.id);
    await cleanupCategory(category.id);
  });

  it("refuses to let one seller mark another seller's product out of stock", async () => {
    const res = await request(app)
      .patch(`/api/sellers/me/products/${theirProduct.id}/availability`)
      .set("Authorization", `Bearer ${tokenFor(mine.user)}`)
      .send({ status: "out_of_stock" });

    expect(res.status).toBe(403);
    const untouched = await prisma.product.findUnique({ where: { id: theirProduct.id } });
    expect(untouched!.status).toBe("active");
  });

  it("rejects a no-op transition rather than silently re-clearing carts", async () => {
    const res = await request(app)
      .patch(`/api/sellers/me/products/${theirProduct.id}/availability`)
      .set("Authorization", `Bearer ${tokenFor(theirs.user)}`)
      .send({ status: "active" });

    expect(res.status).toBe(409);
  });
});
