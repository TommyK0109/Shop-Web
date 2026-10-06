import { useQuery } from "@tanstack/react-query";
import { getProductSuggestions, listProducts, type ProductListParams } from "../api/products";

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => listProducts(params),
    placeholderData: (previousData) => previousData,
  });
}

/** Navbar typeahead. Caller is expected to pass an already-debounced query. */
export function useProductSuggestions(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["products", "suggestions", trimmed],
    queryFn: () => getProductSuggestions(trimmed),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
}
