import { z } from "zod";

/**
 * A store's bank details. Provisioned automatically with mock values when a
 * seller applies (nobody should be approved with no way to receive money),
 * and editable from the seller dashboard afterwards.
 */
export const updatePaymentMethodSchema = z.object({
  // Napas member-bank BIN. Validated against the known list server-side —
  // the shape check here only catches typos early in the form.
  bankBin: z.string().regex(/^\d{6}$/, "Bank BIN must be 6 digits"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, "Account number must be 6-20 digits"),
  accountName: z
    .string()
    .trim()
    .min(1, "Account holder name is required")
    .max(50, "Account holder name must be 50 characters or fewer"),
});
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;

/**
 * The seller rejecting a transfer they cannot find. The reason is shown to
 * the buyer, so it is required — "rejected, no explanation" is the one
 * outcome that leaves a customer with nothing to act on.
 */
export const rejectPaymentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Tell the buyer why this payment was rejected")
    .max(500, "Reason must be 500 characters or fewer"),
});
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;
