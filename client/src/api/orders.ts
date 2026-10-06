import { apiFetch } from "./client";
import type { Order, ShippingAddressInput } from "./types";

export interface CreateOrderResponse {
  orderId: string;
  /** The created order, payments and QR codes included — no off-site redirect. */
  order: Order;
}

export function createOrder(shippingAddress: ShippingAddressInput) {
  return apiFetch<CreateOrderResponse>("/orders", { method: "POST", body: { shippingAddress } });
}

export function listOrders() {
  return apiFetch<{ orders: Order[] }>("/orders");
}

export function getOrder(id: string) {
  return apiFetch<{ order: Order }>(`/orders/${id}`);
}

/** Only allowed while the order is still `pending_payment` — see server/src/controllers/orders.controller.ts. */
export function cancelOrder(id: string) {
  return apiFetch<{ order: Order }>(`/orders/${id}/cancel`, { method: "POST" });
}
