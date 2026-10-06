import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateProductInput,
  CreateShipmentInput,
  SellerApplicationInput,
  SetProductAvailabilityInput,
  UpdateProductInput,
  UpdateShipmentInput,
} from "@storefront/shared";
import {
  applyToSell,
  createMyProduct,
  createShipment,
  deleteMyProduct,
  getMySeller,
  getSellerBySlug,
  listMyProducts,
  listMySellerOrders,
  setMyProductAvailability,
  updateMyProduct,
  updateShipment,
} from "../api/sellers";
import { ApiError } from "../api/client";
import { useAuthStore } from "../store/authStore";
import type { MySeller } from "../api/types";

export function useSeller(slug: string | undefined) {
  return useQuery({
    queryKey: ["seller", slug],
    queryFn: () => getSellerBySlug(slug!),
    enabled: Boolean(slug),
  });
}

/**
 * "Does the signed-in user have a store, and what state is it in?" — the one
 * source of truth the nav link and the /seller route guard both read.
 *
 * A 403 here isn't a failure: it's the normal answer for the majority of
 * users, who have simply never applied. It's resolved to `seller: null` so
 * the UI can branch on data rather than on an error, and retry is off so a
 * customer doesn't fire the same 403 twice on every page load.
 */
export function useMySeller() {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated");
  return useQuery<{ seller: MySeller | null }>({
    queryKey: ["seller", "me"],
    queryFn: async () => {
      try {
        return await getMySeller();
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) return { seller: null };
        throw err;
      }
    },
    enabled: isAuthenticated,
    retry: false,
  });
}

export function useApplyToSell() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SellerApplicationInput) => applyToSell(input),
    onSuccess: ({ seller }) => {
      // Seed the probe query straight from the response so the dashboard the
      // applicant lands on doesn't flash an empty state while it refetches.
      queryClient.setQueryData(["seller", "me"], { seller });
      queryClient.invalidateQueries({ queryKey: ["seller", "me", "products"] });
    },
  });
}

// --- My catalog
export function useMyProducts() {
  return useQuery({ queryKey: ["seller", "me", "products"], queryFn: listMyProducts });
}

function useMyCatalogMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller", "me", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useCreateMyProduct() {
  return useMyCatalogMutation((input: CreateProductInput) => createMyProduct(input));
}

export function useUpdateMyProduct() {
  return useMyCatalogMutation(({ id, input }: { id: string; input: UpdateProductInput }) =>
    updateMyProduct(id, input),
  );
}

export function useDeleteMyProduct() {
  return useMyCatalogMutation((id: string) => deleteMyProduct(id));
}

/**
 * Confirming a listing out of stock (or back on sale). Also invalidates the
 * cart, since this is the one action that can remove something from it.
 */
export function useSetMyProductAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SetProductAvailabilityInput }) =>
      setMyProductAvailability(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller", "me", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

// --- Fulfilment -------------------------------------------------------------

export function useMySellerOrders() {
  return useQuery({ queryKey: ["seller", "me", "orders"], queryFn: listMySellerOrders });
}

// Confirming or advancing a shipment changes what the order view shows, and
// it's the same shipment the customer's order history renders — invalidate
// both sides rather than patching the cache by hand.
function useMyShipmentMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller", "me", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useCreateShipment() {
  return useMyShipmentMutation((input: CreateShipmentInput) => createShipment(input));
}

export function useUpdateShipment() {
  return useMyShipmentMutation(({ id, input }: { id: string; input: UpdateShipmentInput }) =>
    updateShipment(id, input),
  );
}
