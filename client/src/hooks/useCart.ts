import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addCartItem, dismissRemovalNotices, getCart, removeCartItem, updateCartItem } from "../api/cart";
import { useAuthStore } from "../store/authStore";

export function useCart() {
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated");
  return useQuery({
    queryKey: ["cart"],
    queryFn: getCart,
    enabled: isAuthenticated,
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      addCartItem(productId, quantity),
    onSuccess: (data) => queryClient.setQueryData(["cart"], data),
  });
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => updateCartItem(itemId, quantity),
    onSuccess: (data) => queryClient.setQueryData(["cart"], data),
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => removeCartItem(itemId),
    onSuccess: (data) => queryClient.setQueryData(["cart"], data),
  });
}

export function useDismissRemovalNotices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dismissRemovalNotices,
    onSuccess: (data) => queryClient.setQueryData(["cart"], data),
  });
}
