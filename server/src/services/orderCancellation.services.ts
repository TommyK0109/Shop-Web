import type { Prisma } from "@prisma/client";

/**
 * Gives stock back for an order's items — but only for sellers whose payment
 * never succeeded. A slice that already succeeded is a real sale: money has
 * moved, so cancelling the order must not let those units be resold while
 * the seller keeps what they were paid for.
 *
 * Call this inside the same transaction as the status change, same rule as
 * evictProductFromCarts.
 */
export async function restockUnpaidItems(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const [items, succeededPayments] = await Promise.all([
    tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true, sellerId: true },
    }),
    tx.payment.findMany({
      where: { orderId, status: "succeeded" },
      select: { sellerId: true },
    }),
  ]);

  const paidSellerIds = new Set(succeededPayments.map((p) => p.sellerId));

  for (const item of items) {
    if (paidSellerIds.has(item.sellerId)) continue;
    await tx.product.update({
      where: { id: item.productId },
      data: { stockQty: { increment: item.quantity } },
    });
  }
}
