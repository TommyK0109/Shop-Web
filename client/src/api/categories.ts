import { apiFetch } from "./client";
import type { Category } from "./types";

export function listCategories() {
  return apiFetch<{ categories: Category[] }>("/categories");
}
