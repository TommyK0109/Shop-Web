import { apiFetch } from "./client";
import type { UpdateProductInput } from "@storefront/shared";
import type {
  AdminOrder,
  Category,
  MySeller,
  Order,
  OrderStatus,
  Pagination,
  Product,
  SellerApplication,
  SellerStatus,
} from "./types";

export interface AdminOrderListParams {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

export function listAllOrders(params: AdminOrderListParams = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return apiFetch<{ orders: AdminOrder[]; pagination: Pagination }>(`/admin/orders${qs ? `?${qs}` : ""}`);
}

// PATCH /api/orders/:id/status is the shared order route, so it answers with
// the customer-shaped order (no `user`), not the admin list shape. The body
// goes unread anyway — the mutation refetches the admin list on success.
/** Cancel or reinstate. Paid-ness is derived server-side; see the route. */
export function updateOrderStatus(id: string, status: "active" | "cancelled") {
  return apiFetch<{ order: Order }>(`/orders/${id}/status`, { method: "PATCH", body: { status } });
}

export function createCategory(name: string) {
  return apiFetch<{ category: Category }>("/categories", { method: "POST", body: { name } });
}

export function updateCategory(id: string, name: string) {
  return apiFetch<{ category: Category }>(`/categories/${id}`, { method: "PATCH", body: { name } });
}

export function deleteCategory(id: string) {
  return apiFetch<void>(`/categories/${id}`, { method: "DELETE" });
}

export type ModerateProductBody = UpdateProductInput;

export function moderateProduct(id: string, body: ModerateProductBody) {
  return apiFetch<{ product: Product }>(`/products/${id}`, { method: "PATCH", body });
}

export function removeProduct(id: string) {
  return apiFetch<void>(`/products/${id}`, { method: "DELETE" });
}

// --- Seller applications ----------------------------------------------------

/** Omitting `status` lists every application, in any state. */
export function listSellerApplications(status?: SellerStatus) {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<{ sellers: SellerApplication[] }>(`/admin/sellers${qs}`);
}

export function updateSellerStatus(id: string, status: Exclude<SellerStatus, "pending">) {
  return apiFetch<{ seller: MySeller }>(`/admin/sellers/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
}
