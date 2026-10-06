import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { OrderStatus, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { signAccessToken } from "../src/lib/jwt";
import { slugify } from "../src/lib/slug";
import { generateDemoPaymentMethod, generatePaymentReference } from "../src/services/vietqr.services";

// Cost factor 4 keeps password hashing fast in tests; production still
// hashes at 10 (see auth.controller.ts).
export async function createUser(role: UserRole = "customer") {
  return prisma.user.create({
    data: {
      email: `test-${randomUUID()}@example.com`,
      passwordHash: await bcrypt.hash("Password123!", 4),
      role,
    },
  });
}

export function tokenFor(user: { id: string; role: UserRole }): string {
  return signAccessToken({ sub: user.id, role: user.role });
}

export async function createCategory(name = `Test Category ${randomUUID()}`) {
  return prisma.category.create({ data: { name, slug: slugify(`${name}-${randomUUID()}`) } });
}

export async function createApprovedSeller(overrides: Partial<Parameters<typeof prisma.seller.create>[0]["data"]> = {}) {
  const user = await createUser("seller");
  const seller = await prisma.seller.create({
    data: {
      userId: user.id,
      applicantName: "Test Seller",
      nationalIdMasked: "1234",
      businessName: `Test Store ${randomUUID()}`,
      slug: slugify(`test-store-${randomUUID()}`),
      addressLine1: "123 Main St",
      city: "Testville",
      postalCode: "00000",
      country: "Testland",
      status: "approved",
      ...overrides,
    },
  });
  // Provisioned for real sellers when they apply; tests build the row
  // directly, so they have to do the same or checkout has nowhere to send
  // the money.
  await prisma.sellerPaymentMethod.create({
    data: { sellerId: seller.id, ...generateDemoPaymentMethod(seller.businessName) },
  });
  return { user, seller };
}

export async function createProductForSeller(
  sellerId: string,
  categoryId: string,
  overrides: Partial<Parameters<typeof prisma.product.create>[0]["data"]> = {},
) {
  return prisma.product.create({
    data: {
      sellerId,
      categoryId,
      name: `Test Product ${randomUUID()}`,
      slug: slugify(`test-product-${randomUUID()}`),
      description: "A product created for tests.",
      priceCents: 1999,
      stockQty: 10,
      ...overrides,
    },
  });
}

// Deletes a seller and everything hanging off it in FK-safe order. Tests
// call this in afterAll so they clean up exactly what they created and
// leave the rest of the (possibly seeded) dev database untouched.
export async function cleanupSeller(sellerId: string, userId: string) {
  const productIds = (await prisma.product.findMany({ where: { sellerId }, select: { id: true } })).map((p) => p.id);
  await prisma.review.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.cartRemovalNotice.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.cartItem.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.productImage.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { sellerId } });
  await prisma.sellerPaymentMethod.deleteMany({ where: { sellerId } });
  await prisma.seller.deleteMany({ where: { id: sellerId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

export async function cleanupCategory(categoryId: string) {
  await prisma.category.deleteMany({ where: { id: categoryId } });
}

export async function cleanupUser(userId: string) {
  await prisma.user.deleteMany({ where: { id: userId } });
}

/**
 * Builds an order straight through Prisma rather than POST /api/orders.
 * Fulfilment and review tests need an order that already exists in a given
 * state, not the checkout flow itself.
 *
 * Crucially this creates the per-seller Payment rows too: fulfilment and
 * verified-purchase checks now read those, not `order.status`, so an order
 * without them is a state the application can never actually produce.
 */
export async function createOrder(
  userId: string,
  items: Array<{ productId: string; sellerId: string; quantity?: number; unitPriceCents?: number }>,
  status: OrderStatus = "paid",
) {
  const address = await prisma.address.create({
    data: { userId, line1: "1 Test Way", city: "Testville", postalCode: "00000", country: "Testland" },
  });

  const rows = items.map((item) => ({
    productId: item.productId,
    sellerId: item.sellerId,
    quantity: item.quantity ?? 1,
    unitPriceCents: item.unitPriceCents ?? 1000,
  }));

  const order = await prisma.order.create({
    data: {
      userId,
      shippingAddressId: address.id,
      status,
      totalCents: rows.reduce((sum, row) => sum + row.unitPriceCents * row.quantity, 0),
      items: { create: rows },
    },
    include: { items: true },
  });

  // One payment per seller, amounts split by that seller's own line items —
  // the same shape the checkout route produces.
  const bySeller = new Map<string, number>();
  for (const row of rows) {
    bySeller.set(row.sellerId, (bySeller.get(row.sellerId) ?? 0) + row.unitPriceCents * row.quantity);
  }

  const sellerIds = [...bySeller.keys()];
  for (const [index, sellerId] of sellerIds.entries()) {
    const method =
      (await prisma.sellerPaymentMethod.findUnique({ where: { sellerId } })) ??
      (await prisma.sellerPaymentMethod.create({
        data: { sellerId, ...generateDemoPaymentMethod("Test Store") },
      }));

    // "partially_paid" means exactly one seller settled, which is only a
    // distinct state when the order actually spans more than one.
    const settled =
      status === "paid" || (status === "partially_paid" && index === 0);

    await prisma.payment.create({
      data: {
        orderId: order.id,
        sellerId,
        amountCents: bySeller.get(sellerId)!,
        reference: generatePaymentReference(),
        status: settled ? "succeeded" : "pending",
        confirmedAt: settled ? new Date() : null,
        bankBin: method.bankBin,
        bankName: method.bankName,
        accountNumber: method.accountNumber,
        accountName: method.accountName,
      },
    });
  }

  return order;
}

// Must run before cleanupSeller — products can't be deleted while order
// items still point at them.
export async function cleanupOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { shippingAddressId: true },
  });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.shipment.deleteMany({ where: { orderId } });
  await prisma.payment.deleteMany({ where: { orderId } });
  await prisma.order.deleteMany({ where: { id: orderId } });
  if (order) {
    await prisma.address.deleteMany({ where: { id: order.shippingAddressId } });
  }
}
