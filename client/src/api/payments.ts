import type { RejectPaymentInput, UpdatePaymentMethodInput } from "@storefront/shared";
import { apiFetch } from "./client";
import type { DemoBank, Payment, SellerPayment, SellerPaymentMethod } from "./types";

// Customer
/** "I've made the transfer" — moves the payment to awaiting_confirmation. */
export function markPaymentTransferred(paymentId: string) {
  return apiFetch<{ payment: Payment }>(`/payments/${paymentId}/mark-paid`, { method: "POST" });
}

// Seller

export function getMyPaymentMethod() {
  return apiFetch<{ paymentMethod: SellerPaymentMethod; banks: DemoBank[] }>("/sellers/me/payment-method");
}

export function updateMyPaymentMethod(input: UpdatePaymentMethodInput) {
  return apiFetch<{ paymentMethod: SellerPaymentMethod }>("/sellers/me/payment-method", {
    method: "PUT",
    body: input,
  });
}

export function listMyPayments() {
  return apiFetch<{ payments: SellerPayment[] }>("/sellers/me/payments");
}

/** "The money arrived" — the one action that unlocks fulfilment. */
export function confirmPaymentReceived(paymentId: string) {
  return apiFetch<{ payment: SellerPayment }>(`/sellers/me/payments/${paymentId}/confirm`, { method: "POST" });
}

export function rejectPayment(paymentId: string, input: RejectPaymentInput) {
  return apiFetch<{ payment: SellerPayment }>(`/sellers/me/payments/${paymentId}/reject`, {
    method: "POST",
    body: input,
  });
}
