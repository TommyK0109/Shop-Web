import { z } from "zod";
import { createProductSchema } from "./product";

// Demo project only: no real national ID format is enforced since none of
// this is real verification. The server masks this to the last 4 digits
// before storage and never persists or logs the full value — see PLAN.md.
const nationalIdSchema = z
  .string()
  .regex(/^\d+$/, "National ID must contain digits only")
  .min(1, "National ID is required");

const applicationProductSchema = createProductSchema;

export const sellerApplicationSchema = z.object({
  applicantName: z.string().min(1, "Applicant name is required").max(200),
  nationalId: nationalIdSchema,
  businessName: z.string().min(1, "Business name is required").max(200),
  description: z.string().max(2000).optional(),
  addressLine1: z.string().min(1, "Address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(1, "Country is required").max(100),
  products: z.array(applicationProductSchema).min(1, "At least one product is required"),
});
export type SellerApplicationInput = z.infer<typeof sellerApplicationSchema>;

export const updateSellerStatusSchema = z.object({
  status: z.enum(["approved", "rejected", "suspended"]),
});
export type UpdateSellerStatusInput = z.infer<typeof updateSellerStatusSchema>;
