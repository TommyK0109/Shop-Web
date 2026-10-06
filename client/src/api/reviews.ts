import { apiFetch } from "./client";
import type { Review } from "./types";

export interface CreateReviewBody {
  rating: number;
  comment?: string;
}

export function createReview(productId: string, body: CreateReviewBody) {
  return apiFetch<{ review: Review }>(`/products/${productId}/reviews`, { method: "POST", body });
}

export function listProductReviews(productId: string) {
  return apiFetch<{ reviews: Review[] }>(`/products/${productId}/reviews`);
}
