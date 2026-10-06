import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  deleteCategory,
  listAllOrders,
  listSellerApplications,
  moderateProduct,
  removeProduct,
  updateCategory,
  updateOrderStatus,
  updateSellerStatus,
  type AdminOrderListParams,
  type ModerateProductBody,
} from "../api/admin";
import type { SellerStatus } from "../api/types";

export function useAdminOrders(params: AdminOrderListParams) {
  return useQuery({
    queryKey: ["admin", "orders", params],
    queryFn: () => listAllOrders(params),
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "cancelled" }) =>
      updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });
}

// Categories are read through the same public useCategories query the
// storefront filter uses, so every mutation invalidates that one key.
function useCategoryMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useCreateCategory() {
  return useCategoryMutation((name: string) => createCategory(name));
}

export function useUpdateCategory() {
  return useCategoryMutation(({ id, name }: { id: string; name: string }) => updateCategory(id, name));
}

export function useDeleteCategory() {
  return useCategoryMutation((id: string) => deleteCategory(id));
}

export function useModerateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ModerateProductBody }) => moderateProduct(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useRemoveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// --- Seller applications ----------------------------------------------------

export function useSellerApplications(status?: SellerStatus) {
  return useQuery({
    queryKey: ["admin", "sellers", status ?? "all"],
    queryFn: () => listSellerApplications(status),
  });
}

export function useUpdateSellerStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<SellerStatus, "pending"> }) =>
      updateSellerStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "sellers"] });
      // Approving or suspending a seller changes which products the public
      // catalog is allowed to show, so that list is stale now too.
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
