import { apiFetch } from "./client";
import type { Cart } from "./types";

export function getCart() {
  return apiFetch<{ cart: Cart }>("/cart");
}

export function addCartItem(productId: string, quantity: number) {
  return apiFetch<{ cart: Cart }>("/cart/items", { method: "POST", body: { productId, quantity } });
}

export function updateCartItem(itemId: string, quantity: number) {
  return apiFetch<{ cart: Cart }>(`/cart/items/${itemId}`, { method: "PATCH", body: { quantity } });
}

export function removeCartItem(itemId: string) {
  return apiFetch<{ cart: Cart }>(`/cart/items/${itemId}`, { method: "DELETE" });
}

/** Acknowledges the "the seller removed this" notices so they show once. */
export function dismissRemovalNotices() {
  return apiFetch<{ cart: Cart }>("/cart/notices/dismiss", { method: "POST" });
}
