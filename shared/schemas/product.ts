import { z } from "zod";

/** Optional documented attributes for the Electronics catalog. Omitted means unknown. */
export const productSpecificationsSchema = z.object({
  kind: z.enum(["headphones", "webcam", "accessory"]).optional(),
  connectivity: z.array(z.enum(["bluetooth", "usb-a", "usb-c", "3.5mm", "wireless-2.4ghz", "hdmi"])).max(6).optional(),
  microphone: z.boolean().optional(),
  batteryHours: z.number().finite().min(0).max(1000).optional(),
  weightGrams: z.number().finite().positive().max(100_000).optional(),
  compatibility: z.array(z.enum(["windows", "macos", "linux", "android", "ios", "chromeos"])).max(6).optional(),
  limitations: z.array(z.string().trim().min(1).max(300)).max(10).optional(),
  resolution: z.string().trim().min(1).max(50).optional(),
  frameRateFps: z.number().int().positive().max(1000).optional(),
  cableLengthMeters: z.number().finite().positive().max(100).optional(),
}).strict();
export type ProductSpecifications = z.infer<typeof productSpecificationsSchema>;

export function supportsProductSpecifications(categorySlug: string): boolean {
  return categorySlug.toLowerCase() === "electronics";
}

export const createProductSchema = z.object({
  categoryId: z.string().uuid("Invalid category"),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().min(1, "Description is required").max(12_000),
  specifications: productSpecificationsSchema.nullable().optional(),
  priceCents: z.number().int().positive("Price must be a positive integer number of cents"),
  stockQty: z.number().int().min(0, "Stock quantity cannot be negative"),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Admin moderation route creates a product on behalf of a specific seller,
// since every product row requires a seller_id — there's no "platform-owned,
// no seller" row in the schema.
export const adminCreateProductSchema = createProductSchema.extend({
  sellerId: z.string().uuid("Invalid seller"),
});
export type AdminCreateProductInput = z.infer<typeof adminCreateProductSchema>;

/**
 * The seller confirming whether a listing can still be bought.
 *
 * This is the *only* thing that takes a product out of a customer's cart, so
 * it is an explicit action rather than a side effect of `stockQty` reaching
 * zero — running out of units is a restock away from being fixed and must not
 * empty anyone's cart. `archived` is the soft-delete: it also clears carts,
 * because the seller has withdrawn the listing for good.
 */
export const setProductAvailabilitySchema = z.object({
  status: z.enum(["active", "out_of_stock"]),
});
export type SetProductAvailabilityInput = z.infer<typeof setProductAvailabilitySchema>;

// Query params arrive as strings, so numeric fields go through coerce.
export const productQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().optional(),
  sellerId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ProductQueryInput = z.infer<typeof productQuerySchema>;

// Kept separate from productQuerySchema: this backs the navbar typeahead,
// so `q` is required (no empty-query "browse everything" mode) and `limit`
// is capped much lower than the list endpoint's, since it's rendered in a
// dropdown rather than a page.
export const productSuggestQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().positive().max(10).default(5),
});
export type ProductSuggestQueryInput = z.infer<typeof productSuggestQuerySchema>;
