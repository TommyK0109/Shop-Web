import type {
  CreateProductInput,
  CreateShipmentInput,
  SellerApplicationInput,
  SetProductAvailabilityInput,
  UpdateProductInput,
  UpdateShipmentInput,
} from "@storefront/shared";
import { apiFetch } from "./client";
import type { MySeller, Seller, SellerOrderGroup, SellerProductSummary, Shipment } from "./types";

export function getSellerBySlug(slug: string) {
  return apiFetch<{ seller: Seller }>(`/sellers/${slug}`);
}

// --- Applying ---------------------------------------------------------------

export function applyToSell(input: SellerApplicationInput) {
  return apiFetch<{ seller: MySeller }>("/sellers/apply", { method: "POST", body: input });
}

// --- My store ---------------------------------------------------------------

export function getMySeller() {
  return apiFetch<{ seller: MySeller }>("/sellers/me");
}

export function listMyProducts() {
  return apiFetch<{ products: SellerProductSummary[] }>("/sellers/me/products");
}

export function createMyProduct(input: CreateProductInput) {
  return apiFetch<{ product: SellerProductSummary }>("/sellers/me/products", { method: "POST", body: input });
}

export function updateMyProduct(id: string, input: UpdateProductInput) {
  return apiFetch<{ product: SellerProductSummary }>(`/sellers/me/products/${id}`, {
    method: "PATCH",
    body: input,
  });
}

/**
 * Confirms a listing is out of stock, or puts it back on sale. This is the
 * only action that clears the product out of customers' carts — the response
 * reports how many it affected so the seller sees the consequence.
 */
export function setMyProductAvailability(id: string, input: SetProductAvailabilityInput) {
  return apiFetch<{ product: SellerProductSummary; removedFromCarts: number }>(
    `/sellers/me/products/${id}/availability`,
    { method: "PATCH", body: input },
  );
}

/** Soft delete: archives the listing. The row survives for order history. */
export function deleteMyProduct(id: string) {
  return apiFetch<{ archived: true; removedFromCarts: number }>(`/sellers/me/products/${id}`, {
    method: "DELETE",
  });
}

// --- Fulfilment -------------------------------------------------------------

export function listMySellerOrders() {
  return apiFetch<{ orders: SellerOrderGroup[] }>("/sellers/me/orders");
}

/** "Confirm this order" — creates the one shipment covering my items in it. */
export function createShipment(input: CreateShipmentInput) {
  return apiFetch<{ shipment: Shipment }>("/sellers/me/shipments", { method: "POST", body: input });
}

/** Advance a shipment one step: confirmed → packed → received. */
export function updateShipment(id: string, input: UpdateShipmentInput) {
  return apiFetch<{ shipment: Shipment }>(`/sellers/me/shipments/${id}`, { method: "PATCH", body: input });
}
