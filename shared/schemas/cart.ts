import { z } from "zod";

export const addCartItemSchema = z.object({
  productId: z.string().uuid("Invalid product"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive("Quantity must be at least 1"),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
