import type { Prisma, Product, ProductStatus } from "@prisma/client";

/**
 * Products a shopper is allowed to see. `archived` is the soft-delete — the
 * row survives because carts, orders and reviews all point at it, but it is
 * gone from the storefront.
 *
 * `out_of_stock` deliberately stays visible: it is a normal state for a shop
 * to be in, and hiding the page would break every link and every cart row
 * that points at it.
 */
export const publiclyVisibleStatuses: ProductStatus[] = ["active", "out_of_stock"];

export const publicProductWhere: Prisma.ProductWhereInput = {
  seller: { status: "approved" },
  status: { in: publiclyVisibleStatuses },
};

/** Why a cart line cannot be bought right now, or null if it can. */
export type UnavailableReason =
  | "seller_marked_out_of_stock"
  | "listing_withdrawn"
  | "store_unavailable"
  | "insufficient_stock";

export interface AvailabilityInput {
  status: ProductStatus;
  stockQty: number;
  seller: { status: string };
}

/**
 * Whether a given quantity of a product can go through checkout.
 *
 * Note the order: the seller's own confirmation is reported ahead of a bare
 * stock shortfall, because the two mean different things to a shopper.
 * "The store says this is gone" is final; "only 2 left" is a nudge to reduce
 * the quantity.
 */
export function unavailableReason(product: AvailabilityInput, quantity: number): UnavailableReason | null {
  if (product.status === "archived") return "listing_withdrawn";
  if (product.status === "out_of_stock") return "seller_marked_out_of_stock";
  if (product.seller.status !== "approved") return "store_unavailable";
  if (product.stockQty < quantity) return "insufficient_stock";
  return null;
}

const REASON_MESSAGE: Record<UnavailableReason, string> = {
  seller_marked_out_of_stock: "The seller has marked this as out of stock",
  listing_withdrawn: "The seller has withdrawn this listing",
  store_unavailable: "This store is not currently open",
  insufficient_stock: "There isn't enough stock left for this quantity",
};

export function unavailableMessage(reason: UnavailableReason): string {
  return REASON_MESSAGE[reason];
}

/**
 * The sentence a customer sees on the notice explaining why something left
 * their cart. Only the two seller-initiated states get here — nothing else is
 * ever allowed to remove a cart row on the customer's behalf.
 */
export function removalReasonFor(status: Extract<ProductStatus, "out_of_stock" | "archived">): string {
  return status === "out_of_stock"
    ? "The seller confirmed this product is out of stock."
    : "The seller withdrew this listing.";
}

export function isPurchasable(product: Product & { seller: { status: string } }, quantity: number): boolean {
  return unavailableReason(product, quantity) === null;
}
