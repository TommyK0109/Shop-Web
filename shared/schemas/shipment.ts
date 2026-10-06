import { z } from "zod";

// A shipment covers every item one seller owns in one order, so the only
// thing the seller supplies is which order they're confirming — the server
// works out the line items from their own seller id.
export const createShipmentSchema = z.object({
  orderId: z.string().uuid("Invalid order"),
  carrier: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
});
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

// `confirmed` is the status a shipment is *created* with, so it isn't a
// valid PATCH target — this endpoint only ever moves one forward.
export const updateShipmentSchema = z.object({
  status: z.enum(["packed", "received"]),
  carrier: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
});
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
