import type { OrderItem, OrderSellerGroup, ShipmentStatus } from "../api/types";

/**
 * Splits an order's line items into one group per seller. A marketplace cart
 * can span several stores, and each store fulfils its own items on its own
 * timeline — so the customer sees "Sold by X: packed" next to "Sold by Y:
 * confirmed" rather than one status for the whole order.
 */
export function groupItemsBySeller(items: OrderItem[]): OrderSellerGroup[] {
  const groups = new Map<string, OrderSellerGroup>();

  for (const item of items) {
    let group = groups.get(item.sellerId);
    if (!group) {
      group = {
        sellerId: item.sellerId,
        seller: item.seller,
        items: [],
        // Every item from one seller in one order shares a single shipment,
        // so the first item's is the group's.
        shipment: item.shipment,
        subtotalCents: 0,
      };
      groups.set(item.sellerId, group);
    }
    group.items.push(item);
    group.subtotalCents += item.unitPriceCents * item.quantity;
  }

  return [...groups.values()];
}

export const SHIPMENT_STEPS: ShipmentStatus[] = ["confirmed", "packed", "received"];

export const SHIPMENT_LABEL: Record<ShipmentStatus, string> = {
  confirmed: "Confirmed by seller",
  packed: "Packed and on its way",
  received: "Received",
};
