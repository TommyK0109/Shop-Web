import type { Prisma, ProductStatus } from "@prisma/client";
import { removalReasonFor } from "./productAvailability.services";

/**
 * The single sanctioned path by which the *server* removes something from a
 * customer's cart.
 *
 * A cart is otherwise permanent: it survives the product selling out, the
 * price changing, the store being suspended, the listing being hidden, and
 * the customer not coming back for a year. Only the seller explicitly
 * confirming the product is gone — `out_of_stock`, or `archived` as the
 * soft-delete — clears it, and even then the customer is left a notice
 * saying what happened rather than finding a row silently missing.
 *
 * Call this inside the same transaction as the status change, so a cart can
 * never be cleared for a product that then fails to change state.
 */
export async function removeProductFromCarts(
  tx: Prisma.TransactionClient,
  productId: string,
  status: Extract<ProductStatus, "out_of_stock" | "archived">,
): Promise<number> {
  const affected = await tx.cartItem.findMany({
    where: { productId },
    select: { id: true, cartId: true, quantity: true, product: { select: { name: true } } },
  });

  if (affected.length === 0) return 0;

  const reason = removalReasonFor(status);
  await tx.cartRemovalNotice.createMany({
    data: affected.map((item) => ({
      cartId: item.cartId,
      productId,
      // The name is copied rather than joined: the notice has to still read
      // correctly if the seller renames the listing afterwards.
      productName: item.product.name,
      quantity: item.quantity,
      reason,
    })),
  });

  await tx.cartItem.deleteMany({ where: { id: { in: affected.map((item) => item.id) } } });
  return affected.length;
}
