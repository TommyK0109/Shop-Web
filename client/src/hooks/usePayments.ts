import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RejectPaymentInput, UpdatePaymentMethodInput } from "@storefront/shared";
import {
  confirmPaymentReceived,
  getMyPaymentMethod,
  listMyPayments,
  markPaymentTransferred,
  rejectPayment,
  updateMyPaymentMethod,
} from "../api/payments";

// --- Buyer

/**
 * Settling a payment changes the order it belongs to (its derived status) and
 * the seller's fulfilment queue, so both caches are dropped rather than
 * patched — the server owns the derivation.
 */
function useSettlementMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order"] });
      queryClient.invalidateQueries({ queryKey: ["seller", "me", "payments"] });
      queryClient.invalidateQueries({ queryKey: ["seller", "me", "orders"] });
    },
  });
}

export function useMarkPaymentTransferred() {
  return useSettlementMutation((paymentId: string) => markPaymentTransferred(paymentId));
}

// --- Seller

export function useMyPaymentMethod() {
  return useQuery({ queryKey: ["seller", "me", "payment-method"], queryFn: getMyPaymentMethod });
}

export function useUpdateMyPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePaymentMethodInput) => updateMyPaymentMethod(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller", "me", "payment-method"] }),
  });
}

export function useMyPayments() {
  return useQuery({ queryKey: ["seller", "me", "payments"], queryFn: listMyPayments });
}

export function useConfirmPayment() {
  return useSettlementMutation((paymentId: string) => confirmPaymentReceived(paymentId));
}

export function useRejectPayment() {
  return useSettlementMutation(({ id, input }: { id: string; input: RejectPaymentInput }) =>
    rejectPayment(id, input),
  );
}
