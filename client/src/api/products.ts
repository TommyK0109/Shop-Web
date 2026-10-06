import { apiFetch } from "./client";
import type { Pagination, Product, ProductDetail, ProductSuggestion } from "./types";

export interface ProductListParams {
  search?: string;
  categorySlug?: string;
  page?: number;
  limit?: number;
}

export interface ProductListResponse {
  products: Product[];
  pagination: Pagination;
}

export interface ProductSuggestionResponse {
  products: ProductSuggestion[];
}

export function listProducts(params: ProductListParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.categorySlug) query.set("categorySlug", params.categorySlug);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return apiFetch<ProductListResponse>(`/products${qs ? `?${qs}` : ""}`);
}

export function getProductBySlug(slug: string) {
  return apiFetch<{ product: ProductDetail }>(`/products/${slug}`);
}

export function getProductSuggestions(q: string, limit = 5) {
  const query = new URLSearchParams({ q, limit: String(limit) });
  return apiFetch<ProductSuggestionResponse>(`/products/suggestions?${query.toString()}`);
}
