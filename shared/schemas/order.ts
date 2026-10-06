import { z } from "zod";

export const createOrderSchema = z.object({
  shippingAddress: z.object({
    line1: z.string().min(1, "Address is required").max(200),
    city: z.string().min(1, "City is required").max(100),
    postalCode: z.string().min(1, "Postal code is required").max(20),
    country: z.string().min(1, "Country is required").max(100),
  }),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * An order's payment status is *derived* from its per-seller payments, not
 * set by hand — so this admin route deliberately can't set one. The only
 * order-level decision left to a human is whether the order is cancelled;
 * "active" hands it back to the derivation.
 */
export const updateOrderStatusSchema = z.object({
  status: z.enum(["active", "cancelled"]),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// Admin cross-seller order list. Query params arrive as strings, so the
// numeric fields go through coerce (same pattern as productQuerySchema).
export const adminOrderQuerySchema = z.object({
  status: z.enum(["pending_payment", "partially_paid", "paid", "cancelled"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminOrderQueryInput = z.infer<typeof adminOrderQuerySchema>;
