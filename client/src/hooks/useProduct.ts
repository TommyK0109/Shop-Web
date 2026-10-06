import { useQuery } from "@tanstack/react-query";
import { getProductBySlug } from "../api/products";

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProductBySlug(slug!),
    enabled: Boolean(slug),
  });
}
