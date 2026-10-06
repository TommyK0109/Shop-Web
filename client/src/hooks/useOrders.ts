import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelOrder, createOrder, getOrder, listOrders } from "../api/orders";
import type { ShippingAddressInput } from "../api/types";

const POLL_INTERVAL_MS = 15_000;
const POLL_WINDOW_MS = 10 * 60 * 1000;

export function useOrder(id: string | undefined) {
  const [openedAt] = useState(() => Date.now());

  return useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.order.status;
      const settling = status === "pending_payment" || status === "partially_paid";
      if (!settling) return false;
      return Date.now() - openedAt < POLL_WINDOW_MS ? POLL_INTERVAL_MS : false;
    },
  });
}

// `enabled` is opt-out rather than opt-in: the order history page always
// wants this, while the review form only asks for it once the visitor is
// signed in (an anonymous visitor would just get a 401).
export function useOrders({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["orders"],
    queryFn: listOrders,
    enabled,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shippingAddress: ShippingAddressInput) => createOrder(shippingAddress),
    onSuccess: () => {
      // The order endpoint clears the cart server-side on success; drop the
      // cached cart so the navbar badge and drawer reflect that immediately.
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export function useCancelOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelOrder(id),
    onSuccess: (data) => {
      queryClient.setQueryData(["order", id], data);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
